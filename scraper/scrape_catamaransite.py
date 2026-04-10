#!/usr/bin/env python3
"""Scrape cruising catamarans from catamaransite.com via SSR card parsing."""
import json
import os
import re
import sys
import tempfile
from html import unescape

import requests

BASE = "https://www.catamaransite.com"
LIST_URL = f"{BASE}/yachts-for-sale/"
HEADERS = {"User-Agent": "Mozilla/5.0"}
ARTICLE_RE = re.compile(r"<article\b[^>]*class=\"[^\"]*card[^\"]*\"[^>]*>.*?</article>", re.S | re.I)
EURO = "\u20ac"
OUTPUT_PATH = os.path.join(tempfile.gettempdir(), "scraped_catamaransite.json")


def clean_html_text(value: str) -> str:
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", value or ""))).strip()


def parse_price(text: str) -> str | None:
    usd = re.search(r"\$\s*([\d,]+)", text)
    if usd:
        return f"${usd.group(1)}"

    euro = re.search(rf"(\d[\d.,\s]*)\s*{re.escape(EURO)}", text)
    if euro:
        amount = euro.group(1).replace(" ", "")
        return f"{EURO}{amount}"

    return None


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
    if image.startswith("data:image/"):
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

    if not price:
        return None

    boat = {
        "url": href_match.group(1),
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


def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 50
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
