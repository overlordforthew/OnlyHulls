#!/usr/bin/env python3
"""Scrape used charter catamarans from mooringsbrokerage.com via JSON-LD.

~73 listings. JSON-LD structured data on index pages has all fields.

Usage:
    python scrape_moorings.py [limit]    # default: 100
"""

import json
import re
import sys

from scrapling import Fetcher

BASE = "https://www.mooringsbrokerage.com"
LIST_URL = f"{BASE}/used-boats/sailing-catamarans-for-sale"

fetcher = Fetcher()


def scrape_page(url):
    """Extract boats from JSON-LD structured data on index page."""
    page = fetcher.get(url, timeout=20)
    if page.status != 200:
        print(f"  HTTP {page.status}")
        return [], False

    html = page.body.decode("utf-8", errors="replace")
    boats = []

    # Parse JSON-LD ItemList
    for block_m in re.finditer(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', html, re.DOTALL):
        try:
            data = json.loads(block_m.group(1))

            # Handle ItemList containing ListItems with Product items
            raw_items = []
            if data.get("@type") == "ItemList":
                raw_items = data.get("itemListElement", [])
            elif isinstance(data, list):
                raw_items = data

            # Flatten: items can be nested lists [[Product, Product], [Product]]
            items = []
            for item in raw_items:
                if isinstance(item, list):
                    items.extend(item)
                else:
                    items.append(item)

            for product in items:
                # Items can be Product directly, or wrapped in ListItem
                if product.get("@type") == "ListItem":
                    product = product.get("item", {})
                if product.get("@type") != "Product":
                    continue

                boat = {}

                # Name — "2023 Lagoon 40"
                name = product.get("name", "")
                if name:
                    year_m = re.match(r'^(\d{4})\s+', name)
                    if year_m:
                        boat["year"] = year_m.group(1)
                        boat["name"] = name[len(year_m.group()):].strip()
                    else:
                        boat["name"] = name

                # Price from offers
                offers = product.get("offers", {})
                if isinstance(offers, list):
                    offers = offers[0] if offers else {}
                price_val = offers.get("price")
                if price_val:
                    try:
                        price = float(price_val)
                        if price > 500:  # Skip deposits/monthly fees
                            currency = offers.get("priceCurrency", "USD").upper()
                            sym = {"USD": "$", "EUR": "€", "GBP": "£"}.get(currency, "$")
                            boat["price"] = f"{sym}{price:,.0f}"
                    except:
                        pass

                # URL
                detail_url = product.get("url", "")
                if detail_url:
                    boat["url"] = BASE + detail_url if detail_url.startswith("/") else detail_url

                # Image
                img = product.get("image", "")
                if img:
                    if isinstance(img, str):
                        boat["images"] = [img.split("?")[0]]  # Strip resize params
                    elif isinstance(img, list):
                        boat["images"] = [i.split("?")[0] for i in img[:15]]
                else:
                    boat["images"] = []

                # Manufacturer
                mfg = product.get("manufacturer", "")
                if mfg and boat.get("name"):
                    if not boat["name"].lower().startswith(mfg.lower()):
                        boat["name"] = f"{mfg} {boat['name']}"

                # Year from URL if not in name: /used-boats/2023-lagoon-40-...
                if not boat.get("year") and boat.get("url"):
                    year_m = re.search(r'/(\d{4})-', boat["url"])
                    if year_m:
                        boat["year"] = year_m.group(1)

                if boat.get("name") and boat.get("price"):
                    boats.append(boat)

        except (json.JSONDecodeError, Exception) as e:
            continue

    # Pagination — check for "Showing X of Y"
    showing_m = re.search(r'Showing\s+\d+\s+of\s+(\d+)', html)
    total = int(showing_m.group(1)) if showing_m else 0
    has_next = len(boats) > 0 and len(boats) < total

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

        # Dedup by URL
        seen = set(b.get("url") for b in all_boats)
        new_boats = [b for b in boats if b.get("url") not in seen]
        all_boats.extend(new_boats)
        print(f"{len(new_boats)} new (total: {len(all_boats)})")

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
        print(f"  {year} {name[:40]} | {price} | {imgs} photos")


if __name__ == "__main__":
    main()
