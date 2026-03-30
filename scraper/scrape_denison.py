#!/usr/bin/env python3
"""Scrape yacht listings from denisonyachtsales.com using CSS + data attributes."""
import json, re, sys
from scrapling import Fetcher

BASE = "https://www.denisonyachtsales.com"
fetcher = Fetcher()

def scrape(limit=30):
    page = fetcher.get(f"{BASE}/yachts-for-sale", timeout=20)
    if page.status != 200: return []
    html = page.body.decode("utf-8", errors="replace")
    boats = []

    # Each boat card has: <a href="...slug" title="Name Year">
    # And nearby: data-price="€200,000,000"
    # Parse cards by finding <a> tags with boat URLs and title attributes
    card_pattern = re.compile(
        r'<a[^>]*href="(https://www\.denisonyachtsales\.com/yachts-for-sale/([a-z0-9-]+))"'
        r'[^>]*title="([^"]+)"',
        re.DOTALL
    )

    seen = set()
    for m in card_pattern.finditer(html):
        url, slug, title = m.group(1), m.group(2), m.group(3)
        if slug in seen or slug in ("my-dashboard", "search", "boats"): continue
        seen.add(slug)

        # Clean title: "Luna 375&#039; Custom 2010" → "Luna 375' Custom 2010"
        title = title.replace("&#039;", "'").replace("&amp;", "&").strip()

        boat = {"url": url}

        # Name and year from title
        year_m = re.search(r'\b(19[5-9]\d|20[0-2]\d)\b', title)
        if year_m:
            boat["year"] = year_m.group(1)
            # Name = title without year
            name = title.replace(year_m.group(1), "").strip().strip("|").strip()
        else:
            name = title
        boat["name"] = name

        # Length from slug: "luna-375-custom" → 375'
        len_m = re.search(r'-(\d{2,3})-', slug)
        if len_m:
            ft = int(len_m.group(1))
            if 25 <= ft <= 500: boat["length"] = f"{ft}'"

        # Price from data-price near this card (within 3000 chars after the link)
        card_pos = m.end()
        after = html[card_pos:card_pos+3000]
        price_m = re.search(r'data-price="[^"]*?([€$£][\d,]+)', after)
        if not price_m:
            price_m = re.search(r'([€$][\d,]{4,})', after)
        if price_m:
            boat["price"] = price_m.group(1)

        # Location from nearby text
        loc_m = re.search(r'([A-Z][a-z]+(?:\s[A-Z][a-z]+)*,\s*[A-Z][a-z]+)',
                          re.sub(r'<[^>]+>', ' ', after[:500]))
        if loc_m: boat["location"] = loc_m.group(1)

        boat["images"] = []
        if boat.get("price") and boat.get("name"):
            boats.append(boat)

    return boats[:limit]

def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    print(f"Scraping denisonyachtsales.com (limit={limit})...")
    boats = scrape(limit)
    with open("/tmp/scraped_denison.json", "w") as f: json.dump(boats, f, indent=2)
    print(f"Done! {len(boats)} boats")
    for b in boats[:5]:
        print(f"  {b.get('year','?')} {b.get('name','?')[:35]:<35} | {b.get('price','?'):<20} | {b.get('length','?')}")

if __name__ == "__main__": main()
