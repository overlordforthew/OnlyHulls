#!/usr/bin/env python3
"""Scrape charter exit fleet from dreamyachtsales.com via Playwright DOM."""
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
                # Find cards containing boat links
                cards = page.query_selector_all('a[href*="/pre-owned-yachts/listings/"]')
                if not cards: break

                new_count = 0
                seen_slugs = set()
                for card in cards:
                    href = card.get_attribute("href") or ""
                    m = re.search(r'/pre-owned-yachts/listings/([a-z][a-z0-9-]{2,})/?', href)
                    if not m: continue
                    slug = m.group(1)
                    if slug in seen_slugs or slug.startswith("page") or slug.startswith("gf_"): continue
                    seen_slugs.add(slug)

                    text = card.inner_text() or ""
                    parent = card.evaluate("el => el.closest('article, .card, div')?.innerText || ''")
                    if len(parent) > len(text): text = parent

                    boat = {"url": f"{BASE}/pre-owned-yachts/listings/{slug}/"}
                    boat["name"] = slug.replace("-", " ").title()

                    # Price — EUR format: "350.000,00 € incl." or "€350,000"
                    price_m = re.search(r'([\d.]+(?:,\d+)?)\s*€', text) or re.search(r'€\s*([\d,.]+)', text) or re.search(r'([\d.]+(?:,\d+)?)\s*EUR', text, re.I)
                    if price_m:
                        raw = price_m.group(1)
                        # German format: 350.000,00 → 350000
                        if '.' in raw and ',' in raw:
                            raw = raw.replace('.', '').replace(',', '.')
                        elif raw.count('.') > 1:
                            raw = raw.replace('.', '')
                        try:
                            val = float(re.sub(r'[^0-9.]', '', raw))
                            if val > 500: boat["price"] = f"€{val:,.0f}"
                        except: pass

                    year_m = re.search(r'\b(201[0-9]|202[0-6])\b', text)
                    if year_m: boat["year"] = year_m.group(1)

                    # Model from text
                    model_m = re.search(r'(Lagoon|Bali|Dufour|Nautitech|Astrea|Fountaine|Leopard|Lucia)\s*[\d.]*\w*', text, re.I)
                    if model_m: boat["name"] = f"{boat['name']} ({model_m.group(0).strip()})"

                    loc_m = re.search(r'(Martinique|Guadeloupe|Grenada|Saint Lucia|Croatia|Greece|Turkey|France)', text, re.I)
                    if loc_m: boat["location"] = loc_m.group(1)

                    boat["images"] = []
                    if boat.get("price") and boat.get("name"):
                        boats.append(boat)
                        new_count += 1
            finally:
                page.close()

            if new_count == 0: break
            page_num += 1
            if page_num > 15: break

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
