#!/usr/bin/env python3
"""Scrape used charter cats from mooringsbrokerage.com via server-rendered cards."""

import json
import os
import re
import sys
import tempfile
import time
from html import unescape
from urllib.parse import urljoin

import requests

BASE = "https://www.mooringsbrokerage.com"
LIST_URL = f"{BASE}/used-boats/sailing-catamarans-for-sale"
HEADERS = {"User-Agent": "Mozilla/5.0"}
ARTICLE_RE = re.compile(r"<article class=\"cards__card\">.*?</article>", re.S | re.I)
IMAGE_EXT_RE = re.compile(r"\.(?:jpe?g|png|webp)(?:[?#].*)?$", re.I)
IMAGE_VARIANT_RE = re.compile(r"_(?:tiny|small|medium|large|xlarge)(?=\.(?:jpe?g|png|webp)$)", re.I)
IMAGE_VALUE_RE = re.compile(
    r"\b(?:src|data-src|data-lazy-src|data-original|srcset|data-srcset)=\"([^\"]+)\"",
    re.I,
)
TEMP_DIR = tempfile.gettempdir()
if os.name != "nt" and TEMP_DIR.startswith("/tmp/user/"):
    TEMP_DIR = "/tmp"
OUTPUT_PATH = os.path.join(TEMP_DIR, "scraped_moorings.json")
TITLE_RE = re.compile(r"<h3[^>]*cards__title[^>]*>(.*?)</h3>", re.S | re.I)


def clean_html_text(value: str) -> str:
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", value or ""))).strip()


def fetch_html(url: str) -> str | None:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=30)
        if resp.status_code != 200:
            return None
        return resp.text
    except requests.RequestException:
        return None


def iter_image_values(raw_value: str):
    for part in raw_value.split(","):
        url = part.strip().split(" ")[0].strip()
        if url and not url.startswith("data:"):
            yield unescape(url)


def is_detail_listing_image(url: str) -> bool:
    lowered = url.lower()
    if "images.boatsgroup.com/resize/" not in lowered:
        return False
    if not IMAGE_EXT_RE.search(lowered):
        return False
    if any(token in lowered for token in ["logo", "placeholder", "favicon", "icon"]):
        return False
    return True


def image_group_key(url: str) -> str:
    return IMAGE_VARIANT_RE.sub("", re.sub(r"[?#].*$", "", url).lower())


def image_quality(url: str) -> int:
    lowered = url.lower()
    if "_xlarge" in lowered:
        return 5
    if "_large" in lowered:
        return 4
    if "_medium" in lowered:
        return 3
    if "_small" in lowered:
        return 2
    if "_tiny" in lowered:
        return 1
    return 10


def extract_detail_images(html: str, page_url: str, limit: int = 24) -> list[str]:
    """Keep real Moorings listing photos while ignoring site chrome and duplicates."""
    best_by_group: dict[str, tuple[int, int, str]] = {}

    for order, match in enumerate(IMAGE_VALUE_RE.finditer(html)):
        for value in iter_image_values(match.group(1)):
            image_url = urljoin(page_url, value).split("?")[0]
            if not is_detail_listing_image(image_url):
                continue

            key = image_group_key(image_url)
            quality = image_quality(image_url)
            previous = best_by_group.get(key)
            if previous is None or quality > previous[0]:
                best_by_group[key] = (quality, order, image_url)

    ordered = sorted(best_by_group.values(), key=lambda item: item[1])
    return [image_url for _, _, image_url in ordered[:limit]]


def fetch_detail_images(url: str) -> list[str]:
    html = fetch_html(url)
    if not html:
        return []

    return extract_detail_images(html, url)


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
    html = fetch_html(url)
    if not html:
        print("  HTTP error")
        return [], False

    boats = []
    for article_html in ARTICLE_RE.findall(html):
        boat = parse_card(article_html)
        if boat:
            detail_images = fetch_detail_images(boat["url"])
            if detail_images:
                boat["images"] = detail_images
            boats.append(boat)

    has_next = bool(re.search(r'rel="next"|aria-label="Next page"', html, re.I))
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
