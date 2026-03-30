#!/usr/bin/env python3
"""Scrape multihull listings from multihullworld.com/for-sale via Playwright."""
import json, re, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from pw_fetch import PlaywrightFetcher

BASE = "https://www.multihullworld.com"

def scrape(limit=30):
    with PlaywrightFetcher() as pf:
        html = pf.get(f"{BASE}/for-sale", wait_ms=3000)
    if not html: return []
    boats = []
    pattern = re.compile(r'href="(/for-sale/([^"]+?)/(\d{4,}))"')
    seen = set()
    for m in pattern.finditer(html):
        path, slug, bid = m.group(1), m.group(2), m.group(3)
        if bid in seen: continue
        seen.add(bid)
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
        price_m = re.search(r'[£€]\s*([\d,]+)', ctx) or re.search(r'\$([\d,]{4,})', ctx)
        if price_m: boat["price"] = price_m.group(0).strip()
        len_m = re.search(r'(\d+)\s*ft', ctx)
        if len_m: boat["length"] = f"{len_m.group(1)}'"
        boat["images"] = []
        if boat.get("price") and boat.get("name"): boats.append(boat)
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
