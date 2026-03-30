#!/usr/bin/env python3
"""Scrape sailing yachts from apolloduck.us via Playwright (prices in JS)."""
import json, re, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from pw_fetch import PlaywrightFetcher

BASE = "https://www.apolloduck.us"

def scrape(limit=30):
    with PlaywrightFetcher() as pf:
        all_boats, offset = [], 0
        while len(all_boats) < limit:
            url = f"{BASE}/boats-for-sale/sailing-yachts?next={offset}&sort=0&fx=USD&limit=20" if offset else f"{BASE}/boats-for-sale/sailing-yachts?sort=0&fx=USD&limit=20"
            html = pf.get(url, wait_ms=3000)
            if not html: break
            pattern = re.compile(r'/boat/([^"]+)-for-sale/(\d+)')
            seen_this = set()
            new = 0
            for m in pattern.finditer(html):
                slug, bid = m.group(1), m.group(2)
                if bid in seen_this or bid in {b.get("id") for b in all_boats}: continue
                seen_this.add(bid)
                pos = m.start()
                ctx = re.sub(r'<[^>]+>', ' ', html[max(0,pos-800):pos+800])
                ctx = re.sub(r'\s+', ' ', ctx)
                boat = {"id": bid, "url": f"{BASE}/boat/{slug}-for-sale/{bid}"}
                name = slug.replace("-", " ").title()
                boat["name"] = re.sub(r'\bFor Sale\b', '', name, flags=re.I).strip()
                price_m = re.search(r'\$([\d,]{4,})', ctx)
                if price_m: boat["price"] = f"${price_m.group(1)}"
                year_m = re.search(r'\b(19[5-9]\d|20[0-2]\d)\b', ctx)
                if year_m: boat["year"] = year_m.group(1)
                len_m = re.search(r"(\d+)['\s]*(?:\d+)?[\"']?\s*(?:ft|feet|')", ctx, re.I)
                if len_m: boat["length"] = f"{len_m.group(1)}'"
                loc_m = re.search(r'([A-Z][a-z]+(?:\s[A-Z][a-z]+)*,\s*(?:USA|[A-Z]{2}))', ctx)
                if loc_m: boat["location"] = loc_m.group(1)
                boat["images"] = []
                if boat.get("price") and boat.get("name"):
                    all_boats.append(boat)
                    new += 1
            if new == 0: break
            offset += 20
    return all_boats[:limit]

def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    print(f"Scraping apolloduck.us (limit={limit})...")
    boats = scrape(limit)
    with open("/tmp/scraped_apolloduck_us.json", "w") as f: json.dump(boats, f, indent=2)
    print(f"Done! {len(boats)} boats")
    for b in boats[:5]:
        print(f"  {b.get('year','?')} {b.get('name','?')[:35]:<35} | {b.get('price','?'):<20} | {b.get('length','?')}")

if __name__ == "__main__": main()
