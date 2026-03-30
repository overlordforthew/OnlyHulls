#!/usr/bin/env python3
"""Scrape boat listings from boote-yachten.de via Playwright (German market, EUR)."""
import json, re, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from pw_fetch import PlaywrightFetcher

BASE = "https://www.boote-yachten.de"

def scrape(limit=30):
    with PlaywrightFetcher() as pf:
        html = pf.get(BASE, wait_ms=3000)
    if not html: return []
    boats = []
    pattern = re.compile(r'href="(/de/([^"]+?)-s(\d+))"')
    seen = set()
    for m in pattern.finditer(html):
        path, slug, sid = m.group(1), m.group(2), m.group(3)
        if sid in seen: continue
        seen.add(sid)
        pos = m.start()
        ctx = re.sub(r'<[^>]+>', ' ', html[max(0,pos-500):pos+1500])
        ctx = re.sub(r'\s+', ' ', ctx)
        boat = {"url": f"{BASE}{path}"}
        boat["name"] = slug.replace("-", " ").title()
        # Price: German format "EUR 170.000" or "4.900.000 EUR"
        price_m = re.search(r'(?:EUR|€)\s*([\d.]+)', ctx) or re.search(r'([\d.]+)\s*(?:EUR|€)', ctx)
        if price_m:
            raw = price_m.group(1).replace(".", "")  # German dots = thousands
            try:
                val = int(raw)
                if val > 500: boat["price"] = f"€{val:,}"
            except: pass
        year_m = re.search(r'\b(19[5-9]\d|20[0-2]\d)\b', ctx)
        if year_m: boat["year"] = year_m.group(1)
        # Length: "15x5m" → 15m → 49'
        len_m = re.search(r'(\d+(?:\.\d+)?)\s*x\s*[\d.]+\s*m', ctx)
        if len_m:
            meters = float(len_m.group(1))
            if meters > 3: boat["length"] = f"{meters * 3.28084:.0f}'"
        # Location (German → English)
        loc_map = {"Deutschland": "Germany", "Spanien": "Spain", "Frankreich": "France",
                   "Italien": "Italy", "Niederlande": "Netherlands", "Kroatien": "Croatia"}
        for de, en in loc_map.items():
            if de in ctx:
                boat["location"] = en
                break
        boat["images"] = []
        if boat.get("price") and boat.get("name") and boat.get("year"): boats.append(boat)
    return boats[:limit]

def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    print(f"Scraping boote-yachten.de (limit={limit})...")
    boats = scrape(limit)
    with open("/tmp/scraped_boote_yachten.json", "w") as f: json.dump(boats, f, indent=2)
    print(f"Done! {len(boats)} boats")
    for b in boats[:5]:
        print(f"  {b.get('year','?')} {b.get('name','?')[:35]:<35} | {b.get('price','?'):<20} | {b.get('location','?')}")

if __name__ == "__main__": main()
