#!/usr/bin/env python3
"""Scrape multihull listings from multihullcompany.com via Playwright."""
import json, re, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from pw_fetch import PlaywrightFetcher

BASE = "https://www.multihullcompany.com"

def scrape(limit=30):
    with PlaywrightFetcher() as pf:
        html = pf.get(BASE, wait_ms=3000)
    if not html: return []
    boats = []
    pattern = re.compile(r'href="(/boat/(.+?)-(\d{5,})/)"')
    seen = set()
    for m in pattern.finditer(html):
        path, slug, bid = m.group(1), m.group(2), m.group(3)
        if bid in seen: continue
        seen.add(bid)
        pos = m.start()
        ctx = re.sub(r'<[^>]+>', ' ', html[max(0,pos-500):pos+1500])
        ctx = re.sub(r'\s+', ' ', ctx)
        boat = {"url": f"{BASE}{path}"}
        boat["name"] = slug.replace("-", " ").title()
        # Price: "$ 5,650,000" or "€ 1,950,000" or "EUR 1,950,000"
        price_m = re.search(r'\$\s*([\d,]{4,})', ctx) or re.search(r'€\s*([\d,]{4,})', ctx) or re.search(r'EUR\s*([\d,]{4,})', ctx, re.I)
        if price_m:
            sym = "$" if "$" in price_m.group(0) else "€"
            boat["price"] = f"{sym}{price_m.group(1)}"
        year_m = re.search(r'\b(19[5-9]\d|20[0-2]\d)\b', ctx)
        if year_m: boat["year"] = year_m.group(1)
        len_m = re.search(r'(\d+(?:\.\d+)?)\s*(?:ft|\')', ctx, re.I)
        if len_m: boat["length"] = f"{len_m.group(1)}'"
        loc_m = re.search(r'([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)', ctx)
        if loc_m and len(loc_m.group(1)) > 3: boat["location"] = loc_m.group(1)
        boat["images"] = []
        if boat.get("price") and boat.get("name"): boats.append(boat)
    return boats[:limit]

def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    print(f"Scraping multihullcompany.com (limit={limit})...")
    boats = scrape(limit)
    with open("/tmp/scraped_multihullcompany.json", "w") as f: json.dump(boats, f, indent=2)
    print(f"Done! {len(boats)} boats")
    for b in boats[:5]:
        print(f"  {b.get('year','?')} {b.get('name','?')[:35]:<35} | {b.get('price','?'):<20} | {b.get('length','?')}")

if __name__ == "__main__": main()
