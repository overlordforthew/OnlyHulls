#!/usr/bin/env python3
"""Scrape charter exit fleet from dreamyachtsales.com via SSR card parsing."""
import json
import os
import re
import sys
import tempfile
from html import unescape
from urllib.parse import urljoin
from urllib.request import Request, urlopen

import requests

BASE = "https://www.dreamyachtsales.com"
LIST_PATH = "/pre-owned-yachts/listings/"
HEADERS = {"User-Agent": "Mozilla/5.0"}
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

ARTICLE_RE = re.compile(r"<article\b[^>]*class=\"[^\"]*card[^\"]*\"[^>]*>.*?</article>", re.S | re.I)
IMAGE_EXT_RE = re.compile(r"\.(?:jpe?g|png|webp)(?:[?#].*)?$", re.I)
IMAGE_SIZE_RE = re.compile(r"-(\d{2,5})x(\d{2,5})(?=\.(?:jpe?g|png|webp)(?:[?#].*)?$)", re.I)
IMAGE_VALUE_RE = re.compile(
    r"\b(?:src|data-src|data-lazy-src|data-original|srcset|data-srcset)=\"([^\"]+)\"",
    re.I,
)
EURO = "\u20ac"
TEMP_DIR = tempfile.gettempdir()
if os.name != "nt" and TEMP_DIR.startswith("/tmp/user/"):
    TEMP_DIR = "/tmp"
OUTPUT_PATH = os.path.join(TEMP_DIR, "scraped_dreamyacht.json")


def clean_html_text(value: str) -> str:
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", value or ""))).strip()


def fetch_html(url: str, timeout: int = 30) -> str | None:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=timeout)
        if resp.status_code == 200:
            return resp.text
    except requests.RequestException:
        pass

    try:
        req = Request(url, headers=HEADERS)
        with urlopen(req, timeout=timeout) as resp:
            if getattr(resp, "status", 200) != 200:
                return None
            return resp.read().decode("utf-8", errors="replace")
    except OSError:
        return None


def parse_price(text: str) -> str | None:
    euro = re.search(rf"(\d[\d.\s]*,\d+)\s*(?:&nbsp;|\s)*{re.escape(EURO)}", text)
    if euro:
        amount = euro.group(1).replace(" ", "")
        return f"{EURO}{amount}"

    alt_euro = re.search(rf"{re.escape(EURO)}\s*([\d.,]+)", text)
    if alt_euro:
        return f"{EURO}{alt_euro.group(1)}"

    usd = re.search(r"\$\s*([\d,]+)", text)
    if usd:
        return f"${usd.group(1)}"

    return None


def parse_year(text: str) -> str | None:
    match = re.search(r"\b(19[6-9]\d|20[0-2]\d)\b", text)
    return match.group(1) if match else None


def iter_image_values(raw_value: str):
    for part in raw_value.split(","):
        url = part.strip().split(" ")[0].strip()
        if url and not url.startswith("data:"):
            yield unescape(url)


def image_group_key(url: str) -> str:
    url_without_query = re.sub(r"[?#].*$", "", url)
    return IMAGE_SIZE_RE.sub("", url_without_query).lower()


def image_quality(url: str) -> int:
    match = IMAGE_SIZE_RE.search(url)
    if not match:
        return 10**12
    return int(match.group(1)) * int(match.group(2))


def extract_detail_images(html: str, page_url: str, limit: int = 24) -> list[str]:
    """Prefer real yacht gallery photos over logos, flags, and responsive thumbnails."""
    best_by_group: dict[str, tuple[int, int, str]] = {}

    for order, match in enumerate(IMAGE_VALUE_RE.finditer(html)):
        for value in iter_image_values(match.group(1)):
            image_url = urljoin(page_url, value)
            lower_url = image_url.lower()
            if "/app/uploads/" not in lower_url:
                continue
            if not IMAGE_EXT_RE.search(lower_url):
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
    href_match = re.search(
        r'href="([^"]+/pre-owned-yachts/listings/[^"]+/?)"',
        article_html,
        re.I,
    )
    if not href_match:
        return None

    title_match = re.search(
        r'<a[^>]*class="[^"]*card__link[^"]*"[^>]*>(.*?)</a>',
        article_html,
        re.S | re.I,
    )
    if not title_match:
        return None

    title = clean_html_text(title_match.group(1))
    if not title:
        return None

    img_match = re.search(r'<img[^>]+src="([^"]+)"', article_html, re.I)
    image = img_match.group(1).strip() if img_match else ""

    text = clean_html_text(article_html)
    price = parse_price(article_html) or parse_price(text)
    year = parse_year(text)

    location_match = re.search(r"Location\s+(.+?)\s+Build year", text, re.I)
    location = location_match.group(1).strip() if location_match else ""

    if not price:
        return None

    boat = {
        "url": urljoin(BASE, href_match.group(1)),
        "name": title,
        "price": price,
        "images": [image] if image else [],
    }
    if year:
        boat["year"] = year
    if location:
        boat["location"] = location

    return boat


def scrape(limit=30):
    boats = []
    seen = set()
    page_num = 1

    while len(boats) < limit and page_num <= 15:
        url = f"{BASE}{LIST_PATH}page/{page_num}/" if page_num > 1 else f"{BASE}{LIST_PATH}"
        html = fetch_html(url)
        if not html:
            break

        cards = ARTICLE_RE.findall(html)
        if not cards:
            break

        new_count = 0
        for article_html in cards:
            boat = parse_card(article_html)
            if not boat:
                continue

            if boat["url"] in seen:
                continue
            seen.add(boat["url"])
            detail_images = fetch_detail_images(boat["url"])
            if detail_images:
                boat["images"] = detail_images
            boats.append(boat)
            new_count += 1
            if len(boats) >= limit:
                break

        if new_count == 0:
            break
        page_num += 1

    return boats[:limit]


def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    print(f"Scraping dreamyachtsales.com (limit={limit})...")
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
