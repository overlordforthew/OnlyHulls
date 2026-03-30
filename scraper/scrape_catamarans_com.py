#!/usr/bin/env python3
"""Scrape catamaran listings from catamarans.com via detail pages.

2,013 listings. Index page gives URLs, detail pages give full specs + price.

Usage:
    python scrape_catamarans_com.py [limit]    # default: 100
"""

import json
import re
import sys
import time

from scrapling import Fetcher

BASE = "https://www.catamarans.com"
LIST_URL = f"{BASE}/catamarans-for-sale/catamarans-all-listing-search-boats"

fetcher = Fetcher()


def get_listing_urls(limit=100):
    """Get detail page URLs from index pages."""
    all_urls = []
    page_num = 0

    while len(all_urls) < limit:
        url = f"{LIST_URL}?pageNumber={page_num}" if page_num > 0 else LIST_URL
        print(f"  Index page {page_num}...", end=" ", flush=True)

        page = fetcher.get(url, timeout=20)
        if page.status != 200:
            print(f"HTTP {page.status}")
            break

        html = page.body.decode("utf-8", errors="replace")
        # Match: /used-sail-catamaran-for-sale/{year}-{make}-{model}/{name}/{id}
        pattern = re.compile(r'/used-[^/]+-for-sale/\d{4}-[^/]+/[^/]+/(\d+)$')
        seen = set(u[1] for u in all_urls)
        new = 0

        for link in page.css('a[href*="-for-sale/"]'):
            href = link.attrib.get("href", "")
            m = pattern.search(href)
            if m and m.group(1) not in seen:
                full_url = BASE + href if href.startswith("/") else href
                all_urls.append((m.group(1), full_url))
                seen.add(m.group(1))
                new += 1

        print(f"{new} new (total: {len(all_urls)})")
        if new == 0:
            break
        page_num += 1

    return all_urls[:limit]


def scrape_detail(boat_id, url):
    """Scrape a single boat detail page for full specs."""
    page = fetcher.get(url, timeout=20)
    if page.status != 200:
        return None

    html = page.body.decode("utf-8", errors="replace")
    text = re.sub(r'<[^>]+>', ' ', html)
    text = re.sub(r'\s+', ' ', text)
    boat = {"id": boat_id, "url": url}

    # Name — extract from URL slug (most reliable): /2017-lagoon-560/no-name-lagoon-560/389854
    url_parts = url.rstrip("/").split("/")
    if len(url_parts) >= 3:
        # Slug is the make-model part: "2017-lagoon-560"
        slug = url_parts[-3]  # e.g. "2017-lagoon-560"
        name = re.sub(r'^\d{4}-', '', slug).replace("-", " ").title()
        boat["name"] = name

    # Price — "Asking Price</span><p>$1,295,000</p>" pattern
    price_m = re.search(r'Asking\s+Price</span>\s*<p>\s*([£$€][\d,]+)', html, re.I)
    if price_m:
        boat["price"] = price_m.group(1)
    else:
        # Fallback: "Price" label near a dollar amount
        price_m = re.search(r'(?:Price|Asking)[^<]*<[^>]*>\s*([£$€][\d,]+)', html, re.I)
        if price_m:
            boat["price"] = price_m.group(1)

    # Year — from "Year Built" or "Model Year" fields
    year_m = re.search(r'(?:Year\s+Built|Model\s+Year)[:\s]+(\d{4})', text, re.I)
    if year_m:
        boat["year"] = year_m.group(1)
    else:
        year_m = re.search(r'\b(19[6-9]\d|20[0-2]\d)\b', url)
        if year_m:
            boat["year"] = year_m.group(1)

    # Length
    len_m = re.search(r"(?:Length|LOA)[:\s]+(\d+)['\s]*(?:\d+)?[\"']?\s*\(?\s*(\d+(?:\.\d+)?)\s*m", text, re.I)
    if len_m:
        boat["length"] = f"{len_m.group(1)}'"
    else:
        len_m = re.search(r"(\d+)['\s]*(?:\d+)?[\"']?\s*\(\s*[\d.]+\s*m\s*\)", text)
        if len_m:
            boat["length"] = f"{len_m.group(1)}'"

    # Beam
    beam_m = re.search(r"Beam[:\s]+(\d+)['\s]", text, re.I)
    if beam_m:
        boat["beam"] = f"{beam_m.group(1)}'"

    # Draft
    draft_m = re.search(r"Draft[:\s]+(\d+)['\s]", text, re.I)
    if draft_m:
        boat["draft"] = f"{draft_m.group(1)}'"

    # Location
    loc_m = re.search(r'(?:Location|Located)[:\s]+([A-Z][a-zA-Z\s,]+?)(?:\s{2,}|\.|United States)', text, re.I)
    if loc_m:
        boat["location"] = loc_m.group(1).strip().rstrip(",")

    # Engine
    engine_m = re.search(r'(?:Engine|Engines?)[:\s]+(.+?)(?:Fuel|Propeller|Hours|$)', text, re.I)
    if engine_m:
        boat["engine"] = engine_m.group(1).strip()[:100]

    # Hull type
    hull_m = re.search(r'Hull\s+(?:Material|Type)[:\s]+(\w+)', text, re.I)
    if hull_m:
        boat["hull"] = hull_m.group(1)

    # Rigging
    rig_m = re.search(r'Rig\s+Type[:\s]+(\w+)', text, re.I)
    if rig_m:
        boat["rigging"] = rig_m.group(1)

    # Images
    images = []
    for img_m in re.finditer(r'/BoatImages/\d+/[^"\'>\s]+\.(?:webp|jpg|jpeg|png)', html):
        img_url = BASE + img_m.group()
        if img_url not in images:
            images.append(img_url)
    boat["images"] = images[:15]

    return boat if boat.get("name") else None


def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 100

    print(f"Scraping catamarans.com detail pages (limit={limit})...")
    urls = get_listing_urls(limit)
    print(f"\nFound {len(urls)} listings. Scraping details...\n")

    boats = []
    for i, (bid, url) in enumerate(urls):
        boat = scrape_detail(bid, url)
        if boat:
            boats.append(boat)
            if (i + 1) <= 5 or (i + 1) % 50 == 0:
                name = boat.get("name", "?")
                price = boat.get("price", "N/A")
                year = boat.get("year", "?")
                imgs = len(boat.get("images", []))
                print(f"  [{i+1}/{len(urls)}] {year} {name[:40]} | {price} | {imgs} photos")
        time.sleep(0.5)  # Be respectful

    output_path = "/tmp/scraped_catamarans_com.json"
    with open(output_path, "w") as f:
        json.dump(boats, f, indent=2)

    print(f"\nDone! {len(boats)} boats saved to {output_path}")


if __name__ == "__main__":
    main()
