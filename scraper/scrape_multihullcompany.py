#!/usr/bin/env python3
"""Scrape multihull listings from multihullcompany.com. SSR with US$/EUR prices.

Usage: python scrape_multihullcompany.py [limit]
"""
import json, re, sys
from scrapling import Fetcher

BASE = "https://www.multihullcompany.com"
fetcher = Fetcher()

def scrape_page(url):
    page = fetcher.get(url, timeout=20)
    if page.status != 200: return []
    html = page.body.decode("utf-8", errors="replace")
    boats = []

    # Split by boat links: /boat/{slug}-{id}/
    parts = re.split(r'(href="(?:/boat/[^"]+?-\d{5,}/)")', html)

    seen = set()
    for i, part in enumerate(parts):
        m = re.match(r'href="(/boat/(.+?)-(\d{5,})/)"', part)
        if not m: continue
        path, slug, bid = m.group(1), m.group(2), m.group(3)
        if bid in seen: continue
        seen.add(bid)

        before = parts[i-1][-500:] if i > 0 else ""
        after = parts[i+1][:500] if i+1 < len(parts) else ""
        ctx = re.sub(r'<[^>]+>', ' ', before + after)
        ctx = re.sub(r'\s+', ' ', ctx)

        boat = {"url": f"{BASE}{path}"}
        boat["name"] = slug.replace("-", " ").title()

        # Price — US$ or EUR
        price_m = re.search(r'US\$\s*([\d,]+)', ctx)
        if price_m:
            boat["price"] = f"${price_m.group(1)}"
        else:
            price_m = re.search(r'EUR\s*([\d,]+)', ctx, re.I)
            if not price_m: price_m = re.search(r'€\s*([\d,]+)', ctx)
            if price_m: boat["price"] = f"€{price_m.group(1)}"

        year_m = re.search(r'\b(19[5-9]\d|20[0-2]\d)\b', ctx)
        if year_m: boat["year"] = year_m.group(1)

        len_m = re.search(r'(\d+(?:\.\d+)?)\s*(?:ft|\')', ctx, re.I)
        if len_m: boat["length"] = f"{len_m.group(1)}'"

        loc_m = re.search(r'([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)', ctx)
        if loc_m and len(loc_m.group(1)) > 3: boat["location"] = loc_m.group(1)

        boat["images"] = []
        if boat.get("price"): boats.append(boat)

    return boats

def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    print(f"Scraping multihullcompany.com (limit={limit})...")
    boats = scrape_page(BASE)[:limit]
    with open("/tmp/scraped_multihullcompany.json", "w") as f: json.dump(boats, f, indent=2)
    print(f"Done! {len(boats)} boats saved")
    for b in boats[:5]:
        print(f"  {b.get('year','?')} {b.get('name','?')[:35]:<35} | {b.get('price','?'):<20} | {b.get('length','?')}")

if __name__ == "__main__": main()
