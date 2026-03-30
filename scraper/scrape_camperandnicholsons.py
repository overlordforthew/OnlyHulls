#!/usr/bin/env python3
"""Scrape superyacht listings from camperandnicholsons.com via Playwright DOM."""
import json, re, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from pw_fetch import PlaywrightFetcher

BASE = "https://www.camperandnicholsons.com"

def scrape(limit=30):
    boats = []
    with PlaywrightFetcher() as pf:
        page = pf.get_page(f"{BASE}/buy-a-yacht/yachts-for-sale", wait_ms=8000, timeout=60000)
        try:
            links = page.query_selector_all('a[href*="/buy-a-yacht/yachts-for-sale/"]')
            seen = set()
            for link in links:
                href = link.get_attribute("href") or ""
                m = re.search(r'/buy-a-yacht/yachts-for-sale/([a-z][a-z0-9-]+-\d{4})', href)
                if not m: continue
                slug = m.group(1)
                if slug in seen: continue
                seen.add(slug)

                parent_text = link.evaluate("el => el.closest('div, article, li')?.innerText || ''")

                year_m = re.search(r'(\d{4})$', slug)
                year = year_m.group(1) if year_m else None
                name = slug.rsplit(f"-{year}", 1)[0].replace("-", " ").title() if year else slug.replace("-", " ").title()

                boat = {"url": f"{BASE}/buy-a-yacht/yachts-for-sale/{slug}", "name": name}
                if year: boat["year"] = year

                price_m = re.search(r'€\s*([\d,]+)', parent_text) or re.search(r'\$\s*([\d,]+)', parent_text)
                if price_m:
                    sym = "€" if "€" in price_m.group(0) else "$"
                    boat["price"] = f"{sym}{price_m.group(1)}"

                len_m = re.search(r'(\d+(?:\.\d+)?)\s*M\b', parent_text)
                if len_m:
                    meters = float(len_m.group(1))
                    if meters > 10: boat["length"] = f"{meters * 3.28084:.0f}'"

                boat["images"] = []
                if boat.get("price") and boat.get("name"):
                    boats.append(boat)
        finally:
            page.close()
    return boats[:limit]

def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    print(f"Scraping camperandnicholsons.com (limit={limit})...")
    boats = scrape(limit)
    with open("/tmp/scraped_camperandnicholsons.json", "w") as f: json.dump(boats, f, indent=2)
    good = sum(1 for b in boats if b.get("name") and b.get("price") and b.get("year"))
    print(f"Done! {len(boats)} boats, {good}/{len(boats)} integrity")
    for b in boats[:5]:
        print(f"  {b.get('year','?')} {b.get('name','?')[:35]:<35} | {b.get('price','?'):<20} | {b.get('length','?')}")

if __name__ == "__main__": main()
