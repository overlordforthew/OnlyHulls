#!/usr/bin/env python3
"""Scrape multihull listings from multihullcompany.com via Playwright DOM."""
import json, re, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from pw_fetch import PlaywrightFetcher

BASE = "https://www.multihullcompany.com"

def scrape(limit=30):
    boats = []
    with PlaywrightFetcher() as pf:
        page = pf.get_page(BASE, wait_ms=5000)
        try:
            # Get all boat detail links
            links = page.query_selector_all('a[href*="/boat/"]')
            seen = set()
            for link in links:
                href = link.get_attribute("href") or ""
                m = re.search(r'/boat/(.+?)-(\d{5,})/', href)
                if not m: continue
                slug, bid = m.group(1), m.group(2)
                if bid in seen: continue
                seen.add(bid)

                # Get the card's parent element text for context
                text = link.inner_text() or ""
                # Also try parent
                parent = link.evaluate("el => el.closest('.slick-slide, .card, article, div')?.innerText || ''")
                if len(parent) > len(text): text = parent

                boat = {"url": f"{BASE}/boat/{slug}-{bid}/"}
                boat["name"] = slug.replace("-", " ").title()

                # Price
                price_m = re.search(r'\$\s*([\d,]{4,})', text) or re.search(r'€\s*([\d,]{4,})', text) or re.search(r'US\$\s*([\d,]{4,})', text)
                if price_m:
                    sym = "€" if "€" in price_m.group(0) else "$"
                    boat["price"] = f"{sym}{price_m.group(1)}"

                year_m = re.search(r'\b(19[5-9]\d|20[0-2]\d)\b', text)
                if year_m: boat["year"] = year_m.group(1)

                len_m = re.search(r'(\d+(?:\.\d+)?)\s*(?:ft|\')', text, re.I)
                if len_m: boat["length"] = f"{len_m.group(1)}'"

                loc_m = re.search(r'([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)', text)
                if loc_m and len(loc_m.group(1)) > 3: boat["location"] = loc_m.group(1)

                boat["images"] = []
                if boat.get("price") and boat.get("name"):
                    boats.append(boat)
        finally:
            page.close()
    return boats[:limit]

def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    print(f"Scraping multihullcompany.com (limit={limit})...")
    boats = scrape(limit)
    with open("/tmp/scraped_multihullcompany.json", "w") as f: json.dump(boats, f, indent=2)
    print(f"Done! {len(boats)} boats")
    for b in boats[:5]:
        print(f"  {b.get('year','?')} {b.get('name','?')[:35]:<35} | {b.get('price','?'):<20} | {b.get('length','?')}")

if __name__ == "__main__": main()
