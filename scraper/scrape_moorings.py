#!/usr/bin/env python3
"""Scrape used charter catamarans from mooringsbrokerage.com.

73 verified listings, SSR with JSON-LD structured data. Charter exit fleet.

Usage:
    python scrape_moorings.py [limit]    # default: 100
"""

import json
import re
import sys

from scrapling import Fetcher

BASE = "https://www.mooringsbrokerage.com"
# Sailing catamarans specifically
LIST_URL = f"{BASE}/used-boats/sailing-catamarans-for-sale"

fetcher = Fetcher()


def scrape_page(url):
    """Scrape listings, preferring JSON-LD structured data."""
    page = fetcher.get(url, timeout=20)
    if page.status != 200:
        print(f"  HTTP {page.status}")
        return [], False

    boats = []
    html = page.body.decode("utf-8", errors="replace")

    # Try JSON-LD first (most reliable)
    json_ld_blocks = re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', html, re.DOTALL)
    for block in json_ld_blocks:
        try:
            data = json.loads(block)
            if data.get("@type") == "ItemList":
                for item in data.get("itemListElement", []):
                    product = item if item.get("@type") == "Product" else item.get("item", {})
                    if product.get("@type") != "Product":
                        continue

                    boat = {}
                    name = product.get("name", "")
                    if name:
                        boat["name"] = name

                    # Year from name: "2023 Lagoon 40"
                    year_m = re.match(r'^(\d{4})\s+', name)
                    if year_m:
                        boat["year"] = year_m.group(1)
                        boat["name"] = name[len(year_m.group()):].strip()

                    manufacturer = product.get("manufacturer", "")
                    if manufacturer:
                        boat["name"] = f"{manufacturer} {boat.get('name', '')}"

                    offers = product.get("offers", {})
                    if offers.get("price"):
                        price = float(offers["price"])
                        currency = offers.get("priceCurrency", "USD").upper()
                        sym = {"USD": "$", "EUR": "€", "GBP": "£"}.get(currency, "$")
                        boat["price"] = f"{sym}{price:,.0f}"

                    if product.get("image"):
                        img = product["image"]
                        if isinstance(img, str):
                            boat["images"] = [img]
                        elif isinstance(img, list):
                            boat["images"] = img[:15]

                    detail_url = product.get("url", "")
                    if detail_url:
                        boat["url"] = BASE + detail_url if detail_url.startswith("/") else detail_url

                    if boat.get("name"):
                        boats.append(boat)
        except (json.JSONDecodeError, Exception):
            continue

    # Fallback: parse links if JSON-LD didn't work
    if not boats:
        seen_urls = set()
        for link in page.css('a[href*="/used-boats/"]'):
            href = link.attrib.get("href", "")
            if not re.search(r'/used-boats/\d{4}-', href):
                continue
            # Dedup by the boat ID at end of URL
            boat_id = re.search(r'-(\d{5,})', href)
            dedup_key = boat_id.group(1) if boat_id else href
            if dedup_key in seen_urls:
                continue
            seen_urls.add(dedup_key)
            full_url = BASE + href if href.startswith("/") else href

            boat = {"url": full_url}
            text = str(link.get_all_text()).strip() if hasattr(link, 'get_all_text') else ""

            # Name/year from URL
            path_m = re.search(r'/used-boats/(\d{4})-([^/]+)', href)
            if path_m:
                boat["year"] = path_m.group(1)
                boat["name"] = path_m.group(2).replace("-", " ").title()

            price_m = re.search(r'[£$€]\s?[\d,]+', text)
            if price_m:
                boat["price"] = price_m.group()

            images = []
            for img in link.css("img"):
                src = img.attrib.get("data-src") or img.attrib.get("src", "")
                if src and ("boatsgroup" in src or "cloudinary" in src):
                    images.append(src)
            boat["images"] = images[:15]

            if boat.get("name"):
                boats.append(boat)

    # Pagination: check for "next" or "Showing X of Y"
    has_next = bool(page.css('a[rel="next"], a:contains("Next"), [class*="next"]'))
    # Also check "Showing 30 of 71" pattern
    showing_m = re.search(r'Showing\s+\d+\s+of\s+(\d+)', html)
    if showing_m and len(boats) < int(showing_m.group(1)):
        has_next = True

    return boats, has_next


def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 100
    all_boats = []
    page_num = 0

    print(f"Scraping mooringsbrokerage.com charter cats (limit={limit})...")

    while len(all_boats) < limit:
        url = f"{LIST_URL}?page={page_num}" if page_num > 0 else LIST_URL
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

    output_path = "/tmp/scraped_moorings.json"
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
