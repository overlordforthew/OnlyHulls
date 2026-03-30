#!/usr/bin/env python3
"""Scrape multihull listings from multihullworld.com/for-sale. Prices in static HTML."""
import json, re, sys
from scrapling import Fetcher

BASE = "https://www.multihullworld.com"
fetcher = Fetcher()

def scrape(limit=30):
    page = fetcher.get(f"{BASE}/for-sale", timeout=20)
    if page.status != 200: return []
    html = page.body.decode("utf-8", errors="replace")
    boats = []

    # Links: /for-sale/{slug}/{id}
    link_pattern = re.compile(r'href="(/for-sale/([^"]+?)/(\d{4,}))"')
    seen = set()

    for m in link_pattern.finditer(html):
        path, slug, bid = m.group(1), m.group(2), m.group(3)
        if bid in seen: continue
        seen.add(bid)

        # Get surrounding context (prices are near links)
        pos = m.start()
        ctx = re.sub(r'<[^>]+>', ' ', html[max(0,pos-500):pos+1500])
        ctx = re.sub(r'\s+', ' ', ctx)

        boat = {"url": f"{BASE}{path}"}

        name = slug.replace("-", " ").title()
        year_m = re.match(r'^(\d{4})\s+', name)
        if year_m:
            boat["year"] = year_m.group(1)
            name = name[len(year_m.group()):].strip()
        boat["name"] = name

        # Price
        price_m = re.search(r'[£€]\s*([\d,]+)', ctx) or re.search(r'\$([\d,]{4,})', ctx)
        if price_m: boat["price"] = price_m.group(0).strip()

        # Length
        len_m = re.search(r'(\d+)\s*ft', ctx)
        if len_m: boat["length"] = f"{len_m.group(1)}'"
        elif not boat.get("length"):
            len_m = re.search(r'(\d+(?:\.\d+)?)\s*m\b', ctx)
            if len_m:
                val = float(len_m.group(1))
                if 5 < val < 50: boat["length"] = f"{val * 3.28084:.0f}'"

        boat["images"] = []
        if boat.get("price"): boats.append(boat)

    return boats[:limit]

def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    print(f"Scraping multihullworld.com (limit={limit})...")
    boats = scrape(limit)
    with open("/tmp/scraped_multihullworld.json", "w") as f: json.dump(boats, f, indent=2)
    print(f"Done! {len(boats)} boats")
    for b in boats[:5]:
        print(f"  {b.get('year','?')} {b.get('name','?')[:35]:<35} | {b.get('price','?'):<20} | {b.get('length','?')}")

if __name__ == "__main__": main()
