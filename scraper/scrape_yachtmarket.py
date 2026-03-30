#!/usr/bin/env python3
"""Scrape sailing yacht listings from theyachtmarket.com.

Focus: bluewater cruisers, coastal cruisers, catamarans, liveaboards 25ft+.
Server-rendered HTML, lazy-loaded images via data-src.

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
    """Scrape a single page of listings."""
    page = fetcher.get(url, timeout=20)
    if page.status != 200:
        print(f"  HTTP {page.status}")
        return [], False

    boats = []
    html = page.body.decode("utf-8", errors="replace")

    # Detail page links: /en/boats-for-sale/{make}/{model}/id{number}/
    detail_pattern = re.compile(r'/en/boats-for-sale/[^/]+/[^/]+/id\d+/')
    seen = set()

    # Find all detail page links
    for link in page.css('a[href]'):
        href = link.attrib.get("href", "")
        if not detail_pattern.search(href):
            continue
        full_url = BASE + href if href.startswith("/") else href
        if full_url in seen:
            continue
        seen.add(full_url)

        boat = {"url": full_url}
        text = str(link.get_all_text()).strip() if hasattr(link, 'get_all_text') else ""

        # Extract name from URL path: /make/model/
        parts = href.strip("/").split("/")
        if len(parts) >= 4:
            make = parts[2].replace("-", " ").title()
            model = parts[3].replace("-", " ").title()
            # Remove "Id12345" from model
            model = re.sub(r'\bId\d+\b', '', model).strip()
            if model:
                boat["name"] = f"{make} {model}"
            else:
                boat["name"] = make

        # Parse pipe-separated specs from card text: "2008 | 17.70m | Diesel | Sail"
        specs = re.findall(r'(\d{4})\s*\|?\s*(\d+(?:\.\d+)?)\s*m', text)
        if specs:
            boat["year"] = specs[0][0]
            meters = float(specs[0][1])
            boat["length"] = f"{meters * 3.28084:.0f}'"
        else:
            # Try standalone patterns
            year_m = re.search(r'\b(19[6-9]\d|20[0-2]\d)\b', text)
            if year_m:
                boat["year"] = year_m.group()
            len_m = re.search(r'(\d+(?:\.\d+)?)\s*m\b', text)
            if len_m:
                boat["length"] = f"{float(len_m.group(1)) * 3.28084:.0f}'"

        # Price from text
        price_m = re.search(r'[£$€]\s?[\d,]+', text)
        if price_m:
            boat["price"] = price_m.group()

        # Location — look for known patterns
        loc_m = re.search(r'(?:Location|Based)[\s:]+([A-Z][a-zA-Z\s,]+?)(?:\s*\||$)', text)
        if loc_m:
            boat["location"] = loc_m.group(1).strip()

        # Images: lazy-loaded via data-src on background divs or img tags
        images = []
        for img in link.css("img"):
            src = img.attrib.get("data-src") or img.attrib.get("src", "")
            if src and "theyachtmarket" in src:
                if src.startswith("//"):
                    src = "https:" + src
                images.append(src)
        for div in link.css("[data-src]"):
            src = div.attrib.get("data-src", "")
            if src and "theyachtmarket" in src:
                if src.startswith("//"):
                    src = "https:" + src
                images.append(src)
        boat["images"] = list(dict.fromkeys(images))[:15]

        # Try extracting year from image filename (e.g. "pilot-saloon-55-2008-0001.jpg")
        if not boat.get("year") and images:
            for img_url in images:
                y = re.search(r'-(\d{4})-\d{4}\.', img_url)
                if y and 1960 <= int(y.group(1)) <= 2030:
                    boat["year"] = y.group(1)
                    break

        if boat.get("name"):
            boats.append(boat)

    # Next page
    has_next = 'page=' in html and bool(re.search(r'page=\d+[^"]*"[^>]*>[Nn]ext', html))
    if not has_next:
        has_next = bool(page.css('a[rel="next"]'))

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
