#!/usr/bin/env python3
"""Scrape multihull listings from multihullworld.com/for-sale.

Usage: python scrape_multihullworld.py [limit]
"""
import json, re, sys
from scrapling import Fetcher

BASE = "https://www.multihullworld.com"
LIST_URL = f"{BASE}/for-sale"
fetcher = Fetcher()

def scrape_page(url):
    page = fetcher.get(url, timeout=20)
    if page.status != 200: return []
    html = page.body.decode("utf-8", errors="replace")

    # Links: /for-sale/{slug}/{id}
    links = re.findall(r'/for-sale/([^"]+?)/(\d{4,})', html)
    seen, boats = {}, []
    for slug, bid in links:
        if bid in seen: continue
        seen[bid] = True
        boat = {"url": f"{BASE}/for-sale/{slug}/{bid}"}

        ctx_parts = []
        for m in re.finditer(bid, html):
            s, e = max(0, m.start()-500), min(len(html), m.end()+300)
            ctx_parts.append(html[s:e])
        ctx = re.sub(r'<[^>]+>', ' ', " ".join(ctx_parts))
        ctx = re.sub(r'\s+', ' ', ctx)

        # Name from slug
        name = slug.replace("-", " ").title()
        year_m = re.match(r'^(\d{4})\s+', name)
        if year_m:
            boat["year"] = year_m.group(1)
            name = name[len(year_m.group()):].strip()
        boat["name"] = name

        # Price (GBP or EUR)
        price_m = re.search(r'[£€]\s*([\d,]+)', ctx)
        if price_m: boat["price"] = price_m.group(0).strip()

        # Length — "16.75m / 55 ft" pattern
        len_m = re.search(r'(\d+(?:\.\d+)?)\s*m\s*/\s*(\d+)\s*ft', ctx)
        if len_m:
            boat["length"] = f"{len_m.group(2)}'"
        else:
            len_m = re.search(r'(\d+(?:\.\d+)?)\s*m\b', ctx)
            if len_m:
                m_val = float(len_m.group(1))
                if 5 < m_val < 50: boat["length"] = f"{m_val * 3.28084:.0f}'"

        boat["images"] = []
        if boat.get("name") and boat.get("price"): boats.append(boat)

    return boats

def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    print(f"Scraping multihullworld.com (limit={limit})...")
    boats = scrape_page(LIST_URL)[:limit]
    with open("/tmp/scraped_multihullworld.json", "w") as f: json.dump(boats, f, indent=2)
    print(f"Done! {len(boats)} boats saved")

if __name__ == "__main__": main()
