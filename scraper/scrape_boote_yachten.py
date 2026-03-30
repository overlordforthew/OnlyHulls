#!/usr/bin/env python3
"""Scrape boat listings from boote-yachten.de via Playwright (German market)."""
import json, re, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from pw_fetch import PlaywrightFetcher

BASE = "https://www.boote-yachten.de"

def scrape(limit=30):
    boats = []
    with PlaywrightFetcher() as pf:
        page = pf.get_page(BASE, wait_ms=5000)
        try:
            links = page.query_selector_all('a[href*="/de/"]')
            seen = set()
            for link in links:
                href = link.get_attribute("href") or ""
                m = re.search(r'/de/([^"]+?)-s(\d+)$', href)
                if not m: continue
                slug, sid = m.group(1), m.group(2)
                if sid in seen: continue
                seen.add(sid)

                # Walk up DOM to find card with price
                parent = link.evaluate("el => { let p = el.parentElement; while(p && p.innerText.length < 30) p = p.parentElement; return p?.innerText || ''; }")

                boat = {"url": f"{BASE}/de/{slug}-s{sid}"}
                boat["name"] = slug.replace("-", " ").title()

                # German price: "EUR 170.000" or "4.900.000 €"
                price_m = re.search(r'(?:EUR|€)\s*([\d.]+)', parent) or re.search(r'([\d.]+)\s*(?:EUR|€)', parent)
                if price_m:
                    raw = price_m.group(1).replace(".", "")
                    try:
                        val = int(raw)
                        if val > 500: boat["price"] = f"€{val:,}"
                    except: pass

                year_m = re.search(r'\b(19[5-9]\d|20[0-2]\d)\b', parent)
                if year_m: boat["year"] = year_m.group(1)

                len_m = re.search(r'(\d+(?:\.\d+)?)\s*x\s*[\d.]+\s*m', parent)
                if len_m:
                    meters = float(len_m.group(1))
                    if meters > 3: boat["length"] = f"{meters * 3.28084:.0f}'"

                loc_map = {"Deutschland": "Germany", "Spanien": "Spain", "Frankreich": "France",
                           "Italien": "Italy", "Niederlande": "Netherlands", "Kroatien": "Croatia"}
                for de, en in loc_map.items():
                    if de in parent:
                        boat["location"] = en
                        break

                boat["images"] = []
                if boat.get("price") and boat.get("name") and boat.get("year"):
                    boats.append(boat)
        finally:
            page.close()
    return boats[:limit]

def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    print(f"Scraping boote-yachten.de (limit={limit})...")
    boats = scrape(limit)
    with open("/tmp/scraped_boote_yachten.json", "w") as f: json.dump(boats, f, indent=2)
    good = sum(1 for b in boats if b.get("name") and b.get("price") and b.get("year"))
    print(f"Done! {len(boats)} boats, {good}/{len(boats)} integrity")
    for b in boats[:5]:
        print(f"  {b.get('year','?')} {b.get('name','?')[:35]:<35} | {b.get('price','?'):<20} | {b.get('location','?')}")

if __name__ == "__main__": main()
