#!/usr/bin/env python3
"""Scrape superyacht listings from camperandnicholsons.com via Playwright."""
import json, re, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from pw_fetch import PlaywrightFetcher

BASE = "https://www.camperandnicholsons.com"

def scrape(limit=30):
    with PlaywrightFetcher() as pf:
        html = pf.get(f"{BASE}/buy-a-yacht/yachts-for-sale", wait_ms=5000)
    if not html: return []
    boats = []
    pattern = re.compile(r'href="(/buy-a-yacht/yachts-for-sale/([a-z0-9][\w-]+))"')
    seen = set()
    for m in pattern.finditer(html):
        path, slug = m.group(1), m.group(2)
        if slug in seen or slug in ("frequently-asked-questions",): continue
        seen.add(slug)
        pos = m.start()
        ctx = re.sub(r'<[^>]+>', ' ', html[max(0,pos-500):pos+2000])
        ctx = re.sub(r'\s+', ' ', ctx)
        boat = {"url": f"{BASE}{path}"}
        # Name: all-caps vessel names in rendered HTML
        name_m = re.search(r'\b([A-Z][A-Z\s]{2,25})\b', ctx)
        boat["name"] = name_m.group(1).strip().title() if name_m else slug.replace("-", " ").title()
        # Price
        price_m = re.search(r'€\s*([\d,]+)', ctx) or re.search(r'\$([\d,]+)', ctx)
        if price_m: boat["price"] = price_m.group(0).strip()
        # Year from slug: "vision-benetti-2011"
        year_m = re.search(r'\b(19[5-9]\d|20[0-2]\d)\b', slug)
        if not year_m: year_m = re.search(r'\b(19[5-9]\d|20[0-2]\d)\b', ctx)
        if year_m: boat["year"] = year_m.group(1)
        # Length in meters
        len_m = re.search(r'(\d+(?:\.\d+)?)\s*[Mm]\b', ctx)
        if len_m:
            meters = float(len_m.group(1))
            if meters > 10: boat["length"] = f"{meters * 3.28084:.0f}'"
        boat["images"] = []
        if boat.get("price") and boat.get("name"): boats.append(boat)
    return boats[:limit]

def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    print(f"Scraping camperandnicholsons.com (limit={limit})...")
    boats = scrape(limit)
    with open("/tmp/scraped_camperandnicholsons.json", "w") as f: json.dump(boats, f, indent=2)
    print(f"Done! {len(boats)} boats")
    for b in boats[:5]:
        print(f"  {b.get('year','?')} {b.get('name','?')[:35]:<35} | {b.get('price','?'):<20} | {b.get('length','?')}")

if __name__ == "__main__": main()
