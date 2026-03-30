#!/usr/bin/env python3
"""Scrape cruising catamarans from catamaransite.com via Playwright."""
import json, re, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from pw_fetch import PlaywrightFetcher

BASE = "https://www.catamaransite.com"

def scrape(limit=30):
    with PlaywrightFetcher() as pf:
        html = pf.get(BASE, wait_ms=8000)  # Slow site, needs longer wait
    if not html: return []
    boats = []
    pattern = re.compile(r'href="(/yachts-for-sale/([^"]+?))/?"')
    seen = set()
    for m in pattern.finditer(html):
        path, slug = m.group(1), m.group(2)
        if slug in seen: continue
        seen.add(slug)
        pos = m.start()
        ctx = re.sub(r'<[^>]+>', ' ', html[max(0,pos-400):pos+800])
        ctx = re.sub(r'\s+', ' ', ctx)
        boat = {"url": f"{BASE}{path}/"}
        name = slug.replace("-", " ").title()
        name = re.sub(r'\s+\d+$', '', name)  # Strip WP duplicate suffix
        boat["name"] = name
        # Price (skip empty "$." patterns)
        price_m = re.search(r'\$([\d,]{4,})', ctx) or re.search(r'€([\d,]{4,})', ctx)
        if price_m: boat["price"] = price_m.group(0).strip()
        year_m = re.search(r'\b(20[0-2]\d)\b', ctx)
        if year_m: boat["year"] = year_m.group(1)
        loc_m = re.search(r'([A-Z][a-z]+(?:\s[A-Z][a-z]+)*,\s*[A-Z][a-z]+)', ctx)
        if loc_m: boat["location"] = loc_m.group(1)
        boat["images"] = []
        if boat.get("price") and boat.get("name"): boats.append(boat)
    return boats[:limit]

def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    print(f"Scraping catamaransite.com (limit={limit})...")
    boats = scrape(limit)
    with open("/tmp/scraped_catamaransite.json", "w") as f: json.dump(boats, f, indent=2)
    print(f"Done! {len(boats)} boats")
    for b in boats[:5]:
        print(f"  {b.get('year','?')} {b.get('name','?')[:35]:<35} | {b.get('price','?'):<20}")

if __name__ == "__main__": main()
