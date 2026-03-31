#!/usr/bin/env python3
"""Scrape sailboat listings from sailboatlistings.com using Scrapling.

16,864 active listings across ~480 pages. Pagination via nh= parameter.

Usage:
    python scrape_sailboats.py [limit]           # default: 200 (daily mode)
    python scrape_sailboats.py --bulk [limit]    # all pages up to limit (initial import)

Output: /tmp/scraped_boats.json
"""

import json
import re
import sys
from scrapling import Fetcher

BASE = "https://www.sailboatlistings.com"
LIST_URL = f"{BASE}/cgi-bin/saildata/db.cgi?db=default&uid=default&view_records=1&ID=*&sb=date&so=descend"

fetcher = Fetcher()


def get_listing_urls_from_page(url, limit=200):
    """Extract unique boat listing URLs from one index page."""
    page = fetcher.get(url, timeout=15)
    if page.status != 200:
        return []
    seen = []
    for link in page.css('a[href*="/view/"]'):
        href = link.attrib.get("href", "")
        m = re.search(r"/view/(\d+)", href)
        if m and m.group(1) not in [s[0] for s in seen]:
            seen.append((m.group(1), f"{BASE}/view/{m.group(1)}"))
            if len(seen) >= limit:
                break
    return seen


def get_all_listing_urls(limit=200, bulk=False):
    """Get listing URLs, paginating through index pages."""
    all_urls = []

    if not bulk:
        # Daily mode: just first page
        print(f"Daily mode: scraping first page (limit={limit})")
        urls = get_listing_urls_from_page(LIST_URL, limit)
        print(f"  Found {len(urls)} listings on page 1")
        return urls[:limit]

    # Bulk mode: paginate through all pages
    page_num = 1
    while len(all_urls) < limit:
        url = f"{LIST_URL}&nh={page_num}" if page_num > 1 else LIST_URL
        print(f"  Index page {page_num}...", end=" ", flush=True)

        urls = get_listing_urls_from_page(url, 200)
        if not urls:
            print("no listings (end of pages)")
            break

        # Filter out already-seen IDs
        new_urls = [(bid, burl) for bid, burl in urls if bid not in {u[0] for u in all_urls}]
        if not new_urls:
            print("no new listings (end)")
            break

        all_urls.extend(new_urls)
        print(f"{len(new_urls)} new (total: {len(all_urls)})")

        if len(all_urls) >= limit:
            break
        page_num += 1

    return all_urls[:limit]


def parse_feet_inches(raw):
    """Convert feet/inches strings to decimal feet. '13'10\"' → '13.8' """
    if not raw:
        return raw
    raw = str(raw).strip()
    # Pattern: 13'10" or 13' 10" or 13.5'
    m = re.match(r"(\d+)['\u2019]\s*(\d+)?[\"\u201d]?", raw)
    if m:
        feet = int(m.group(1))
        inches = int(m.group(2)) if m.group(2) else 0
        return f"{feet + inches / 12:.1f}'"
    # Pattern: just a number with optional ' (e.g. "26'" or "32.5'")
    m2 = re.match(r"([\d.]+)['\u2019]?$", raw)
    if m2:
        return f"{m2.group(1)}'"
    return raw


def extract_text(el):
    """Safely extract text from an element."""
    if el is None:
        return ""
    t = el.get_all_text()
    return str(t).strip() if t else ""


def scrape_boat(boat_id, url):
    """Scrape a single boat detail page using HTML table structure."""
    page = fetcher.get(url, timeout=15)
    if page.status != 200:
        return None

    boat = {"id": boat_id, "url": url}
    html = page.body.decode("utf-8", errors="replace")

    # Name from title — clean up patterns like "1979 catalina 30 sailboat"
    title_m = re.search(r"<title>([^<]+)</title>", html)
    if title_m:
        name = title_m.group(1).split(" - ")[0].split(" for sale")[0].strip()
        # Strip leading year(s): "1979 1979 catalina" or "1979 catalina" → "catalina"
        name = re.sub(r'^(\d{4}\s+)+', '', name).strip()
        # Strip trailing "sailboat" / "yacht" / "boat"
        name = re.sub(r'\s+(sailboat|yacht|boat)\s*$', '', name, flags=re.I)
        # Strip leading "Length" (bad parse artifact)
        name = re.sub(r'^Length\s+', '', name, flags=re.I)
        boat["name"] = name if len(name) > 2 else None

    # Parse spec tables: header row has labels, next row has values
    rows = page.css("tr")
    for i, row in enumerate(rows):
        cells = row.css("td")
        cell_texts = [extract_text(c) for c in cells]

        if "Year" in cell_texts and "Length" in cell_texts:
            if i + 1 < len(rows):
                val_cells = rows[i + 1].css("td")
                val_texts = [extract_text(c) for c in val_cells]
                for j, label in enumerate(cell_texts):
                    if j < len(val_texts) and val_texts[j]:
                        key = label.lower().strip()
                        if key == "year":
                            # Only accept valid 4-digit years
                            ym = re.match(r'^(\d{4})$', val_texts[j].strip())
                            if ym and 1950 <= int(ym.group(1)) <= 2030:
                                boat["year"] = ym.group(1)
                        elif key in ("length", "beam", "draft"):
                            boat[key] = parse_feet_inches(val_texts[j])
                        elif key in ("location", "price"):
                            boat[key] = val_texts[j]

        if "Hull" in cell_texts and "Type" in cell_texts:
            if i + 1 < len(rows):
                val_cells = rows[i + 1].css("td")
                val_texts = [extract_text(c) for c in val_cells]
                for j, label in enumerate(cell_texts):
                    if j < len(val_texts) and val_texts[j]:
                        key = label.lower().strip()
                        if key in ("hull", "type", "rigging", "engine"):
                            boat[key] = val_texts[j]

    # Extract description
    desc_m = re.search(
        r"(?:Description|Sailboat\s+Description)[:\s]*(.*?)(?:Specifications|<table|Contact|Email|Phone)",
        html,
        re.DOTALL | re.IGNORECASE,
    )
    if desc_m:
        desc = re.sub(r"<[^>]+>", " ", desc_m.group(1))
        desc = re.sub(r"\s+", " ", desc).strip()[:500]
        if len(desc) > 20:
            boat["description"] = desc

    # Extract images
    imgs = page.css("img[src*='/sailimg/']")
    images = []
    for img in imgs:
        src = img.attrib.get("src", "")
        if src:
            full = BASE + src.replace("/t/", "/l/")
            if full not in images:
                images.append(full)
    boat["images"] = images

    return boat


def main():
    bulk = "--bulk" in sys.argv
    args = [a for a in sys.argv[1:] if a != "--bulk"]
    limit = int(args[0]) if args else (5000 if bulk else 200)

    print(f"{'Bulk' if bulk else 'Daily'} scrape of sailboatlistings.com (limit={limit})")

    urls = get_all_listing_urls(limit, bulk)
    print(f"\nFound {len(urls)} unique listings. Scraping details...\n")

    boats = []
    for i, (boat_id, url) in enumerate(urls):
        boat = scrape_boat(boat_id, url)
        if boat:
            boats.append(boat)
            name = boat.get("name", "Unknown")
            year = boat.get("year", "?")
            price = boat.get("price", "N/A")
            loc = boat.get("location", "?")
            length = boat.get("length", "?")
            n_imgs = len(boat.get("images", []))
            if (i + 1) % 50 == 0 or i < 5:
                print(f"  [{i+1}/{len(urls)}] {year} {name} | {length} | {loc} | {price} | {n_imgs} photos")
        else:
            if (i + 1) % 50 == 0:
                print(f"  [{i+1}/{len(urls)}] Failed to scrape {url}")

    output_path = "/tmp/scraped_boats_bulk.json" if bulk else "/tmp/scraped_boats.json"
    with open(output_path, "w") as f:
        json.dump(boats, f, indent=2)

    print(f"\nDone! {len(boats)} boats saved to {output_path}")


if __name__ == "__main__":
    main()
