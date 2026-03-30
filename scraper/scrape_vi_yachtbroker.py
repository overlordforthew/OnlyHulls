#!/usr/bin/env python3
"""Scrape catamaran listings from virginislandsyachtbroker.com via Playwright."""
import json, re, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from pw_fetch import PlaywrightFetcher

BASE = "https://www.virginislandsyachtbroker.com"

def scrape(limit=30):
    boats = []
    with PlaywrightFetcher() as pf:
        page = pf.get_page(BASE, wait_ms=5000)
        try:
            links = page.query_selector_all('a[href*="/yachts/catamaran/"]')
            seen = set()
            for link in links:
                href = link.get_attribute("href") or ""
                m = re.search(r'/yachts/catamaran/(\d{4}-[a-z0-9-]+)', href)
                if not m: continue
                slug = m.group(1)
                if slug in seen: continue
                seen.add(slug)

                # Get parent div text for price
                parent = link.evaluate("el => { let p = el.parentElement; while(p && p.innerText.length < 30) p = p.parentElement; return p?.innerText || ''; }")

                year_m = re.match(r'(\d{4})', slug)
                year = year_m.group(1) if year_m else None
                name = slug.replace("-", " ").title()
                if year: name = name[5:].strip()  # Remove "2026 " prefix

                boat = {"url": href, "name": name}
                if year: boat["year"] = year

                price_m = re.search(r'\$\s*([\d,]{4,})', parent)
                if price_m: boat["price"] = f"${price_m.group(1)}"

                loc_m = re.search(r'(Virgin Islands|Grenada|Saint\s+\w+|Tortola|BVI|Antigua)', parent, re.I)
                if loc_m: boat["location"] = loc_m.group(1)

                boat["images"] = []
                if boat.get("price") and boat.get("name"):
                    boats.append(boat)
        finally:
            page.close()
    return boats[:limit]

def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    print(f"Scraping virginislandsyachtbroker.com (limit={limit})...")
    boats = scrape(limit)
    with open("/tmp/scraped_vi_yachtbroker.json", "w") as f: json.dump(boats, f, indent=2)
    good = sum(1 for b in boats if b.get("name") and b.get("price") and b.get("year"))
    print(f"Done! {len(boats)} boats, {good}/{len(boats)} integrity")
    for b in boats[:5]:
        print(f"  {b.get('year','?')} {b.get('name','?')[:35]:<35} | {b.get('price','?'):<20}")

if __name__ == "__main__": main()
