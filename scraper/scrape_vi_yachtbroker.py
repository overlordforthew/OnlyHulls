#!/usr/bin/env python3
"""Scrape catamaran listings from virginislandsyachtbroker.com via Playwright DOM queries."""
import json, re, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from pw_fetch import PlaywrightFetcher

BASE = "https://www.virginislandsyachtbroker.com"

def scrape(limit=30):
    boats = []
    with PlaywrightFetcher() as pf:
        page = pf.get_page(BASE, wait_ms=5000)
        try:
            # Get all yacht card elements
            cards = page.query_selector_all('a[href*="/yachts/"]')
            seen = set()
            for card in cards:
                href = card.get_attribute("href") or ""
                if not re.search(r'/yachts/(?:catamaran|monohull|power)/', href): continue
                slug = href.rstrip("/").split("/")[-1]
                if slug in seen: continue
                seen.add(slug)

                text = card.inner_text() or ""
                boat = {"url": BASE + href if href.startswith("/") else href}

                # Name from slug: "2026-bali-4" → "Bali 4"
                name = slug.replace("-", " ").title()
                year_m = re.match(r'^(\d{4})\s+', name)
                if year_m:
                    boat["year"] = year_m.group(1)
                    name = name[len(year_m.group()):].strip()
                boat["name"] = name

                # Price from card text — may have space: "$ 149,000"
                price_m = re.search(r'\$\s*([\d,]{4,})', text)
                if price_m: boat["price"] = f"${price_m.group(1)}"

                # Location
                loc_m = re.search(r'(Virgin Islands|Grenada|Saint\s+\w+|Tortola|BVI|Antigua)', text, re.I)
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
    print(f"Done! {len(boats)} boats")
    for b in boats[:5]:
        print(f"  {b.get('year','?')} {b.get('name','?')[:35]:<35} | {b.get('price','?'):<20}")

if __name__ == "__main__": main()
