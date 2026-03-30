#!/usr/bin/env python3
"""Scrape catamaran listings from virginislandsyachtbroker.com.

Caribbean cats, USD prices.

Usage: python scrape_vi_yachtbroker.py [limit]
"""
import json, re, sys
from scrapling import Fetcher

BASE = "https://www.virginislandsyachtbroker.com"
fetcher = Fetcher()

def scrape_page(url):
    page = fetcher.get(url, timeout=20)
    if page.status != 200: return []
    html = page.body.decode("utf-8", errors="replace")

    # Links: /yachts/catamaran/{slug}/ or /yachts/monohull/{slug}/
    links = re.findall(r'/yachts/(?:catamaran|monohull|power)/([^"]+?)/', html)
    seen, boats = set(), []
    for slug in links:
        if slug in seen or not slug: continue
        seen.add(slug)
        boat = {"url": f"{BASE}/yachts/catamaran/{slug}/"}

        ctx_parts = []
        for m in re.finditer(re.escape(slug), html):
            s, e = max(0, m.start()-500), min(len(html), m.end()+300)
            ctx_parts.append(html[s:e])
        ctx = re.sub(r'<[^>]+>', ' ', " ".join(ctx_parts))
        ctx = re.sub(r'\s+', ' ', ctx)

        # Name from slug: "2026-bali-4" → "Bali 4"
        name = slug.replace("-", " ").title()
        year_m = re.match(r'^(\d{4})\s+', name)
        if year_m:
            boat["year"] = year_m.group(1)
            name = name[len(year_m.group()):].strip()
        boat["name"] = name

        # Price
        price_m = re.search(r'\$([\d,]{4,})', ctx)
        if price_m: boat["price"] = f"${price_m.group(1)}"

        # Length from name or context
        len_m = re.search(r"(\d+)['\s]*(?:ft|')", ctx, re.I)
        if len_m: boat["length"] = f"{len_m.group(1)}'"

        # Location
        loc_m = re.search(r'(Virgin Islands|Grenada|Saint\s+\w+|Tortola|BVI|Antigua)', ctx, re.I)
        if loc_m: boat["location"] = loc_m.group(1)

        boat["images"] = []
        if boat.get("name") and boat.get("price"): boats.append(boat)

    return boats

def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    print(f"Scraping virginislandsyachtbroker.com (limit={limit})...")
    boats = scrape_page(BASE)[:limit]
    with open("/tmp/scraped_vi_yachtbroker.json", "w") as f: json.dump(boats, f, indent=2)
    print(f"Done! {len(boats)} boats saved")

if __name__ == "__main__": main()
