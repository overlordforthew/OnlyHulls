#!/usr/bin/env python3
"""Scrape boat listings from boote-yachten.de (German market).

EUR prices, metric dimensions, SSR.

Usage: python scrape_boote_yachten.py [limit]
"""
import json, re, sys
from scrapling import Fetcher

BASE = "https://www.boote-yachten.de"
fetcher = Fetcher()

def scrape_page(url):
    page = fetcher.get(url, timeout=20)
    if page.status != 200: return []
    html = page.body.decode("utf-8", errors="replace")

    # Links: /de/{slug}-s{id}
    links = re.findall(r'/de/([^"]+?)-s(\d+)', html)
    seen, boats = {}, []
    for slug, sid in links:
        if sid in seen: continue
        seen[sid] = True
        boat = {"url": f"{BASE}/de/{slug}-s{sid}"}

        ctx_parts = []
        for m in re.finditer(f's{sid}', html):
            s, e = max(0, m.start()-500), min(len(html), m.end()+300)
            ctx_parts.append(html[s:e])
        ctx = re.sub(r'<[^>]+>', ' ', " ".join(ctx_parts))
        ctx = re.sub(r'\s+', ' ', ctx)

        # Name from slug
        name = slug.replace("-", " ").title()
        boat["name"] = name

        # Price (EUR)
        price_m = re.search(r'([\d.]+(?:,\d+)?)\s*(?:EUR|€)', ctx)
        if price_m:
            # German format: 170.000 EUR or 14.999 EUR
            raw = price_m.group(1).replace(".", "").replace(",", ".")
            try:
                val = float(raw)
                if val > 500: boat["price"] = f"€{val:,.0f}"
            except: pass

        # Year
        year_m = re.search(r'\b(19[5-9]\d|20[0-2]\d)\b', ctx)
        if year_m: boat["year"] = year_m.group(1)
        # Skip "Neuboot" (new boat without year)

        # Length — German format: "15x5m" or "8.48x2.94m"
        len_m = re.search(r'(\d+(?:\.\d+)?)\s*x\s*[\d.]+\s*m', ctx)
        if len_m:
            meters = float(len_m.group(1))
            if meters > 3: boat["length"] = f"{meters * 3.28084:.0f}'"

        # Location (German country names)
        loc_map = {"Deutschland": "Germany", "Spanien": "Spain", "Frankreich": "France",
                   "Italien": "Italy", "Niederlande": "Netherlands", "Kroatien": "Croatia",
                   "Griechenland": "Greece", "Türkei": "Turkey"}
        for de, en in loc_map.items():
            if de in ctx:
                boat["location"] = en
                break

        boat["images"] = []
        if boat.get("name") and boat.get("price") and boat.get("year"): boats.append(boat)

    return boats

def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    print(f"Scraping boote-yachten.de (limit={limit})...")
    boats = scrape_page(BASE)[:limit]
    with open("/tmp/scraped_boote_yachten.json", "w") as f: json.dump(boats, f, indent=2)
    print(f"Done! {len(boats)} boats saved")

if __name__ == "__main__": main()
