#!/usr/bin/env python3
"""Scrape superyacht listings from camperandnicholsons.com. EUR/USD prices, meters.

Usage: python scrape_camperandnicholsons.py [limit]
"""
import json, re, sys
from scrapling import Fetcher

BASE = "https://www.camperandnicholsons.com"
LIST_URL = f"{BASE}/buy-a-yacht/yachts-for-sale"
fetcher = Fetcher()

def scrape_page(url):
    page = fetcher.get(url, timeout=20)
    if page.status != 200: return []
    html = page.body.decode("utf-8", errors="replace")
    boats = []

    # Links: /buy-a-yacht/yachts-for-sale/{slug}
    parts = re.split(r'(href="(/buy-a-yacht/yachts-for-sale/[^"]+)")', html)

    seen = set()
    for i, part in enumerate(parts):
        m = re.match(r'href="(/buy-a-yacht/yachts-for-sale/([a-z0-9-]+))"', part)
        if not m: continue
        path, slug = m.group(1), m.group(2)
        if slug in seen or not slug: continue
        seen.add(slug)

        before = parts[i-1][-500:] if i > 0 else ""
        after = parts[i+1][:500] if i+1 < len(parts) else ""
        ctx = re.sub(r'<[^>]+>', ' ', before + after)
        ctx = re.sub(r'\s+', ' ', ctx)

        boat = {"url": f"{BASE}{path}"}

        # Name — vessel names are ALL CAPS in the HTML
        name_m = re.search(r'\b([A-Z][A-Z\s]{2,25})\b', ctx)
        if name_m:
            boat["name"] = name_m.group(1).strip().title()
        else:
            boat["name"] = slug.replace("-", " ").title()

        # Price
        price_m = re.search(r'€\s*([\d,]+)', ctx)
        if price_m:
            boat["price"] = f"€{price_m.group(1)}"
        else:
            price_m = re.search(r'\$([\d,]+)', ctx)
            if price_m: boat["price"] = f"${price_m.group(1)}"

        # Year
        year_m = re.search(r'\b(19[5-9]\d|20[0-2]\d)\b', slug)
        if year_m: boat["year"] = year_m.group(1)
        if not boat.get("year"):
            year_m = re.search(r'\b(19[5-9]\d|20[0-2]\d)\b', ctx)
            if year_m: boat["year"] = year_m.group(1)

        # Length in meters → feet
        len_m = re.search(r'(\d+(?:\.\d+)?)\s*[Mm]\b', ctx)
        if len_m:
            meters = float(len_m.group(1))
            if meters > 10: boat["length"] = f"{meters * 3.28084:.0f}'"

        boat["images"] = []
        if boat.get("price"): boats.append(boat)

    return boats

def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    print(f"Scraping camperandnicholsons.com (limit={limit})...")
    boats = scrape_page(LIST_URL)[:limit]
    with open("/tmp/scraped_camperandnicholsons.json", "w") as f: json.dump(boats, f, indent=2)
    print(f"Done! {len(boats)} boats saved")
    for b in boats[:5]:
        print(f"  {b.get('year','?')} {b.get('name','?')[:35]:<35} | {b.get('price','?'):<20} | {b.get('length','?')}")

if __name__ == "__main__": main()
