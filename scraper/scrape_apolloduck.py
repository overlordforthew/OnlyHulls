#!/usr/bin/env python3
"""Scrape cruising yacht listings from apolloduck.com.

14,000+ listings. Extract boat data from surrounding HTML context per boat ID.
Note: Apollo Duck CDN images are hotlink-protected (return 400 from external referers).

Usage:
    python scrape_apolloduck.py [limit]    # default: 100
"""

import json
import re
import sys

from scrapling import Fetcher

BASE = "https://www.apolloduck.com"
LIST_URL = f"{BASE}/boats-for-sale/sailing-yachts/cruising-yachts"

fetcher = Fetcher()


def scrape_page(url):
    """Scrape boat listings by extracting data from HTML context around each boat ID."""
    page = fetcher.get(url, timeout=20)
    if page.status != 200:
        print(f"  HTTP {page.status}")
        return [], False

    html = page.body.decode("utf-8", errors="replace")

    # Find all unique boat IDs and their slugs
    links = re.findall(r'/boat/([^"]+)-for-sale/(\d+)', html)
    seen_ids = {}
    for slug, bid in links:
        if bid not in seen_ids:
            seen_ids[bid] = slug

    boats = []
    for bid, slug in seen_ids.items():
        boat = {
            "url": f"{BASE}/boat/{slug}-for-sale/{bid}",
        }

        # Name from slug: "morecambe-bay-prawner-42" → "Morecambe Bay Prawner 42"
        name = slug.replace("-", " ").title()
        # Clean up common noise
        name = re.sub(r'\bFor Sale\b', '', name, flags=re.I).strip()
        boat["name"] = name

        # Extract data from HTML context around this boat ID
        # Find all occurrences and grab surrounding text
        contexts = []
        for m in re.finditer(re.escape(bid), html):
            start = max(0, m.start() - 800)
            end = min(len(html), m.end() + 400)
            contexts.append(html[start:end])

        combined = " ".join(contexts)
        # Strip HTML tags for text analysis
        text = re.sub(r'<[^>]+>', ' ', combined)
        text = re.sub(r'\s+', ' ', text)

        # Year
        year_m = re.search(r'\b(19[6-9]\d|20[0-2]\d)\b', text)
        if year_m:
            boat["year"] = year_m.group(1)

        # Price — look for currency patterns
        price_m = re.search(r'[£$€]\s?[\d,]+(?:\.\d{2})?', text)
        if price_m:
            boat["price"] = price_m.group()

        # Length — meters or feet
        len_m = re.search(r'(\d+(?:\.\d+)?)\s*(?:m\b|metres?)', text, re.I)
        if len_m:
            meters = float(len_m.group(1))
            if 5 < meters < 50:
                boat["length"] = f"{meters * 3.28084:.0f}'"
        if not boat.get("length"):
            len_ft = re.search(r'(\d+(?:\.\d+)?)\s*(?:ft|feet|\')', text, re.I)
            if len_ft:
                boat["length"] = f"{len_ft.group(1)}'"

        # Location — look for country/region patterns
        loc_m = re.search(r'(?:Location|Based|Lying)[:\s]+([A-Za-z\s,]+?)(?:\s*[|<]|\s{2,})', text)
        if loc_m:
            boat["location"] = loc_m.group(1).strip()

        # No images — Apollo Duck CDN is hotlink-protected
        boat["images"] = []

        if boat.get("name"):
            boats.append(boat)

    # Pagination
    has_next = bool(re.search(r'next=\d+', html))

    return boats, has_next


def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 100
    all_boats = []
    offset = 0

    print(f"Scraping ApolloDuck.com cruising yachts (limit={limit})...")

    while len(all_boats) < limit:
        url = f"{LIST_URL}?next={offset}&sort=0&fx=USD&limit=20" if offset > 0 else f"{LIST_URL}?sort=0&fx=USD&limit=20"
        print(f"  Offset {offset}...", end=" ")

        boats, has_next = scrape_page(url)
        if not boats:
            print("no results")
            break

        all_boats.extend(boats)
        print(f"{len(boats)} boats (total: {len(all_boats)})")

        offset += 20
        if not has_next or len(all_boats) >= limit:
            break

    all_boats = all_boats[:limit]

    output_path = "/tmp/scraped_apolloduck.json"
    with open(output_path, "w") as f:
        json.dump(all_boats, f, indent=2)

    print(f"\nDone! {len(all_boats)} boats saved to {output_path}")
    for b in all_boats[:5]:
        name = b.get("name", "?")
        price = b.get("price", "N/A")
        year = b.get("year", "?")
        print(f"  {year} {name} | {price}")


if __name__ == "__main__":
    main()
