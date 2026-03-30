#!/usr/bin/env python3
"""Scrape cruising catamarans from catamaransite.com. Prices in page HTML.

Usage: python scrape_catamaransite.py [limit]
"""
import json, re, sys
from scrapling import Fetcher

BASE = "https://www.catamaransite.com"
fetcher = Fetcher()

def scrape_page(url):
    page = fetcher.get(url, timeout=20)
    if page.status != 200: return []
    html = page.body.decode("utf-8", errors="replace")
    boats = []

    # Split HTML by yacht detail links
    parts = re.split(r'(href="(/yachts-for-sale/[^"]+?)/?")', html)

    seen = set()
    for i, part in enumerate(parts):
        m = re.match(r'href="(/yachts-for-sale/([^"]+?))/?"', part)
        if not m: continue
        path, slug = m.group(1), m.group(2)
        if slug in seen: continue
        seen.add(slug)

        # Get surrounding context
        before = parts[i-1][-400:] if i > 0 else ""
        after = parts[i+1][:400] if i+1 < len(parts) else ""
        ctx = re.sub(r'<[^>]+>', ' ', before + after)
        ctx = re.sub(r'\s+', ' ', ctx)

        boat = {"url": f"{BASE}{path}/"}

        # Name from slug
        name = slug.replace("-", " ").title()
        # Remove trailing numbers (WordPress duplicate suffixes like "-5", "-6")
        name = re.sub(r'\s+\d+$', '', name)
        boat["name"] = name

        # Price
        price_m = re.search(r'\$([\d,]{4,})', ctx)
        if price_m:
            boat["price"] = f"${price_m.group(1)}"
        else:
            price_m = re.search(r'€([\d,]{4,})', ctx)
            if price_m: boat["price"] = f"€{price_m.group(1)}"

        # Year
        year_m = re.search(r'\b(20[0-2]\d)\b', ctx)
        if year_m: boat["year"] = year_m.group(1)

        # Location
        loc_m = re.search(r'([A-Z][a-z]+(?:\s[A-Z][a-z]+)*,\s*[A-Z][a-z]+)', ctx)
        if loc_m: boat["location"] = loc_m.group(1)

        boat["images"] = []
        if boat.get("price"):
            boats.append(boat)

    return boats

def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    print(f"Scraping catamaransite.com (limit={limit})...")
    boats = scrape_page(BASE)[:limit]
    with open("/tmp/scraped_catamaransite.json", "w") as f: json.dump(boats, f, indent=2)
    print(f"Done! {len(boats)} boats saved")
    for b in boats[:5]:
        print(f"  {b.get('year','?')} {b.get('name','?')[:35]:<35} | {b.get('price','?'):<20}")

if __name__ == "__main__": main()
