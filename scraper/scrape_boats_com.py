#!/usr/bin/env python3
"""Scrape sailboat listings from boats.com using Scrapling StealthyFetcher (Camoufox).

Designed to run from a residential egress (e.g. Elmo on Converge PH). Cloudflare
blocks Hetzner datacenter IPs for this site, so this scraper is orchestrated from
Elmo even though the output is imported into the production DB on Hetzner.

The "technique" is human pacing — random 30-75s between page requests, jittered
cron start, graceful abort on Cloudflare detection with a sentinel file Overlord
can pick up for Discord alerts.

Usage:
    python scrape_boats_com.py [pages]   # default: 5 (first cautious run)

Output:
    /tmp/scraped_boats.json       — listings for import-scraped.ts
    /tmp/boats_com_run.json       — per-run metrics (pages, counts, cf_hits, duration)
    /tmp/boats_com_cloudflare.flag — touched only if Cloudflare challenges us
"""

import json
import random
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from scrapling.fetchers import StealthyFetcher

BASE = "https://www.boats.com"
LIST_URL = f"{BASE}/boats-for-sale/?class=sail"

OUTPUT_JSON = Path("/tmp/scraped_boats.json")
RUN_METRICS = Path("/tmp/boats_com_run.json")
CLOUDFLARE_FLAG = Path("/tmp/boats_com_cloudflare.flag")
SUSPICIOUS_FLAG = Path("/tmp/boats_com_suspicious.flag")

CF_HEADER_HINTS = ("cf-ray", "cf-cache-status", "cf-chl-bypass", "cf-mitigated")
CF_SERVER_HEADER_SUBSTRINGS = ("cloudflare",)
CF_BLOCK_STATUS = {403, 429, 503, 520, 521, 522, 523, 524, 525, 526, 527}

# Human pacing windows (seconds).
PAGE_PAUSE_MIN = 30
PAGE_PAUSE_MAX = 75
INITIAL_WARMUP_MIN = 4
INITIAL_WARMUP_MAX = 12

CF_H1_MARKERS = (
    "gateway time-out",
    "just a moment",
    "attention required",
    "access denied",
    "error 1020",
    "error 1015",
)


def human_pause(label, lo, hi):
    delay = random.uniform(lo, hi)
    print(f"  pause {delay:.1f}s ({label})", flush=True)
    time.sleep(delay)


def classify_cloudflare(status, headers, h1_text, cards_count):
    """Return (is_cf, reason) — conservative, only classifies when signal is strong.

    A page that returned 200 with real listing cards is NEVER classified as CF,
    even if ad copy in the body happens to contain a marker string.
    """
    if status in CF_BLOCK_STATUS:
        return True, f"status={status}"

    header_keys_lower = {str(k).lower(): str(v).lower() for k, v in (headers or {}).items()}
    server = header_keys_lower.get("server", "")
    has_cf_header = any(h in header_keys_lower for h in CF_HEADER_HINTS) or any(
        s in server for s in CF_SERVER_HEADER_SUBSTRINGS
    )

    h1_lower = (h1_text or "").lower()
    h1_looks_cf = any(m in h1_lower for m in CF_H1_MARKERS)

    if status != 200 and has_cf_header:
        return True, f"status={status}+cf_header"
    if h1_looks_cf and cards_count == 0:
        return True, f"h1_cf_marker:{h1_lower[:60]}"
    if status == 200 and cards_count == 0 and has_cf_header:
        return True, "200+zero_cards+cf_header"
    return False, ""


def write_cf_flag(page, url, status, reason):
    CLOUDFLARE_FLAG.write_text(json.dumps({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "page": page,
        "url": url,
        "status": status,
        "reason": reason,
    }, indent=2))


def absolute_image(src):
    if not src:
        return None
    src = src.strip()
    if src.startswith("//"):
        return "https:" + src
    if src.startswith("/"):
        return BASE + src
    if src.startswith(("http://", "https://")):
        return src
    return None


def first_text(element_list):
    if not element_list:
        return ""
    return element_list[0].get_all_text().strip()


def parse_card(card):
    listing_id = (card.attrib.get("data-listing-id") or "").strip()
    if not listing_id:
        return None

    link_els = card.css('a[href*="/sailing-boats/"]')
    if not link_els:
        return None

    href = link_els[0].attrib.get("href", "")
    if not href:
        return None
    url = BASE + href if href.startswith("/") else href

    name = first_text(card.css("h2")) or first_text(card.css("h3"))
    if not name:
        return None

    images = []
    for im in card.css("img"):
        abs_src = absolute_image(im.attrib.get("data-src") or im.attrib.get("src"))
        if abs_src and abs_src not in images:
            images.append(abs_src)
        if len(images) >= 15:
            break

    seller_raw = first_text(card.css(".seller"))
    seller = re.sub(r"^\s*Seller\s*", "", seller_raw, flags=re.I).strip()

    return {
        "id": listing_id,
        "name": name,
        "year": first_text(card.css(".year")),
        "price": first_text(card.css(".price")),
        "location": first_text(card.css(".country")),
        "seller": seller,
        "url": url,
        "images": images,
    }


def fetch_page(fetcher, url, referer):
    return fetcher.fetch(
        url,
        headless=True,
        network_idle=False,
        timeout=60000,
        extra_headers={"Referer": referer} if referer else None,
    )


def main():
    pages = 5
    if len(sys.argv) > 1:
        try:
            pages = int(sys.argv[1])
        except ValueError:
            print(f"Usage: scrape_boats_com.py [pages]. Got: {sys.argv[1]!r}", flush=True)
            sys.exit(64)
        if pages < 1 or pages > 200:
            print(f"pages out of range (1..200): {pages}", flush=True)
            sys.exit(64)

    CLOUDFLARE_FLAG.unlink(missing_ok=True)
    SUSPICIOUS_FLAG.unlink(missing_ok=True)

    fetcher = StealthyFetcher()
    boats_by_id = {}
    cf_hits = 0
    http_errors = 0
    suspicious_empty = 0
    started = datetime.now(timezone.utc)

    print(f"boats.com scrape: pages=1..{pages}", flush=True)
    human_pause("initial jitter", INITIAL_WARMUP_MIN, INITIAL_WARMUP_MAX)

    referer = "https://www.google.com/"

    for page in range(1, pages + 1):
        url = LIST_URL if page == 1 else f"{LIST_URL}&page={page}"
        print(f"[page {page}] GET {url}", flush=True)

        try:
            resp = fetch_page(fetcher, url, referer)
        except Exception as e:
            print(f"  fetch error: {e}", flush=True)
            http_errors += 1
            break

        headers = getattr(resp, "headers", {}) or {}
        cards = resp.css("[data-listing-id]") if resp.status == 200 else []
        h1_els = resp.css("h1") if resp.status == 200 else []
        h1_text = h1_els[0].get_all_text().strip() if h1_els else ""

        is_cf, cf_reason = classify_cloudflare(resp.status, headers, h1_text, len(cards))
        if is_cf:
            print(f"  Cloudflare detected ({cf_reason}) — aborting", flush=True)
            write_cf_flag(page, url, resp.status, cf_reason)
            cf_hits += 1
            break

        if resp.status != 200:
            print(f"  HTTP {resp.status} — aborting", flush=True)
            http_errors += 1
            break
        new_on_page = 0
        for card in cards:
            b = parse_card(card)
            if not b:
                continue
            if b["id"] in boats_by_id:
                continue
            boats_by_id[b["id"]] = b
            new_on_page += 1
        print(f"  page {page}: {new_on_page} new, {len(boats_by_id)} total", flush=True)

        if new_on_page == 0:
            suspicious_empty += 1
            SUSPICIOUS_FLAG.write_text(json.dumps({
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "page": page,
                "url": url,
                "cards_seen": len(cards),
                "note": "zero new listings on this page — could be end-of-feed or anti-bot partial render",
            }, indent=2))
            print("  zero new listings — stopping (flagged as suspicious for dashboard review)", flush=True)
            break

        referer = url
        if page < pages:
            human_pause(f"between page {page} and {page+1}", PAGE_PAUSE_MIN, PAGE_PAUSE_MAX)

    boats = list(boats_by_id.values())
    OUTPUT_JSON.write_text(json.dumps(boats, indent=2))

    duration = (datetime.now(timezone.utc) - started).total_seconds()
    metrics = {
        "started_at": started.isoformat(),
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "duration_seconds": round(duration, 1),
        "pages_requested": pages,
        "boats_scraped": len(boats),
        "cloudflare_hits": cf_hits,
        "http_errors": http_errors,
        "suspicious_empty_pages": suspicious_empty,
        "output_path": str(OUTPUT_JSON),
    }
    RUN_METRICS.write_text(json.dumps(metrics, indent=2))

    print(f"\nDone. {len(boats)} boats → {OUTPUT_JSON}", flush=True)
    print(f"Metrics → {RUN_METRICS}", flush=True)
    if cf_hits:
        print(f"WARNING: {cf_hits} Cloudflare hit(s); flag at {CLOUDFLARE_FLAG}", flush=True)
        sys.exit(2)
    if not boats:
        print("WARNING: 0 boats scraped", flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
