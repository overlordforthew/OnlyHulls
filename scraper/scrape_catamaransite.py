#!/usr/bin/env python3
"""Scrape cruising catamarans from catamaransite.com via SSR card parsing."""
import json
import os
import re
import sys
import tempfile
from html import unescape
from pathlib import Path
from urllib.parse import urljoin

import requests

BASE = "https://www.catamaransite.com"
LIST_URL = f"{BASE}/yachts-for-sale/"
HEADERS = {"User-Agent": "Mozilla/5.0"}
ARTICLE_RE = re.compile(r"<article\b[^>]*class=\"[^\"]*card[^\"]*\"[^>]*>.*?</article>", re.S | re.I)
IMAGE_EXT_RE = re.compile(r"\.(?:jpe?g|png|webp)(?:[?#].*)?$", re.I)
IMAGE_SIZE_RE = re.compile(r"-(\d{2,5})x(\d{2,5})(?=\.(?:jpe?g|png|webp)(?:[?#].*)?$)", re.I)
IMAGE_SCALED_SUFFIX_RE = re.compile(r"-scaled(?=\.(?:jpe?g|png|webp)(?:[?#].*)?$)", re.I)
IMAGE_VALUE_RE = re.compile(
    r"\b(?:src|data-src|data-lazy-src|data-original|srcset|data-srcset)=\"([^\"]+)\"",
    re.I,
)
EURO = "\u20ac"
TEMP_DIR = tempfile.gettempdir()
if os.name != "nt" and TEMP_DIR.startswith("/tmp/user/"):
    TEMP_DIR = "/tmp"
OUTPUT_PATH = os.path.join(TEMP_DIR, "scraped_catamaransite.json")


def clean_html_text(value: str) -> str:
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", value or ""))).strip()


def is_placeholder_image(url: str) -> bool:
    lowered = url.lower()
    return not lowered or "catsite-logo" in lowered or lowered.startswith("data:image/")


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


def image_group_key(url: str) -> str:
    url_without_query = re.sub(r"[?#].*$", "", url)
    without_size = IMAGE_SIZE_RE.sub("", url_without_query)
    return IMAGE_SCALED_SUFFIX_RE.sub("", without_size).lower()


def image_quality(url: str) -> int:
    match = IMAGE_SIZE_RE.search(url)
    if not match:
        return 10**12
    return int(match.group(1)) * int(match.group(2))


def is_detail_listing_image(url: str) -> bool:
    lowered = url.lower()
    if "/wp-content/uploads/" not in lowered:
        return False
    if not IMAGE_EXT_RE.search(lowered):
        return False
    if any(token in lowered for token in ["logo", "placeholder", "avatar", "icon", "spinner"]):
        return False
    return True


def extract_detail_images(html: str, page_url: str, limit: int = 24) -> list[str]:
    """Prefer real CatamaranSite gallery photos over logos and responsive thumbnails."""
    best_by_group: dict[str, tuple[int, int, str]] = {}

    for order, match in enumerate(IMAGE_VALUE_RE.finditer(html)):
        for value in iter_image_values(match.group(1)):
            image_url = urljoin(page_url, value)
            if not is_detail_listing_image(image_url):
                continue

            key = image_group_key(image_url)
            quality = image_quality(image_url)
            previous = best_by_group.get(key)
            if previous is None or quality > previous[0]:
                best_by_group[key] = (quality, order, image_url)

    ordered = sorted(best_by_group.values(), key=lambda item: item[1])
    return [image_url for _, _, image_url in ordered[:limit]]


def fetch_detail_fallback(url: str) -> dict:
    html = fetch_html(url)
    if not html:
        return {}

    og_image = re.search(r'property="og:image"\s+content="([^"]+)"', html, re.I)
    location = ""
    location_match = re.search(r"<strong>\s*Location\s*</strong>\s*</p>\s*<p[^>]*>\s*([^<]+?)\s*</p>", html, re.I)
    if location_match:
        location = clean_html_text(location_match.group(1))

    result: dict = {}
    images = extract_detail_images(html, url)
    if images:
        result["images"] = images
    elif og_image:
        result["images"] = [og_image.group(1).strip()]
    if location:
        result["location"] = location
    return result


def parse_price(text: str) -> str | None:
    usd = re.search(r"\$\s*([\d,]+)", text)
    if usd:
        return f"${usd.group(1)}"

    euro = re.search(rf"(\d[\d.,\s]*)\s*{re.escape(EURO)}", text)
    if euro:
        amount = euro.group(1).replace(" ", "")
        return f"{EURO}{amount}"

    return None


def parse_detail_listing(url: str) -> dict | None:
    html = fetch_html(url)
    if not html:
        return None

    title_match = re.search(r'property="og:title"\s+content="([^"]+)"', html, re.I)
    description_match = re.search(r'property="og:description"\s+content="([^"]+)"', html, re.I)
    fallback_title = re.search(r"<title>(.*?)</title>", html, re.I | re.S)
    raw_title = clean_html_text(title_match.group(1) if title_match else (fallback_title.group(1) if fallback_title else ""))

    name = raw_title
    year = None
    price = None
    currency = None

    title_parts = raw_title.split(" For Sale - ", 1)
    if title_parts:
        name = title_parts[0].strip()
    year_match = re.search(r"\b(19[6-9]\d|20[0-2]\d)\b", raw_title)
    if not year_match and description_match:
        year_match = re.search(r"\b(19[6-9]\d|20[0-2]\d)\b", description_match.group(1))
    if year_match:
        year = year_match.group(1)
        if name.endswith(year):
            name = name[: -len(year)].strip(" -")

    price_currency_match = re.search(r"\b(USD|EUR)\s+([\d,]+)", raw_title, re.I)
    if price_currency_match:
        currency = price_currency_match.group(1).upper()
        symbol = "$" if currency == "USD" else EURO
        price = f"{symbol}{price_currency_match.group(2)}"

    if not price:
        asking_match = re.search(
            r"Asking</label>\s*<span[^>]*>\s*<span>\s*([$€])\s*([\d,\.]+)",
            html,
            re.I | re.S,
        )
        if asking_match:
            price = f"{asking_match.group(1)}{asking_match.group(2)}"
            currency = "USD" if asking_match.group(1) == "$" else "EUR"

    location = ""
    location_match = re.search(r"Location\s*</[^>]+>\s*<[^>]+>\s*([^<]+)", html, re.I | re.S)
    if location_match:
        location = clean_html_text(location_match.group(1))
    if not location:
        location_from_title = re.search(r"\bin\s+(.+?)\s+By Broker\b", raw_title, re.I)
        if location_from_title:
            location = clean_html_text(location_from_title.group(1))

    og_image = re.search(r'property="og:image"\s+content="([^"]+)"', html, re.I)
    images = extract_detail_images(html, url)
    if not images and og_image:
        images = [og_image.group(1).strip()]

    if not name or not price:
        return None

    boat = {
        "url": url,
        "name": name,
        "price": price,
        "images": images,
    }
    if year:
        boat["year"] = year
    if location:
        boat["location"] = location
    if currency:
        boat["currency"] = currency
    return boat


def parse_card(article_html: str) -> dict | None:
    href_match = re.search(r'href="([^"]+/yachts-for-sale/[^"]+/?)"', article_html, re.I)
    if not href_match:
        return None

    title_match = re.search(r'title="([^"]+)"', article_html, re.I)
    title = clean_html_text(title_match.group(1)) if title_match else ""
    if not title:
        return None

    img_match = re.search(r'<img[^>]+(?:data-src|src)="([^"]+)"', article_html, re.I)
    image = img_match.group(1).strip() if img_match else ""
    if is_placeholder_image(image):
        data_src_match = re.search(r'<img[^>]+data-src="([^"]+)"', article_html, re.I)
        image = data_src_match.group(1).strip() if data_src_match else ""

    text = clean_html_text(article_html)
    price = parse_price(text)
    year_match = (
        re.search(r"\bis a\s+(19[6-9]\d|20[0-2]\d)\b", text, re.I)
        or re.search(r"\b(19[6-9]\d|20[0-2]\d)\b", text)
    )
    year = year_match.group(1) if year_match else None

    location_match = re.search(r"Location\s+(.+?)\s+S/V|Location\s+(.+?)\s+M/Y|Location\s+(.+?)\s+Sail|Location\s+(.+?)\s+Power", text, re.I)
    location = next((group.strip() for group in location_match.groups() if group), "") if location_match else ""

    if not location:
        location_match = re.search(r"Location\s+(.+?)\s+Asking", text, re.I)
        location = location_match.group(1).strip() if location_match else ""

    detail = fetch_detail_fallback(href_match.group(1))
    detail_images = detail.get("images", [])
    if detail_images:
        image_list = detail_images
    else:
        image_list = [image] if image else []

    if is_placeholder_image(image) or not location:
        if is_placeholder_image(image):
            image_list = detail_images or image_list
        if not location:
            location = detail.get("location", location)

    if not price:
        return None

    boat = {
        "url": href_match.group(1),
        "name": title,
        "price": price,
        "images": image_list,
    }
    if year:
        boat["year"] = year
    if location:
        boat["location"] = location

    return boat


def scrape(limit=30):
    resp = requests.get(LIST_URL, headers=HEADERS, timeout=30)
    if resp.status_code != 200:
        return []

    boats = []
    seen = set()
    for article_html in ARTICLE_RE.findall(resp.text):
        boat = parse_card(article_html)
        if not boat:
            continue
        if boat["url"] in seen:
            continue
        seen.add(boat["url"])
        boats.append(boat)
        if len(boats) >= limit:
            break

    return boats[:limit]


def backfill(url_file: str):
    boats = []
    seen = set()
    for raw_url in Path(url_file).read_text(encoding="utf-8").splitlines():
        url = raw_url.strip()
        if not url or url in seen:
            continue
        seen.add(url)
        boat = parse_detail_listing(url)
        if boat:
            boats.append(boat)
    return boats


def main():
    backfill_mode = "--backfill" in sys.argv
    args = [a for a in sys.argv[1:] if a != "--backfill"]

    if backfill_mode:
        input_file = args[0] if args else "/tmp/catamaransite_backfill_urls.txt"
        print(f"Backfill mode: {input_file}")
        boats = backfill(input_file)
    else:
        limit = int(args[0]) if args else 50
        print(f"Scraping catamaransite.com (limit={limit})...")
        boats = scrape(limit)

    with open(OUTPUT_PATH, "w") as f:
        json.dump(boats, f, indent=2)
    print(f"Done! {len(boats)} boats")
    for b in boats[:5]:
        print(
            f"  {b.get('year','?')} {b.get('name','?')[:40]:<40} | {b.get('price','?'):<20} | {b.get('location','?')}"
        )


if __name__ == "__main__":
    main()
