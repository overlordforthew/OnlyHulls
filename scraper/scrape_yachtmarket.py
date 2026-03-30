#!/usr/bin/env python3
"""Scrape sailing yacht listings from theyachtmarket.com.

5,700 verified sail listings. Prices/specs in HTML context around each boat ID.

Usage:
    python scrape_yachtmarket.py [limit]    # default: 100
"""

import json
import re
import sys

from scrapling import Fetcher

BASE = "https://www.theyachtmarket.com"
LIST_URL = f"{BASE}/en/boats-for-sale/type/sailing-boat/?condition=used"

fetcher = Fetcher()


def scrape_page(url):
    """Scrape listings by extracting data from HTML context around each boat detail URL."""
    page = fetcher.get(url, timeout=20)
    if page.status != 200:
        print(f"  HTTP {page.status}")
        return [], False

    html = page.body.decode("utf-8", errors="replace")

    # Find all detail page links: /en/boats-for-sale/{make}/{model}/id{number}/
    links = re.findall(r'/en/boats-for-sale/([^/]+)/([^/]+)/id(\d+)/', html)
    seen_ids = {}
    for make_slug, model_slug, bid in links:
        if bid not in seen_ids:
            seen_ids[bid] = (make_slug, model_slug)

    boats = []
    for bid, (make_slug, model_slug) in seen_ids.items():
        boat = {
            "url": f"{BASE}/en/boats-for-sale/{make_slug}/{model_slug}/id{bid}/",
        }

        # Name from URL slugs
        make = make_slug.replace("-", " ").title()
        model = model_slug.replace("-", " ").title()
        # Remove "Id12345" from model if present
        model = re.sub(r'\bId\d+\b', '', model).strip()
        boat["name"] = f"{make} {model}".strip() if model else make

        # Extract data from surrounding HTML context
        contexts = []
        for m in re.finditer(f'id{bid}', html):
            start = max(0, m.start() - 600)
            end = min(len(html), m.end() + 400)
            contexts.append(html[start:end])

        combined = " ".join(contexts)
        text = re.sub(r'<[^>]+>', ' ', combined)
        text = re.sub(r'\s+', ' ', text)

        # Year — from pipe-separated specs: "2008 | 17.70m | Diesel"
        year_m = re.search(r'\b(19[6-9]\d|20[0-2]\d)\b', text)
        if year_m:
            boat["year"] = year_m.group(1)

        # Price
        price_m = re.search(r'[£$€]\s?[\d,]+(?:\.\d{2})?', text)
        if price_m:
            boat["price"] = price_m.group()

        # Length — meters (convert to feet)
        len_m = re.search(r'(\d+(?:\.\d+)?)\s*m\b', text)
        if len_m:
            meters = float(len_m.group(1))
            if 5 < meters < 50:
                boat["length"] = f"{meters * 3.28084:.0f}'"

        # Location
        loc_patterns = [
            r'(?:Location|Based|Lying)[:\s]+([A-Za-z\s,]+?)(?:\s*[|<]|\s{2,})',
            r'([A-Z][a-z]+(?:\s[A-Z][a-z]+)*,\s*[A-Z][a-z]+(?:\s[A-Z][a-z]+)*)',
        ]
        for pat in loc_patterns:
            loc_m = re.search(pat, text)
            if loc_m:
                loc = loc_m.group(1).strip()
                if len(loc) > 3 and not re.match(r'\d', loc):
                    boat["location"] = loc
                    break

        # Images — lazy-loaded from CDN
        images = []
        for img_m in re.finditer(r'((?:https?:)?//cdnx\.theyachtmarket\.com/img/[^"\'>\s]+)', combined):
            img_url = img_m.group(1)
            if img_url.startswith("//"):
                img_url = "https:" + img_url
            if img_url not in images:
                images.append(img_url)
        boat["images"] = images[:5]

        if boat.get("name"):
            boats.append(boat)

    # Check for next page
    has_next = bool(re.search(r'page=\d+', html))

    return boats, has_next


def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 100
    all_boats = []
    page_num = 1

    print(f"Scraping TheYachtMarket.com (limit={limit})...")

    while len(all_boats) < limit:
        url = f"{LIST_URL}&page={page_num}" if page_num > 1 else LIST_URL
        print(f"  Page {page_num}...", end=" ")

        boats, has_next = scrape_page(url)
        if not boats:
            print("no results")
            break

        all_boats.extend(boats)
        print(f"{len(boats)} boats (total: {len(all_boats)})")

        if not has_next or len(all_boats) >= limit:
            break
        page_num += 1

    all_boats = all_boats[:limit]

    output_path = "/tmp/scraped_yachtmarket.json"
    with open(output_path, "w") as f:
        json.dump(all_boats, f, indent=2)

    print(f"\nDone! {len(all_boats)} boats saved to {output_path}")
    for b in all_boats[:5]:
        name = b.get("name", "?")
        price = b.get("price", "N/A")
        year = b.get("year", "?")
        loc = b.get("location", "?")
        imgs = len(b.get("images", []))
        print(f"  {year} {name} | {price} | {loc} | {imgs} photos")


if __name__ == "__main__":
    main()
