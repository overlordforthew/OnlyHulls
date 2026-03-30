#!/usr/bin/env python3
"""Scrape cruising catamarans from catamaransite.com via Playwright DOM card parsing."""
import json, re, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from pw_fetch import PlaywrightFetcher

BASE = "https://www.catamaransite.com"

def scrape(limit=30):
    boats = []
    with PlaywrightFetcher() as pf:
        page = pf.get_page(f"{BASE}/yachts-for-sale/", wait_ms=10000, timeout=60000)
        try:
            cards = page.query_selector_all('.card')
            for card in cards:
                text = card.inner_text() or ""
                # Find the detail link within the card
                link = card.query_selector('a[href*="yachts-for-sale/"]')
                if not link: continue
                href = link.get_attribute("href") or ""
                m = re.search(r'/yachts-for-sale/([a-z0-9-]+)/?$', href)
                if not m: continue
                slug = m.group(1)

                boat = {"url": href}

                # Name from slug
                name = slug.replace("-", " ").title()
                name = re.sub(r'\s+\d+$', '', name)  # Strip WP suffix
                boat["name"] = name

                # Price — "ASKING $91,000 (USD)" or "$2,350,000"
                price_m = re.search(r'\$([\d,]{3,})', text) or re.search(r'€([\d,]{3,})', text)
                if price_m:
                    sym = "$" if "$" in price_m.group(0) else "€"
                    boat["price"] = f"{sym}{price_m.group(1)}"

                # Year
                year_m = re.search(r'\b(19[6-9]\d|20[0-2]\d)\b', text)
                if year_m: boat["year"] = year_m.group(1)

                # Location — after "LOCATION" label or in parentheses
                loc_m = re.search(r'LOCATION\s*\n?\s*(.+?)(?:\n|$)', text)
                if loc_m: boat["location"] = loc_m.group(1).strip()[:50]
                elif not boat.get("location"):
                    loc_m = re.search(r'\(([A-Z][a-zA-Z\s,]+)\)', text)
                    if loc_m: boat["location"] = loc_m.group(1).strip()

                boat["images"] = []
                if boat.get("price") and boat.get("name"):
                    boats.append(boat)
        finally:
            page.close()
    return boats[:limit]

def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 50
    print(f"Scraping catamaransite.com (limit={limit})...")
    boats = scrape(limit)
    with open("/tmp/scraped_catamaransite.json", "w") as f: json.dump(boats, f, indent=2)
    print(f"Done! {len(boats)} boats")
    for b in boats[:5]:
        print(f"  {b.get('year','?')} {b.get('name','?')[:35]:<35} | {b.get('price','?'):<20} | {b.get('location','?')}")

if __name__ == "__main__": main()
