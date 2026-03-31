#!/usr/bin/env python3
"""Scrape sailing yacht listings from theyachtmarket.com — full detail-page extraction.

Two-phase approach:
  Phase 1: Collect listing URLs from paginated index pages
  Phase 2: Fetch each detail page, extract all data (specs, images, description)

Usage:
    python scrape_yachtmarket.py [limit]           # Daily: latest N (default 100)
    python scrape_yachtmarket.py --bulk [limit]    # Bulk: all pages up to limit
    python scrape_yachtmarket.py --backfill FILE   # Backfill: URLs from file

Output: /tmp/scraped_yachtmarket.json (daily/backfill)
        /tmp/scraped_yachtmarket_bulk.json (bulk)
"""

import json
import re
import subprocess
import sys
import time

from scrapling import Fetcher

BASE = "https://www.theyachtmarket.com"
LIST_URL = f"{BASE}/en/boats-for-sale/type/sailing-boat/?condition=used"
CDN_BASE = "https://cdnx.theyachtmarket.com/img"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
SSH_PROXY_HOST = "root@100.89.16.27"  # ElmoServer — fallback when Hetzner IP is blocked

METERS_TO_FEET = 3.28084

# Regex patterns for spec extraction from stripped text
SPEC_PATTERNS = {
    "loa": r"(?:Overall\s+)?Length[:\s]+(\d+(?:\.\d+)?)\s*m",
    "beam": r"Beam[:\s]+(\d+(?:\.\d+)?)\s*m",
    "draft": r"Draft[:\s]+(\d+(?:\.\d+)?)\s*m",
    "displacement": r"Displacement[:\s]+([\d,]+(?:\.\d+)?)\s*(?:kg|tonnes?|lbs?)",
    "hull_material": r"Hull\s*(?:Material|Construction)?[:\s]+([\w/][\w\s/&-]*?)(?:\s+(?:Engine|Fuel|Super|Deck|Rig|Cabin|Berth|Head|Keel|Location|Displace)|$|\s{2,}|\n)",
    "engine": r"(?:Main\s+)?Engine[s]?[:\s]+([\w\s\d.,xX×()+-]+?)(?:\s+(?:Gear|Drive|Fuel\s+Type|Fuel\s+Cap|Hull|Cabin|Berth)|$|\s{2,}|\n)",
    "fuel_type": r"Fuel\s*Type[:\s]+(Diesel|Petrol|Electric|Hybrid|Gas)",
    "cabins": r"Cabin[s]?[:\s]+(\d+)",
    "berths": r"Berth[s]?[:\s]+(\d+)",
    "heads": r"(?:Head|Toilet|WC)[s]?[:\s]+(\d+)",
    "rig_type": r"Rig\s*(?:Type)?[:\s]+([\w][\w\s-]*?)(?:\s+(?:Keel|Hull|Cabin|Berth|Head|Engine|Fuel|Displace|Location|Fresh|Water)|$|\s{2,}|\n)",
    "keel_type": r"Keel\s*(?:Type)?[:\s]+([\w][\w\s-]*?)(?:\s+(?:Fresh|Water|Fuel|Cabin|Berth|Head|Engine|Hull|Rig|Displace|Location|Max|Cruising)|$|\s{2,}|\n)",
    "water_capacity": r"(?:Fresh\s*)?Water[:\s]+([\d,]+)\s*(?:litres?|[lL](?:tr)?)\b",
    "fuel_capacity": r"Fuel\s*(?:Capacity|Tank)[:\s]+([\d,]+)\s*(?:litres?|[lL](?:tr)?)\b",
    "max_speed": r"Max(?:imum)?\s+Speed[:\s]+(\d+(?:\.\d+)?)\s*(?:knots?|kn|kts?)",
    "cruising_speed": r"Cruising\s+Speed[:\s]+(\d+(?:\.\d+)?)\s*(?:knots?|kn|kts?)",
}

fetcher = Fetcher()
_use_ssh_proxy = False  # Auto-set to True if local fetch gets 503


def ssh_fetch(url, timeout=20):
    """Fetch a URL via SSH through ElmoServer. Returns (status, html)."""
    try:
        # Step 1: fetch to temp file, get status code
        cmd = f"curl -sS -L -o /tmp/_tym_fetch.html -w '%{{http_code}}' --max-time {timeout} '{url}'"
        r1 = subprocess.run(
            ["ssh", "-o", "ConnectTimeout=5", SSH_PROXY_HOST, cmd],
            capture_output=True, text=True, timeout=timeout + 15
        )
        status_str = r1.stdout.strip().strip("'")
        status = int(status_str) if status_str.isdigit() else 0

        if status != 200:
            return status, ""

        # Step 2: cat the file back
        r2 = subprocess.run(
            ["ssh", "-o", "ConnectTimeout=5", SSH_PROXY_HOST, "cat /tmp/_tym_fetch.html"],
            capture_output=True, text=True, timeout=timeout + 10
        )
        return status, r2.stdout
    except (subprocess.TimeoutExpired, ValueError, Exception) as e:
        print(f"  SSH fetch error: {e}", flush=True)
        return 0, ""


def smart_fetch(url, timeout=20):
    """Fetch URL, auto-routing through ElmoServer if Hetzner is blocked."""
    global _use_ssh_proxy

    if _use_ssh_proxy:
        status, html = ssh_fetch(url, timeout)
        return status, html

    # Try local first
    page = fetcher.get(url, timeout=timeout)
    if page.status == 503:
        # Hetzner might be blocked — try ElmoServer
        print("  Local 503 — switching to ElmoServer proxy", flush=True)
        status, html = ssh_fetch(url, timeout)
        if status == 200:
            _use_ssh_proxy = True  # Stick with proxy for rest of session
            return status, html
    return page.status, page.body.decode("utf-8", errors="replace") if page.status == 200 else ""


class AdaptiveThrottle:
    """Rate limiter with exponential backoff on errors."""

    def __init__(self, base_delay=1.0, max_delay=30.0):
        self.base_delay = base_delay
        self.current_delay = base_delay
        self.max_delay = max_delay
        self.consecutive_errors = 0

    def on_success(self):
        self.consecutive_errors = 0
        self.current_delay = max(self.current_delay * 0.9, self.base_delay)

    def on_error(self):
        self.consecutive_errors += 1
        self.current_delay = min(self.current_delay * 2.0, self.max_delay)

    def should_long_pause(self):
        return self.consecutive_errors >= 3 and self.current_delay >= self.max_delay

    def wait(self):
        time.sleep(self.current_delay)


# ── Phase 1: Collect URLs from index pages ──────────────────────────

def collect_urls(limit, bulk=False):
    """Get detail-page URLs from paginated index. Returns [(id, url), ...]."""
    all_urls = []
    page_num = 1
    throttle = AdaptiveThrottle(base_delay=0.5, max_delay=10.0)

    while len(all_urls) < limit:
        url = f"{LIST_URL}&page={page_num}" if page_num > 1 else LIST_URL
        print(f"  Index page {page_num}...", end=" ", flush=True)

        status, html = smart_fetch(url, timeout=20)
        if status != 200:
            print(f"HTTP {status}")
            throttle.on_error()
            if throttle.should_long_pause():
                print("  Too many errors, pausing 5 minutes...")
                time.sleep(300)
                throttle.consecutive_errors = 0
                continue
            throttle.wait()
            continue

        throttle.on_success()

        # Extract detail page URLs: /en/boats-for-sale/{make}/{model}/id{number}/
        links = re.findall(r'/en/boats-for-sale/([^/]+)/([^/]+)/id(\d+)/', html)
        seen_ids = set(u[0] for u in all_urls)
        new_urls = []
        for make_slug, model_slug, bid in links:
            if bid not in seen_ids and bid not in {u[0] for u in new_urls}:
                detail_url = f"{BASE}/en/boats-for-sale/{make_slug}/{model_slug}/id{bid}/"
                new_urls.append((bid, detail_url))

        if not new_urls:
            print("no new listings (end)")
            break

        all_urls.extend(new_urls)
        print(f"{len(new_urls)} new (total: {len(all_urls)})")

        if not bulk:
            break  # Daily mode: one page only

        has_next = bool(re.search(r'page=\d+', html))
        if not has_next or len(all_urls) >= limit:
            break
        page_num += 1
        throttle.wait()

    return all_urls[:limit]


# ── Phase 2: Detail page extraction ─────────────────────────────────

def extract_og_meta(html):
    """Extract Open Graph meta tags → {price, currency, title, image}."""
    meta = {}
    for tag in re.finditer(r'<meta\s+property="og:([^"]+)"\s+content="([^"]*)"', html):
        meta[tag.group(1)] = tag.group(2)
    return {
        "price": meta.get("price:amount", ""),
        "currency": meta.get("price:currency", ""),
        "title": meta.get("title", ""),
        "image": meta.get("image", ""),
    }


def extract_gtm_data(html):
    """Extract GTM dataLayer ecommerce data → {brand, name, category}."""
    # Look for view_item event in dataLayer
    m = re.search(r'dataLayer\.push\(\s*(\{[^}]*"event"\s*:\s*"view_item"[^}]*\})', html, re.DOTALL)
    if not m:
        # Try broader pattern — sometimes it's in a larger object
        m = re.search(r'"item_brand"\s*:\s*"([^"]*)"', html)
        brand = m.group(1) if m else ""
        m2 = re.search(r'"item_name"\s*:\s*"([^"]*)"', html)
        name = m2.group(1) if m2 else ""
        m3 = re.search(r'"item_category"\s*:\s*"([^"]*)"', html)
        cat = m3.group(1) if m3 else ""
        return {"brand": brand, "name": name, "category": cat}

    block = m.group(1)
    brand_m = re.search(r'"item_brand"\s*:\s*"([^"]*)"', block)
    name_m = re.search(r'"item_name"\s*:\s*"([^"]*)"', block)
    cat_m = re.search(r'"item_category"\s*:\s*"([^"]*)"', block)
    return {
        "brand": brand_m.group(1) if brand_m else "",
        "name": name_m.group(1) if name_m else "",
        "category": cat_m.group(1) if cat_m else "",
    }


def extract_images(html):
    """Extract all gallery images from inline JS and DOM."""
    images = []
    seen = set()

    # Method 1: Find all CDN image URLs in page (inline JS + img tags)
    for m in re.finditer(r'((?:https?:)?//cdnx\.theyachtmarket\.com/img/(\d+)/\d+/[^"\'>\s]+\.jpg)', html):
        img_url = m.group(1)
        img_id = m.group(2)
        if img_url.startswith("//"):
            img_url = "https:" + img_url
        # Normalize to size /2/ (1000px) for quality
        normalized = re.sub(r'/img/(\d+)/\d+/', r'/img/\1/2/', img_url)
        if normalized not in seen:
            seen.add(normalized)
            images.append(normalized)

    return images


def extract_specs(html):
    """Extract specs from structured HTML fields and engine section."""
    specs = {}

    # Method 1: Structured <strong>Label</strong><br />Value pattern
    FIELD_MAP = {
        "length overall": "loa",
        "beam": "beam",
        "draft": "draft",
        "displacement": "displacement",
        "hull material": "hull_material",
        "keel type": "keel_type",
        "keel": "keel_type",  # sometimes just "Keel"
        "fuel capacity": "fuel_capacity",
        "water capacity": "water_capacity",
        "cabins": "cabins",
        "number of cabins": "cabins",
        "berths": "berths",
        "number of berths": "berths",
        "heads": "heads",
        "number of heads": "heads",
        "rig type": "rig_type",
        "max speed": "max_speed",
        "cruising speed": "cruising_speed",
        "location": "_location",  # stored separately
        "category": "_category",
    }

    for m in re.finditer(r'<strong>(.*?)</strong>\s*<br\s*/?\s*>\s*\n?\s*([^<\n]+)', html):
        label = m.group(1).strip().lower().rstrip(":")
        value = m.group(2).strip()
        if not value or value in ("", "-", "N/A"):
            continue
        field = FIELD_MAP.get(label)
        if field and not field.startswith("_"):
            # Don't overwrite if we already have a value (first match wins)
            if field not in specs:
                specs[field] = value

    # Convert meters to feet for dimensions
    for key in ("loa", "beam", "draft"):
        if key in specs:
            m = re.search(r'([\d.]+)\s*(?:m(?:etres?)?)', specs[key])
            if m:
                meters = float(m.group(1))
                if 1 < meters < 100:
                    specs[key] = f"{meters * METERS_TO_FEET:.1f}'"

    # Normalize displacement to kg
    if "displacement" in specs:
        val = specs["displacement"]
        num_m = re.search(r'([\d,]+(?:\.\d+)?)', val)
        if num_m:
            num = float(num_m.group(1).replace(",", ""))
            if "tonne" in val.lower():
                num *= 1000
            elif "lb" in val.lower():
                num *= 0.453592
            specs["displacement"] = str(int(num))

    # Normalize capacity values to just numbers
    for key in ("fuel_capacity", "water_capacity"):
        if key in specs:
            num_m = re.search(r'([\d,]+)', specs[key])
            if num_m:
                specs[key] = num_m.group(1).replace(",", "")

    # Method 2: Engine from structured <h5>Engines</h5> section
    engine_m = re.search(r'<h5>Engines?</h5>\s*<ul>\s*<li>(.*?)(?:<ul>|</li>)', html, re.DOTALL)
    if engine_m:
        engine_text = re.sub(r'<[^>]+>', ' ', engine_m.group(1))
        engine_text = re.sub(r'\s+', ' ', engine_text).strip()
        # Build clean engine string from key parts
        parts = []
        make_m = re.search(r'(Yanmar|Volvo|Caterpillar|Perkins|Cummins|Mercury|Nanni|Beta|Sole|Lombardini|Vetus)\s+([\w.-]+)', engine_text, re.IGNORECASE)
        hp_m = re.search(r'(\d+)\s*hp', engine_text, re.IGNORECASE)
        if make_m:
            parts.append(f"{make_m.group(1)} {make_m.group(2)}")
        if hp_m:
            parts.append(f"{hp_m.group(1)}hp")
        # Check for diesel
        if "diesel" in engine_text.lower():
            if "fuel_type" not in specs:
                specs["fuel_type"] = "Diesel"
        if parts:
            specs["engine"] = " ".join(parts)
        elif engine_text and len(engine_text) < 80:
            specs["engine"] = engine_text

    # Method 3: Cabins/berths from accommodation section if not in structured fields
    if "cabins" not in specs:
        cab_m = re.search(r'(\d+)\s*(?:cabin|stateroom)s?\b', html, re.IGNORECASE)
        if cab_m:
            specs["cabins"] = cab_m.group(1)
    if "berths" not in specs:
        berth_m = re.search(r'(\d+)\s*(?:berth|guest)s?\b', html, re.IGNORECASE)
        if berth_m:
            specs["berths"] = berth_m.group(1)
    if "heads" not in specs:
        head_m = re.search(r'(\d+)\s*(?:head|toilet|bathroom)s?\b', html, re.IGNORECASE)
        if head_m:
            specs["heads"] = head_m.group(1)

    # Method 4: Fuel type from structured engine list
    if "fuel_type" not in specs:
        if re.search(r'<li>Diesel</li>', html, re.IGNORECASE):
            specs["fuel_type"] = "Diesel"
        elif re.search(r'<li>Petrol</li>', html, re.IGNORECASE):
            specs["fuel_type"] = "Petrol"

    return specs


def extract_description(html):
    """Extract AI summary + broker description."""
    parts = []

    # AI summary: first <p> with class containing margin_0
    ai_m = re.search(r'<p[^>]*class="[^"]*margin_0[^"]*"[^>]*>(.*?)</p>', html, re.DOTALL)
    if ai_m:
        text = re.sub(r'<[^>]+>', '', ai_m.group(1)).strip()
        if len(text) > 50:
            parts.append(text)

    # Broker description: <p> tags in the description section
    # Look for description container patterns
    desc_section = re.search(
        r'(?:class="[^"]*description[^"]*"|id="[^"]*description[^"]*")(.*?)(?:</div>|<div\s+class="[^"]*spec)',
        html, re.DOTALL | re.IGNORECASE
    )
    if desc_section:
        for p_m in re.finditer(r'<p[^>]*>(.*?)</p>', desc_section.group(1), re.DOTALL):
            text = re.sub(r'<[^>]+>', '', p_m.group(1)).strip()
            if len(text) > 30 and text not in parts:
                parts.append(text)

    # Fallback: grab all substantial <p> tags after the AI summary
    if not parts:
        for p_m in re.finditer(r'<p[^>]*>(.*?)</p>', html, re.DOTALL):
            text = re.sub(r'<[^>]+>', '', p_m.group(1)).strip()
            if len(text) > 100:
                parts.append(text)
                if len(parts) >= 5:
                    break

    return "\n\n".join(parts)[:3000]  # Cap at 3000 chars


def extract_location(html):
    """Extract location from detail page."""
    # Pattern 1: Structured <strong>Location</strong><br />Value
    loc_m = re.search(r'<strong>Location</strong>\s*<br\s*/?\s*>\s*\n?\s*([^<\n]+)', html)
    if loc_m:
        loc = loc_m.group(1).strip().rstrip(",. ")
        if len(loc) > 2:
            return loc

    # Pattern 2: from og:title — "for sale in City, Country - YYYY"
    title_m = re.search(r'for (?:for )?[Ss]ale in\s+([^"]+?)(?:\s*-\s*\d{4})', html)
    if title_m:
        loc = title_m.group(1).strip().rstrip(",. ")
        # Strip "Priced at..." suffix if present
        loc = re.sub(r'\.\s*Priced.*$', '', loc).strip()
        if len(loc) > 2:
            return loc

    # Pattern 3: stripped text near "Location" or "Lying" label
    text = re.sub(r'<[^>]+>', ' ', html)
    loc_m2 = re.search(r'(?:Location|Lying)[:\s]+([A-Z][\w\s,]+?)(?:\s{2,}|\n)', text)
    if loc_m2:
        loc = loc_m2.group(1).strip()
        if len(loc) > 3:
            return loc

    return ""


def parse_make_model(og_meta, gtm_data, url):
    """Derive make and model from structured data, with URL slug fallback."""
    make = gtm_data.get("brand", "")
    title = og_meta.get("title", "")

    if make and title:
        # OG title is usually: "Make Model Used Boat for sale in Location"
        # Strip "Used Boat for sale..." suffix
        model_text = re.sub(r'\s+(?:Used|New)\s+Boat.*$', '', title, flags=re.IGNORECASE).strip()
        # Strip leading year
        model_text = re.sub(r'^\d{4}\s+', '', model_text).strip()
        # Strip make prefix to get model
        if model_text.lower().startswith(make.lower()):
            model = model_text[len(make):].strip()
        else:
            model = model_text
        if model:
            return make, model

    # Fallback: URL slugs
    url_m = re.search(r'/boats-for-sale/([^/]+)/([^/]+)/id', url)
    if url_m:
        make = make or url_m.group(1).replace("-", " ").title()
        model = url_m.group(2).replace("-", " ").title()
        return make, model

    return make or "Unknown", gtm_data.get("name", "Unknown")


def scrape_detail(bid, url, throttle):
    """Fetch and extract all data from a single detail page."""
    status, html = smart_fetch(url, timeout=20)

    if status != 200:
        throttle.on_error()
        if throttle.should_long_pause():
            print("\n  Error storm — pausing 5 minutes...", flush=True)
            time.sleep(300)
            throttle.consecutive_errors = 0
        else:
            throttle.wait()
        # Retry once
        status, html = smart_fetch(url, timeout=20)
        if status != 200:
            return None

    throttle.on_success()

    # Layer 1: Structured metadata
    og = extract_og_meta(html)
    gtm = extract_gtm_data(html)

    # Layer 2: Images
    images = extract_images(html)

    # Layer 3: HTML content
    specs = extract_specs(html)
    description = extract_description(html)
    location = extract_location(html)

    # Derive make/model
    make, model = parse_make_model(og, gtm, url)
    name = f"{make} {model}".strip()

    # Year — from og:title or text
    year = ""
    year_m = re.search(r'\b(19[5-9]\d|20[0-2]\d)\b', og.get("title", ""))
    if year_m:
        year = year_m.group(1)
    if not year:
        # Try from text near "Year Built"
        text = re.sub(r'<[^>]+>', ' ', html)
        year_m2 = re.search(r'(?:Year|Built)[:\s]+(\d{4})', text)
        if year_m2:
            year = year_m2.group(1)

    # Price — prefer OG meta (clean numeric + ISO currency)
    price = og.get("price", "")
    currency = og.get("currency", "")
    if not price:
        # Fallback: regex from text
        text = re.sub(r'<[^>]+>', ' ', html)
        price_m = re.search(r'[£$€]\s?[\d,]+(?:\.\d{2})?', text)
        if price_m:
            price = price_m.group()

    # Build boat dict
    boat = {
        "id": bid,
        "url": url,
        "name": name,
        "year": year,
        "price": price,
        "location": location,
        "images": images,
        "description": description,
    }

    # Add currency if we have it (import will use it directly)
    if currency:
        boat["currency"] = currency

    # Map specs to ScrapedBoat fields
    if specs.get("loa"):
        boat["length"] = specs["loa"]
    if specs.get("beam"):
        boat["beam"] = specs["beam"]
    if specs.get("draft"):
        boat["draft"] = specs["draft"]
    if specs.get("hull_material"):
        boat["hull"] = specs["hull_material"]
    if specs.get("engine"):
        boat["engine"] = specs["engine"]
    if specs.get("rig_type"):
        boat["rigging"] = specs["rig_type"]
    if specs.get("fuel_type"):
        boat["fuel_type"] = specs["fuel_type"]
    if specs.get("displacement"):
        boat["displacement"] = specs["displacement"]
    if specs.get("cabins"):
        boat["cabins"] = specs["cabins"]
    if specs.get("berths"):
        boat["berths"] = specs["berths"]
    if specs.get("heads"):
        boat["heads"] = specs["heads"]
    if specs.get("keel_type"):
        boat["keel_type"] = specs["keel_type"]
    if specs.get("water_capacity"):
        boat["water_capacity"] = specs["water_capacity"]
    if specs.get("fuel_capacity"):
        boat["fuel_capacity"] = specs["fuel_capacity"]
    if specs.get("max_speed"):
        boat["max_speed"] = specs["max_speed"]
    if specs.get("cruising_speed"):
        boat["cruising_speed"] = specs["cruising_speed"]

    return boat


# ── Main ─────────────────────────────────────────────────────────────

def main():
    bulk = "--bulk" in sys.argv
    backfill = "--backfill" in sys.argv
    args = [a for a in sys.argv[1:] if not a.startswith("--")]

    if backfill:
        # Backfill mode: read URLs from file
        filepath = args[0] if args else "/dev/stdin"
        with open(filepath) as f:
            urls = []
            for line in f:
                line = line.strip()
                if not line:
                    continue
                bid_m = re.search(r'id(\d+)', line)
                bid = bid_m.group(1) if bid_m else line.split("/")[-2]
                urls.append((bid, line))
        print(f"Backfill mode: {len(urls)} URLs loaded")
    else:
        limit = int(args[0]) if args else (5000 if bulk else 100)
        print(f"{'Bulk' if bulk else 'Daily'} scrape of theyachtmarket.com (limit={limit})")
        urls = collect_urls(limit, bulk)
        print(f"\nCollected {len(urls)} URLs. Scraping detail pages...\n")

    # Phase 2: Scrape detail pages
    throttle = AdaptiveThrottle(base_delay=1.0, max_delay=30.0)
    boats = []
    failed = 0

    for i, (bid, url) in enumerate(urls):
        boat = scrape_detail(bid, url, throttle)

        if boat:
            boats.append(boat)
            n_imgs = len(boat.get("images", []))
            n_specs = len([k for k in ("beam", "draft", "hull", "engine", "cabins",
                                        "rigging", "displacement") if boat.get(k)])
            if (i + 1) % 10 == 0 or i < 5 or (i + 1) == len(urls):
                print(f"  [{i+1}/{len(urls)}] {boat.get('year','?')} {boat.get('name','?')}"
                      f" | {boat.get('price','N/A')} | {n_imgs} imgs | {n_specs}/7 specs")
        else:
            failed += 1
            if (i + 1) % 10 == 0 or i < 5:
                print(f"  [{i+1}/{len(urls)}] FAILED {url}")

        # Batch pause every 500 boats in bulk mode
        if bulk and (i + 1) % 500 == 0 and (i + 1) < len(urls):
            print(f"\n  Batch pause (60s) after {i+1} boats...\n", flush=True)
            time.sleep(60)

        # Save progress every 50 boats
        if (i + 1) % 50 == 0:
            output_path = "/tmp/scraped_yachtmarket_bulk.json" if bulk else "/tmp/scraped_yachtmarket.json"
            with open(output_path, "w") as f:
                json.dump(boats, f)

        throttle.wait()

    # Final save
    output_path = "/tmp/scraped_yachtmarket_bulk.json" if bulk else "/tmp/scraped_yachtmarket.json"
    with open(output_path, "w") as f:
        json.dump(boats, f, indent=2)

    print(f"\nDone! {len(boats)} boats saved to {output_path} ({failed} failed)")

    # Print sample
    for b in boats[:3]:
        name = b.get("name", "?")
        price = b.get("price", "N/A")
        year = b.get("year", "?")
        loc = b.get("location", "?")
        imgs = len(b.get("images", []))
        specs = len([k for k in ("beam", "draft", "hull", "engine", "cabins") if b.get(k)])
        print(f"  {year} {name} | {price} | {loc} | {imgs} photos | {specs}/5 specs")


if __name__ == "__main__":
    main()
