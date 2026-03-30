#!/usr/bin/env python3
"""Scrape charter exit fleet from dreamyachtsales.com.

115 listings, EUR prices, paginated SSR.

Usage: python scrape_dreamyacht.py [limit]
"""
import json, re, sys
from scrapling import Fetcher

BASE = "https://www.dreamyachtsales.com"
LIST_URL = f"{BASE}/pre-owned-yachts/listings/"
fetcher = Fetcher()

def scrape_page(url):
    page = fetcher.get(url, timeout=20)
    if page.status != 200: return [], False
    html = page.body.decode("utf-8", errors="replace")

    # Links: /pre-owned-yachts/listings/{slug}/
    links = re.findall(r'/pre-owned-yachts/listings/([a-z0-9-]+)/', html)
    seen, boats = set(), []
    for slug in links:
        if slug in seen or slug in ("", "page"): continue
        seen.add(slug)
        boat = {"url": f"{BASE}/pre-owned-yachts/listings/{slug}/"}

        ctx_parts = []
        for m in re.finditer(re.escape(slug), html):
            s, e = max(0, m.start()-500), min(len(html), m.end()+300)
            ctx_parts.append(html[s:e])
        ctx = re.sub(r'<[^>]+>', ' ', " ".join(ctx_parts))
        ctx = re.sub(r'\s+', ' ', ctx)

        # Name — vessel name from context or slug
        name = slug.replace("-", " ").title()
        boat["name"] = name

        # Model — look for known brands
        model_m = re.search(r'(Lagoon|Bali|Dufour|Nautitech|Astrea|Fountaine Pajot|Leopard|Lucia)\s*\d*\s*\w*', ctx, re.I)
        if model_m:
            boat["name"] = f"{name} ({model_m.group(0).strip()})"

        # Price
        price_m = re.search(r'€\s*([\d,]+)', ctx)
        if not price_m: price_m = re.search(r'EUR\s*([\d,]+)', ctx, re.I)
        if price_m: boat["price"] = f"€{price_m.group(1)}"

        # Year
        year_m = re.search(r'\b(201[0-9]|202[0-6])\b', ctx)
        if year_m: boat["year"] = year_m.group(1)

        # Location
        loc_m = re.search(r'(Martinique|Guadeloupe|Grenada|St\.\s*Martin|Saint\s+\w+|France|Croatia|Greece|Turkey)', ctx, re.I)
        if loc_m: boat["location"] = loc_m.group(1)

        boat["images"] = []
        if boat.get("name") and boat.get("price"): boats.append(boat)

    has_next = bool(re.search(r'facetwp-page.*next|page/\d+', html, re.I))
    return boats, has_next

def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    all_boats, page = [], 1
    print(f"Scraping dreamyachtsales.com (limit={limit})...")
    while len(all_boats) < limit:
        url = f"{LIST_URL}page/{page}/" if page > 1 else LIST_URL
        boats, has_next = scrape_page(url)
        if not boats: break
        all_boats.extend(boats)
        print(f"  Page {page}: {len(boats)} boats (total: {len(all_boats)})")
        if not has_next: break
        page += 1
    all_boats = all_boats[:limit]
    with open("/tmp/scraped_dreamyacht.json", "w") as f: json.dump(all_boats, f, indent=2)
    print(f"Done! {len(all_boats)} boats saved")

if __name__ == "__main__": main()
