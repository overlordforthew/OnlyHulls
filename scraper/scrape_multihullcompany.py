#!/usr/bin/env python3
"""Scrape multihull listings from multihullcompany.com.

Usage: python scrape_multihullcompany.py [limit]
"""
import json, re, sys
from scrapling import Fetcher

BASE = "https://www.multihullcompany.com"
fetcher = Fetcher()

def scrape_page(url):
    page = fetcher.get(url, timeout=20)
    if page.status != 200: return [], False
    html = page.body.decode("utf-8", errors="replace")

    # Links: /boat/{model}-{id}/
    links = re.findall(r'/boat/([^"]+?)-(\d{5,})/', html)
    seen, boats = {}, []
    for slug, bid in links:
        if bid in seen: continue
        seen[bid] = True
        boat = {"url": f"{BASE}/boat/{slug}-{bid}/"}

        ctx_parts = []
        for m in re.finditer(bid, html):
            s, e = max(0, m.start()-600), min(len(html), m.end()+300)
            ctx_parts.append(html[s:e])
        ctx = re.sub(r'<[^>]+>', ' ', " ".join(ctx_parts))
        ctx = re.sub(r'\s+', ' ', ctx)

        # Name from slug
        name = slug.replace("-", " ").title()
        boat["name"] = name

        # Price
        price_m = re.search(r'(?:US\$|USD|€|EUR)\s*([\d,]+(?:\.\d+)?)', ctx)
        if not price_m: price_m = re.search(r'\$([\d,]{4,})', ctx)
        if price_m:
            raw = price_m.group(0).strip()
            boat["price"] = raw

        # Year
        year_m = re.search(r'\b(19[5-9]\d|20[0-2]\d)\b', ctx)
        if year_m: boat["year"] = year_m.group(1)

        # Length
        len_m = re.search(r'(\d+(?:\.\d+)?)\s*(?:ft|\')', ctx, re.I)
        if len_m: boat["length"] = f"{len_m.group(1)}'"

        # Location
        loc_m = re.search(r'([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)', ctx)
        if loc_m and len(loc_m.group(1)) > 3:
            boat["location"] = loc_m.group(1)

        boat["images"] = []
        if boat.get("name") and boat.get("price"): boats.append(boat)

    return boats, False  # Single page

def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    print(f"Scraping multihullcompany.com (limit={limit})...")
    boats, _ = scrape_page(BASE)
    boats = boats[:limit]
    with open("/tmp/scraped_multihullcompany.json", "w") as f: json.dump(boats, f, indent=2)
    print(f"Done! {len(boats)} boats saved")

if __name__ == "__main__": main()
