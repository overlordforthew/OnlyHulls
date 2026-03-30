#!/usr/bin/env python3
"""Scrape catamaran/trimaran classifieds from multihulls-4sale.com.

EUR/USD prices, French site with English version.

Usage: python scrape_multihulls4sale.py [limit]
"""
import json, re, sys
from scrapling import Fetcher

BASE = "https://www.multihulls-4sale.com"
LIST_URL = f"{BASE}/en/pre-owned/"
fetcher = Fetcher()

def scrape_page(url):
    page = fetcher.get(url, timeout=20)
    if page.status != 200: return []
    html = page.body.decode("utf-8", errors="replace")

    # Links: /en/pre-owned/.../slug-{id} or /en/detail/{id}
    links = re.findall(r'/en/(?:pre-owned/[^"]*?|detail/)(\d{4})', html)
    seen, boats = set(), []

    for bid in links:
        if bid in seen: continue
        seen.add(bid)

        ctx_parts = []
        for m in re.finditer(bid, html):
            s, e = max(0, m.start()-600), min(len(html), m.end()+300)
            ctx_parts.append(html[s:e])
        ctx = re.sub(r'<[^>]+>', ' ', " ".join(ctx_parts))
        ctx = re.sub(r'\s+', ' ', ctx)

        boat = {}

        # URL — find the full href
        url_m = re.search(rf'/en/(?:pre-owned/[^"]*?|detail/){bid}[^"]*', html)
        if url_m: boat["url"] = BASE + url_m.group(0)
        else: boat["url"] = f"{BASE}/en/detail/{bid}"

        # Name — look for boat model names
        name_m = re.search(r'((?:Lagoon|Leopard|Bali|Catana|Nautitech|Tag|Silhouette|Transcat|Privilege|Outremer|Fontaine Pajot|FP|Neel)\s*[\d.]+\w*)', ctx, re.I)
        if name_m:
            boat["name"] = name_m.group(1).strip()
        else:
            # Fallback: first capitalized phrase
            name_m = re.search(r'([A-Z][A-Za-z]+(?:\s+[A-Za-z0-9.]+){0,3})', ctx)
            if name_m: boat["name"] = name_m.group(1).strip()

        # Price
        price_m = re.search(r'([\d,]+(?:\.\d+)?)\s*(?:EUR|€)', ctx)
        if price_m:
            boat["price"] = f"€{price_m.group(1)}"
        else:
            price_m = re.search(r'([\d,]+(?:\.\d+)?)\s*(?:USD|\$)', ctx)
            if price_m: boat["price"] = f"${price_m.group(1)}"

        # Year
        year_m = re.search(r'\b(19[89]\d|20[0-2]\d)\b', ctx)
        if year_m: boat["year"] = year_m.group(1)

        # Location
        loc_m = re.search(r'(France|Spain|Greece|Martinique|Guadeloupe|Mayotte|French Polynesia|Corsica|Italy|Croatia|Turkey)', ctx, re.I)
        if loc_m: boat["location"] = loc_m.group(1)

        boat["images"] = []
        if boat.get("name") and boat.get("price"): boats.append(boat)

    return boats

def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    print(f"Scraping multihulls-4sale.com (limit={limit})...")
    boats = scrape_page(LIST_URL)[:limit]
    with open("/tmp/scraped_multihulls4sale.json", "w") as f: json.dump(boats, f, indent=2)
    print(f"Done! {len(boats)} boats saved")

if __name__ == "__main__": main()
