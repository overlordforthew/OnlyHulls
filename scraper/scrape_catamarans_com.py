#!/usr/bin/env python3
"""Scrape catamaran listings from catamarans.com.

2,013 verified listings, SSR, clean pagination. World's leading cat brokerage.

Usage:
    python scrape_catamarans_com.py [limit]    # default: 100
"""

import json
import re
import sys

from scrapling import Fetcher

BASE = "https://www.catamarans.com"
LIST_URL = f"{BASE}/catamarans-for-sale/catamarans-all-listing-search-boats"

fetcher = Fetcher()


def scrape_page(url):
    """Scrape a single page of catamaran listings."""
    page = fetcher.get(url, timeout=20)
    if page.status != 200:
        print(f"  HTTP {page.status}")
        return [], False

    boats = []
    html = page.body.decode("utf-8", errors="replace")

    # Find detail page links: /used-sail-catamaran-for-sale/{year}-{make}-{model}/{name}/{id}
    detail_pattern = re.compile(r'/used-[^/]+-for-sale/\d{4}-[^/]+/[^/]+/(\d+)$')
    seen = set()

    for link in page.css('a[href*="-for-sale/"]'):
        href = link.attrib.get("href", "")
        m = detail_pattern.search(href)
        if not m:
            continue
        boat_id = m.group(1)
        if boat_id in seen:
            continue
        seen.add(boat_id)
        # Use the canonical URL (without Image-Gallery etc)
        full_url = BASE + href if href.startswith("/") else href

        boat = {"url": full_url}

        # Get all text content from the card
        text = str(link.get_all_text()).strip() if hasattr(link, 'get_all_text') else ""

        # Extract year from URL: /used-sail-catamaran-for-sale/2017-lagoon-560/...
        url_year = re.search(r'/(\d{4})-', href)
        if url_year and 1960 <= int(url_year.group(1)) <= 2030:
            boat["year"] = url_year.group(1)

        # Extract make/model from URL path
        path_match = re.search(r'-for-sale/\d{4}-([^/]+)/', href)
        if path_match:
            raw = path_match.group(1).replace("-", " ").title()
            boat["name"] = raw

        # Price from text: $1,295,000 or €372,800
        price_m = re.search(r'[£$€]\s?[\d,]+', text)
        if price_m:
            boat["price"] = price_m.group()

        # Length from text: "56 ft" or "42'"
        len_m = re.search(r'(\d+(?:\.\d+)?)\s*(?:ft|feet|\')', text, re.I)
        if len_m:
            boat["length"] = f"{len_m.group(1)}'"

        # Location from text — usually city, state format
        loc_m = re.search(r'([A-Z][a-z]+(?:\s[A-Z][a-z]+)*,?\s*[A-Z][a-z]+(?:\s[A-Z][a-z]+)*)', text)
        if loc_m and not re.match(r'\d', loc_m.group()):
            boat["location"] = loc_m.group().strip()

        # Images
        images = []
        for img in link.css("img"):
            src = img.attrib.get("data-src") or img.attrib.get("src", "")
            if src and "/BoatImages/" in src:
                if src.startswith("/"):
                    src = BASE + src
                images.append(src)
        boat["images"] = images[:15]

        if boat.get("name"):
            boats.append(boat)

    # Check pagination
    has_next = bool(re.search(r'pageNumber=\d+[^"]*"[^>]*>(?:Next|>|&gt;)', html, re.I))

    return boats, has_next


def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 100
    all_boats = []
    page_num = 0

    print(f"Scraping catamarans.com (limit={limit})...")

    while len(all_boats) < limit:
        url = f"{LIST_URL}?pageNumber={page_num}" if page_num > 0 else LIST_URL
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

    output_path = "/tmp/scraped_catamarans_com.json"
    with open(output_path, "w") as f:
        json.dump(all_boats, f, indent=2)

    print(f"\nDone! {len(all_boats)} boats saved to {output_path}")
    for b in all_boats[:5]:
        name = b.get("name", "?")
        price = b.get("price", "N/A")
        year = b.get("year", "?")
        imgs = len(b.get("images", []))
        print(f"  {year} {name} | {price} | {imgs} photos")


if __name__ == "__main__":
    main()
