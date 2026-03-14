#!/usr/bin/env python3
"""Scrape sailboat listings from sailboatlistings.com using Scrapling."""

import json
import re
import sys
from scrapling import Fetcher

BASE = "https://www.sailboatlistings.com"
LIST_URL = f"{BASE}/cgi-bin/saildata/db.cgi?db=default&uid=default&view_records=1&ID=*&sb=date&so=descend"

fetcher = Fetcher()


def get_listing_urls(page, limit=10):
    """Extract unique boat listing URLs from the index page."""
    seen = []
    for link in page.css('a[href*="/view/"]'):
        href = link.attrib.get("href", "")
        m = re.search(r"/view/(\d+)", href)
        if m and m.group(1) not in [s[0] for s in seen]:
            seen.append((m.group(1), f"{BASE}/view/{m.group(1)}"))
            if len(seen) >= limit:
                break
    return seen


def extract_text(el):
    """Safely extract text from an element."""
    if el is None:
        return ""
    t = el.get_all_text()
    return str(t).strip() if t else ""


def scrape_boat(boat_id, url):
    """Scrape a single boat detail page using HTML table structure."""
    page = fetcher.get(url, timeout=15)
    if page.status != 200:
        return None

    boat = {"id": boat_id, "url": url}
    html = page.body.decode("utf-8", errors="replace")

    # Name from title
    title_m = re.search(r"<title>([^<]+)</title>", html)
    if title_m:
        name = title_m.group(1).split(" - ")[0].split(" for sale")[0].strip()
        boat["name"] = name

    # Parse spec tables: header row has labels, next row has values
    # Pattern: row of labels (Year/Length/Beam/Draft/Location/Price), then row of values
    rows = page.css("tr")
    for i, row in enumerate(rows):
        cells = row.css("td")
        cell_texts = [extract_text(c) for c in cells]

        # Check if this is a label row
        if "Year" in cell_texts and "Length" in cell_texts:
            # Next row has the values
            if i + 1 < len(rows):
                val_cells = rows[i + 1].css("td")
                val_texts = [extract_text(c) for c in val_cells]
                for j, label in enumerate(cell_texts):
                    if j < len(val_texts) and val_texts[j]:
                        key = label.lower().strip()
                        if key in ("year", "length", "beam", "draft", "location", "price"):
                            boat[key] = val_texts[j]

        # Second spec row: Hull, Type, Rigging, Engine etc
        if "Hull" in cell_texts and "Type" in cell_texts:
            if i + 1 < len(rows):
                val_cells = rows[i + 1].css("td")
                val_texts = [extract_text(c) for c in val_cells]
                for j, label in enumerate(cell_texts):
                    if j < len(val_texts) and val_texts[j]:
                        key = label.lower().strip()
                        if key in ("hull", "type", "rigging", "engine"):
                            boat[key] = val_texts[j]

    # Extract description
    desc_m = re.search(
        r"(?:Description|Sailboat\s+Description)[:\s]*(.*?)(?:Specifications|<table|Contact|Email|Phone)",
        html,
        re.DOTALL | re.IGNORECASE,
    )
    if desc_m:
        desc = re.sub(r"<[^>]+>", " ", desc_m.group(1))
        desc = re.sub(r"\s+", " ", desc).strip()[:500]
        if len(desc) > 20:
            boat["description"] = desc

    # Extract images
    imgs = page.css("img[src*='/sailimg/']")
    images = []
    for img in imgs:
        src = img.attrib.get("src", "")
        if src:
            full = BASE + src.replace("/t/", "/l/")
            if full not in images:
                images.append(full)
    boat["images"] = images

    return boat


def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 10

    print(f"Fetching listing index...")
    page = fetcher.get(LIST_URL, timeout=15)
    if page.status != 200:
        print(f"Failed: {page.status}")
        return

    urls = get_listing_urls(page, limit)
    print(f"Found {len(urls)} unique listings. Scraping details...\n")

    boats = []
    for i, (boat_id, url) in enumerate(urls):
        boat = scrape_boat(boat_id, url)
        if boat:
            boats.append(boat)
            name = boat.get("name", "Unknown")
            year = boat.get("year", "?")
            price = boat.get("price", "N/A")
            loc = boat.get("location", "?")
            length = boat.get("length", "?")
            hull = boat.get("hull", "?")
            n_imgs = len(boat.get("images", []))
            print(f"  [{i+1}/{len(urls)}] {year} {name} | {length} | {hull} | {loc} | {price} | {n_imgs} photos")
        else:
            print(f"  [{i+1}/{len(urls)}] Failed to scrape {url}")

    # Save results
    output_path = "/tmp/scraped_boats.json"
    with open(output_path, "w") as f:
        json.dump(boats, f, indent=2)

    print(f"\nDone! {len(boats)} boats saved to {output_path}")


if __name__ == "__main__":
    main()
