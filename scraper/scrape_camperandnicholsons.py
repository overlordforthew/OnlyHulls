#!/usr/bin/env python3
"""Scrape superyacht listings from camperandnicholsons.com.

Usage: python scrape_camperandnicholsons.py [limit]
"""
import json, re, sys
from scrapling import Fetcher

BASE = "https://www.camperandnicholsons.com"
LIST_URL = f"{BASE}/buy-a-yacht"
fetcher = Fetcher()

def scrape_page(url):
    page = fetcher.get(url, timeout=20)
    if page.status != 200: return []
    html = page.body.decode("utf-8", errors="replace")

    # Links: /buy-a-yacht/{slug}
    links = re.findall(r'/buy-a-yacht/([a-z0-9-]+)', html)
    seen, boats = set(), []
    for slug in links:
        if slug in seen or slug in ("", "search"): continue
        seen.add(slug)
        boat = {"url": f"{BASE}/buy-a-yacht/{slug}"}

        # Extract from surrounding HTML context
        idx = html.find(slug)
        if idx < 0: continue
        ctx = re.sub(r'<[^>]+>', ' ', html[max(0,idx-500):idx+500])
        ctx = re.sub(r'\s+', ' ', ctx)

        # Name — vessel name from slug (e.g. "vision-benetti-2011")
        parts = slug.split("-")
        # Try to find the vessel name (before builder/year)
        year_m = re.search(r'\b(19[5-9]\d|20[0-2]\d)\b', slug)
        if year_m:
            boat["year"] = year_m.group(1)

        # Name from context — look for all-caps vessel names
        name_m = re.search(r'\b([A-Z][A-Z\s]{2,30})\b', ctx)
        if name_m:
            boat["name"] = name_m.group(1).strip().title()
        else:
            boat["name"] = slug.replace("-", " ").title()

        # Price
        price_m = re.search(r'(?:€|EUR)\s*([\d,]+(?:\.\d+)?)', ctx)
        if not price_m: price_m = re.search(r'\$([\d,]+(?:\.\d+)?)', ctx)
        if price_m: boat["price"] = price_m.group(0).strip()

        # Length in meters
        len_m = re.search(r'(\d+(?:\.\d+)?)\s*[Mm](?:\b|eter)', ctx)
        if len_m:
            meters = float(len_m.group(1))
            if meters > 10: boat["length"] = f"{meters * 3.28084:.0f}'"

        boat["images"] = []
        if boat.get("name") and boat.get("price"): boats.append(boat)

    return boats

def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    print(f"Scraping camperandnicholsons.com (limit={limit})...")
    boats = scrape_page(LIST_URL)[:limit]
    with open("/tmp/scraped_camperandnicholsons.json", "w") as f: json.dump(boats, f, indent=2)
    print(f"Done! {len(boats)} boats saved")

if __name__ == "__main__": main()
