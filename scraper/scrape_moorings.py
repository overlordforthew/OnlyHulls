#!/usr/bin/env python3
"""Scrape used charter cats from mooringsbrokerage.com via server-rendered cards."""

import json
import os
import re
import sys
import tempfile
import time

import requests

BASE = "https://www.mooringsbrokerage.com"
LIST_URL = f"{BASE}/used-boats/sailing-catamarans-for-sale"
HEADERS = {"User-Agent": "Mozilla/5.0"}
ARTICLE_RE = re.compile(r"<article class=\"cards__card\">.*?</article>", re.S | re.I)
TEMP_DIR = tempfile.gettempdir()
if os.name != "nt" and TEMP_DIR.startswith("/tmp/user/"):
    TEMP_DIR = "/tmp"
OUTPUT_PATH = os.path.join(TEMP_DIR, "scraped_moorings.json")
TITLE_RE = re.compile(r"<h3[^>]*cards__title[^>]*>(.*?)</h3>", re.S | re.I)


def clean_html_text(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", value or "")).strip()


def parse_card(article_html: str) -> dict | None:
    href_match = re.search(r'<a href="([^"]+/used-boats/[^"]+)"', article_html, re.I)
    title_match = TITLE_RE.search(article_html)
    price_match = re.search(
        r'<div class="cards__price-amount[^"]*">\s*([^<]+?)\s*</div>',
        article_html,
        re.S | re.I,
    )
    image_match = re.search(r'<img[^>]+src="([^"]+)"', article_html, re.I)
    list_items = re.findall(r'<li class="cards__list-item">\s*(.*?)\s*</li>', article_html, re.S | re.I)

    if not href_match or not title_match or not price_match:
        return None

    title = clean_html_text(title_match.group(1))
    price = clean_html_text(price_match.group(1))
    image = image_match.group(1).split("?")[0].strip() if image_match else ""
    location = clean_html_text(list_items[0]) if list_items else ""

    year_match = re.match(r"^(\d{4})\s+(.+)$", title)
    year = year_match.group(1) if year_match else None
    name = year_match.group(2).strip() if year_match else title

    boat = {
        "url": href_match.group(1),
        "name": name,
        "price": price,
        "images": [image] if image else [],
    }
    if year:
        boat["year"] = year
    if location:
        boat["location"] = location
    return boat


def scrape_page(url: str):
    resp = requests.get(url, headers=HEADERS, timeout=30)
    if resp.status_code != 200:
        print(f"  HTTP {resp.status_code}")
        return [], False

    boats = []
    for article_html in ARTICLE_RE.findall(resp.text):
        boat = parse_card(article_html)
        if boat:
            boats.append(boat)

    has_next = bool(re.search(r'rel="next"|aria-label="Next page"', resp.text, re.I))
    return boats, has_next


def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 100
    all_boats = []
    seen = set()
    page_num = 1

    print(f"Scraping mooringsbrokerage.com charter cats (limit={limit})...")

    while len(all_boats) < limit:
        url = f"{LIST_URL}?page={page_num}" if page_num > 1 else LIST_URL
        print(f"  Page {page_num}...", end=" ", flush=True)
        boats, has_next = scrape_page(url)
        new_boats = 0

        for boat in boats:
            if boat["url"] in seen:
                continue
            seen.add(boat["url"])
            all_boats.append(boat)
            new_boats += 1
            if len(all_boats) >= limit:
                break

        print(f"{new_boats} new (total: {len(all_boats)})")
        if not has_next or new_boats == 0 or len(all_boats) >= limit:
            break

        page_num += 1
        time.sleep(0.5)

    with open(OUTPUT_PATH, "w") as f:
        json.dump(all_boats[:limit], f, indent=2)

    print(f"\nDone! {len(all_boats[:limit])} boats saved to {OUTPUT_PATH}")
    for boat in all_boats[:5]:
        print(
            f"  {boat.get('year', '?')} {boat.get('name', '?')[:40]} | {boat.get('price', 'N/A')} | {boat.get('location', '?')}"
        )


if __name__ == "__main__":
    main()
