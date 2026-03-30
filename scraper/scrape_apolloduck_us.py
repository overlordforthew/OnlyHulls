#!/usr/bin/env python3
"""Scrape sailing yacht listings from apolloduck.us (US site has prices in SSR).

Usage: python scrape_apolloduck_us.py [limit]
"""
import json, re, sys
from scrapling import Fetcher

BASE = "https://www.apolloduck.us"
LIST_URL = f"{BASE}/boats-for-sale/sailing-yachts"
fetcher = Fetcher()

def scrape_page(url):
    page = fetcher.get(url, timeout=20)
    if page.status != 200: return [], False
    html = page.body.decode("utf-8", errors="replace")
    text = re.sub(r'<[^>]+>', ' ', html)

    links = re.findall(r'/boat/([^"]+)-for-sale/(\d+)', html)
    seen, boats = {}, []
    for slug, bid in links:
        if bid in seen: continue
        seen[bid] = True
        boat = {"url": f"{BASE}/boat/{slug}-for-sale/{bid}"}
        name = slug.replace("-", " ").title()
        name = re.sub(r'\bFor Sale\b', '', name, flags=re.I).strip()
        boat["name"] = name

        # Extract from surrounding context
        contexts = []
        for m in re.finditer(re.escape(bid), html):
            s, e = max(0, m.start()-800), min(len(html), m.end()+400)
            contexts.append(html[s:e])
        ctx = re.sub(r'<[^>]+>', ' ', " ".join(contexts))

        year_m = re.search(r'\b(19[5-9]\d|20[0-2]\d)\b', ctx)
        if year_m: boat["year"] = year_m.group(1)

        price_m = re.search(r'\$([\d,]{4,})', ctx)
        if price_m: boat["price"] = f"${price_m.group(1)}"

        len_m = re.search(r"(\d+)['\s]*(?:\d+)?[\"']?\s*(?:ft|feet|')", ctx, re.I)
        if len_m: boat["length"] = f"{len_m.group(1)}'"

        loc_m = re.search(r'([A-Z][a-z]+(?:\s[A-Z][a-z]+)*,\s*(?:USA|FL|CA|NY|TX|MA|MD|CT|WA|OR|SC|NC|GA|ME|RI|NH|VA|NJ|PA|OH|MI|WI|MN|LA|AL|MS|HI))', ctx)
        if loc_m: boat["location"] = loc_m.group(1)

        boat["images"] = []
        if boat.get("name"): boats.append(boat)

    has_next = bool(re.search(r'next=\d+', html))
    return boats, has_next

def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    all_boats, offset = [], 0
    print(f"Scraping apolloduck.us (limit={limit})...")
    while len(all_boats) < limit:
        url = f"{LIST_URL}?next={offset}&sort=0&fx=USD&limit=20" if offset else f"{LIST_URL}?sort=0&fx=USD&limit=20"
        boats, has_next = scrape_page(url)
        if not boats: break
        all_boats.extend(boats)
        print(f"  Offset {offset}: {len(boats)} boats (total: {len(all_boats)})")
        offset += 20
        if not has_next: break
    all_boats = all_boats[:limit]
    with open("/tmp/scraped_apolloduck_us.json", "w") as f: json.dump(all_boats, f, indent=2)
    print(f"Done! {len(all_boats)} boats saved")

if __name__ == "__main__": main()
