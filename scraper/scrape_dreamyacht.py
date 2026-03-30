#!/usr/bin/env python3
"""Scrape charter exit fleet from dreamyachtsales.com via Playwright DOM queries."""
import json, re, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from pw_fetch import PlaywrightFetcher

BASE = "https://www.dreamyachtsales.com"

def scrape(limit=30):
    boats = []
    with PlaywrightFetcher() as pf:
        page_num = 1
        while len(boats) < limit:
            url = f"{BASE}/pre-owned-yachts/listings/page/{page_num}/" if page_num > 1 else f"{BASE}/pre-owned-yachts/listings/"
            page = pf.get_page(url, wait_ms=5000)
            try:
                html = page.content()
                # Find listing links
                links = re.findall(r'href="(/pre-owned-yachts/listings/([a-z0-9-]+)/)"', html)
                if not links: break

                seen = set()
                for path, slug in links:
                    if slug in seen or slug in ("page",): continue
                    seen.add(slug)

                    # Get card context from rendered HTML
                    idx = html.find(slug)
                    if idx < 0: continue
                    ctx = re.sub(r'<[^>]+>', ' ', html[max(0,idx-500):idx+800])
                    ctx = re.sub(r'\s+', ' ', ctx)

                    boat = {"url": f"{BASE}{path}"}
                    boat["name"] = slug.replace("-", " ").title()

                    # Price — EUR format: "350.000,00 EUR" or "€350,000"
                    price_m = re.search(r'€\s*([\d.,]+)', ctx) or re.search(r'([\d.]+(?:,\d+)?)\s*EUR', ctx)
                    if price_m:
                        raw = price_m.group(1) if price_m.group(1) else price_m.group(0)
                        # Handle German format: 350.000 → 350000
                        if '.' in raw and ',' in raw:
                            raw = raw.replace('.', '').replace(',', '.')
                        elif raw.count('.') > 1:
                            raw = raw.replace('.', '')
                        try:
                            val = float(re.sub(r'[^0-9.]', '', raw))
                            if val > 500: boat["price"] = f"€{val:,.0f}"
                        except: pass

                    year_m = re.search(r'\b(201[0-9]|202[0-6])\b', ctx)
                    if year_m: boat["year"] = year_m.group(1)

                    loc_m = re.search(r'(Martinique|Guadeloupe|Grenada|St\.\s*Martin|France|Croatia|Greece|Turkey|Saint Lucia)', ctx, re.I)
                    if loc_m: boat["location"] = loc_m.group(1)

                    boat["images"] = []
                    if boat.get("price") and boat.get("name"):
                        boats.append(boat)
            finally:
                page.close()

            page_num += 1
            if page_num > 15: break  # Safety limit

    return boats[:limit]

def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    print(f"Scraping dreamyachtsales.com (limit={limit})...")
    boats = scrape(limit)
    with open("/tmp/scraped_dreamyacht.json", "w") as f: json.dump(boats, f, indent=2)
    print(f"Done! {len(boats)} boats")
    for b in boats[:5]:
        print(f"  {b.get('year','?')} {b.get('name','?')[:35]:<35} | {b.get('price','?'):<20}")

if __name__ == "__main__": main()
