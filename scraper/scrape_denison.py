#!/usr/bin/env python3
"""Scrape yacht listings from denisonyachtsales.com.

16,793 listings. SSR with prices in EUR/USD.

Usage: python scrape_denison.py [limit]
"""
import json, re, sys
from scrapling import Fetcher

BASE = "https://www.denisonyachtsales.com"
LIST_URL = f"{BASE}/yachts-for-sale"
fetcher = Fetcher()

def scrape_page(url):
    page = fetcher.get(url, timeout=20)
    if page.status != 200: return [], False
    html = page.body.decode("utf-8", errors="replace")

    # Links: /yachts-for-sale/{slug}
    links = re.findall(r'/yachts-for-sale/([a-z0-9-]+)', html)
    seen, boats = set(), []
    for slug in links:
        if slug in seen or not slug or slug == "search": continue
        seen.add(slug)
        boat = {"url": f"{BASE}/yachts-for-sale/{slug}"}

        ctx_parts = []
        for m in re.finditer(re.escape(slug), html):
            s, e = max(0, m.start()-500), min(len(html), m.end()+300)
            ctx_parts.append(html[s:e])
        ctx = re.sub(r'<[^>]+>', ' ', " ".join(ctx_parts))
        ctx = re.sub(r'\s+', ' ', ctx)

        # Name from slug: "luna-375-custom" or "alfa-nero-269-oceanco"
        name = slug.replace("-", " ").title()
        boat["name"] = name

        # Year
        year_m = re.search(r'\b(19[5-9]\d|20[0-2]\d)\b', ctx)
        if year_m: boat["year"] = year_m.group(1)

        # Price
        price_m = re.search(r'(?:€|EUR)\s*([\d,]+(?:\.\d+)?)', ctx)
        if not price_m: price_m = re.search(r'\$([\d,]+(?:\.\d+)?)', ctx)
        if price_m: boat["price"] = price_m.group(0).strip()

        # Length from slug or context: "375" in "luna-375-custom"
        len_m = re.search(r'-(\d{2,3})-', slug)
        if len_m:
            ft = int(len_m.group(1))
            if 25 <= ft <= 500: boat["length"] = f"{ft}'"

        # Location
        loc_m = re.search(r'([A-Z][a-z]+(?:\s[A-Z][a-z]+)*,\s*[A-Z][a-z]+)', ctx)
        if loc_m: boat["location"] = loc_m.group(1)

        boat["images"] = []
        if boat.get("name") and boat.get("price"): boats.append(boat)

    has_next = bool(re.search(r'page=\d+|next|load.more', html, re.I))
    return boats, has_next

def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    print(f"Scraping denisonyachtsales.com (limit={limit})...")
    boats, _ = scrape_page(LIST_URL)
    boats = boats[:limit]
    with open("/tmp/scraped_denison.json", "w") as f: json.dump(boats, f, indent=2)
    print(f"Done! {len(boats)} boats saved")

if __name__ == "__main__": main()
