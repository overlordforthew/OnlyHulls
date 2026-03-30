#!/usr/bin/env python3
"""Scrape cruising yacht listings from apolloduck.com.

Focus: cruising yachts 25ft+.
Server-rendered HTML with CDN images.

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
    """Scrape a single page of listings."""
    page = fetcher.get(url, timeout=20)
    if page.status != 200:
        print(f"  HTTP {page.status}")
        return [], False

    boats = []
    html = page.body.decode("utf-8", errors="replace")

    # Detail links: /boat/{model}-for-sale/{id}
    detail_pattern = re.compile(r'/boat/[^/]+-for-sale/\d+')
    seen = set()

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

        # Name from link text or URL
        title_els = link.css('strong, b, h2, h3, h4')
        title_el = title_els[0] if title_els else None
        if title_el:
            raw_name = str(title_el.get_all_text()).strip()
            # Clean up: remove leading year, trailing "for sale"
            raw_name = re.sub(r'^\d{4}\s+', '', raw_name)
            raw_name = re.sub(r'\s+for\s+sale\s*$', '', raw_name, flags=re.I)
            boat["name"] = raw_name
        elif text:
            first_line = text.split("\n")[0].strip()[:80]
            first_line = re.sub(r'^\d{4}\s+', '', first_line)
            first_line = re.sub(r'\s+for\s+sale\s*$', '', first_line, flags=re.I)
            if first_line:
                boat["name"] = first_line

        # Structured fields from text: "Year: 1985", "Length: 7.50m", "Location: Portugal"
        year_m = re.search(r'Year:\s*(\d{4})', text)
        if year_m:
            boat["year"] = year_m.group(1)
        else:
            year_m = re.search(r'\b(19[6-9]\d|20[0-2]\d)\b', text)
            if year_m:
                boat["year"] = year_m.group(1)

        len_m = re.search(r'Length:\s*(\d+(?:\.\d+)?)\s*m', text)
        if len_m:
            meters = float(len_m.group(1))
            boat["length"] = f"{meters * 3.28084:.0f}'"
        else:
            len_m = re.search(r'(\d+(?:\.\d+)?)\s*m\b', text)
            if len_m:
                val = float(len_m.group(1))
                if 5 < val < 50:  # plausible boat length in meters
                    boat["length"] = f"{val * 3.28084:.0f}'"

        loc_m = re.search(r'Location:\s*(.+?)(?:\n|$)', text)
        if loc_m:
            boat["location"] = loc_m.group(1).strip()

        price_m = re.search(r'[£$€]\s?[\d,]+', text)
        if price_m:
            boat["price"] = price_m.group()

        # Note: Apollo Duck CDN (ics.apolloduck.com) is hotlink-protected
        # Images return 400 when loaded from external domains
        # Don't store these URLs — they won't render on our site
        boat["images"] = []

        if boat.get("name"):
            boats.append(boat)

    # Pagination
    has_next = bool(re.search(r'next=\d+', html)) or bool(page.css('a:contains("Next"), a:contains("next")'))

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
        loc = b.get("location", "?")
        imgs = len(b.get("images", []))
        print(f"  {year} {name} | {price} | {loc} | {imgs} photos")


if __name__ == "__main__":
    main()
