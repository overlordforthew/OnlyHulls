#!/usr/bin/env python3
"""Scrape sailboat listings from boats.com using Scrapling with browser automation.

Designed to run in GitHub Actions where Azure IPs bypass Cloudflare blocks
that affect our Hetzner server IP.

Usage:
    python scrape_boats_com.py [limit]    # default: 20
    python scrape_boats_com.py 50

Output:
    scraped_boats.json in current directory
"""

import json
import re
import sys

from scrapling.fetchers import StealthyFetcher

BASE = "https://www.boats.com"
LIST_URL = f"{BASE}/boats-for-sale/?type=sailboat&sort=newest"


def scrape_boats_com(limit=20):
    """Scrape boat listings from boats.com using headless browser."""
    fetcher = StealthyFetcher()

    print(f"Loading boats.com listings (headless browser, limit={limit})...")
    try:
        page = fetcher.fetch(
            LIST_URL,
            headless=True,
            network_idle=True,
            timeout=30,
        )
    except Exception as e:
        print(f"Fetch failed: {e}")
        return []

    if not page:
        print("No response received")
        return []

    print(f"HTTP {page.status}")
    if page.status != 200:
        print("Non-200 response — likely still blocked")
        return []

    html = page.body.decode("utf-8", errors="replace")

    # Try to extract embedded JSON first (fast path, no DOM traversal needed)
    boats = _extract_from_json(html, limit)
    if boats:
        print(f"Extracted {len(boats)} boats from embedded JSON")
        return boats

    # Fall back to DOM scraping
    print("No embedded JSON found, parsing DOM...")
    boats = _extract_from_dom(page, html, limit)
    print(f"Extracted {len(boats)} boats from DOM")
    return boats


def _extract_from_json(html, limit):
    """Try to pull structured listing data from embedded JSON in the page."""
    # Next.js / React data patterns
    patterns = [
        r'window\.__NEXT_DATA__\s*=\s*(\{.+?\})\s*;?\s*</script>',
        r'"searchResults"\s*:\s*(\[.+?\])\s*[,}]',
        r'"listings"\s*:\s*(\[.+?\])\s*[,}]',
        r'"boats"\s*:\s*(\[.+?\])\s*[,}]',
    ]

    for pattern in patterns:
        m = re.search(pattern, html, re.DOTALL)
        if not m:
            continue
        try:
            raw = json.loads(m.group(1))
            listings = _find_listings_in_obj(raw)
            if listings:
                return [_parse_json_listing(l) for l in listings[:limit] if _parse_json_listing(l)]
        except (json.JSONDecodeError, Exception):
            continue

    return []


def _find_listings_in_obj(obj, depth=0):
    """Recursively find a list of boat-like dicts inside nested JSON."""
    if depth > 6:
        return None

    if isinstance(obj, list) and len(obj) > 0:
        sample = obj[0]
        if isinstance(sample, dict):
            boat_keys = {'make', 'model', 'year', 'price', 'boatId', 'id', 'name', 'length'}
            if len(boat_keys & set(sample.keys())) >= 2:
                return obj

    if isinstance(obj, dict):
        for key in ('listings', 'boats', 'results', 'items', 'searchResults', 'data'):
            if key in obj:
                result = _find_listings_in_obj(obj[key], depth + 1)
                if result:
                    return result
        for val in obj.values():
            if isinstance(val, (dict, list)):
                result = _find_listings_in_obj(val, depth + 1)
                if result:
                    return result

    return None


def _parse_json_listing(listing):
    """Normalize a raw JSON listing dict into our standard boat schema."""
    if not isinstance(listing, dict):
        return None

    boat = {}

    # Name: try various field combos
    if listing.get('make') and listing.get('model'):
        boat['name'] = f"{listing['make']} {listing['model']}".strip()
    else:
        for f in ('name', 'title', 'boatName', 'model'):
            if listing.get(f):
                boat['name'] = str(listing[f]).strip()
                break

    # Standard fields
    field_map = {
        'year':        ('year', 'modelYear', 'model_year'),
        'price':       ('price', 'askingPrice', 'asking_price', 'displayPrice', 'priceDisplay'),
        'length':      ('length', 'loa', 'lengthOverall', 'length_ft', 'lengthFt'),
        'beam':        ('beam', 'beamFt'),
        'location':    ('location', 'city', 'locationCity', 'location_city', 'locationLabel'),
        'hull':        ('hullMaterial', 'hull_material', 'hull'),
        'engine':      ('engine', 'engines', 'engineCount'),
        'description': ('description', 'desc', 'summary', 'overview'),
        'url':         ('url', 'link', 'detailUrl', 'detail_url', 'boatUrl'),
    }

    for key, candidates in field_map.items():
        for candidate in candidates:
            if listing.get(candidate):
                boat[key] = str(listing[candidate]).strip()
                break

    # URL: ensure absolute
    if boat.get('url') and boat['url'].startswith('/'):
        boat['url'] = BASE + boat['url']

    # Images
    for f in ('photos', 'images', 'media', 'imageUrls', 'thumbnails'):
        if isinstance(listing.get(f), list):
            imgs = []
            for img in listing[f]:
                if isinstance(img, str):
                    imgs.append(img)
                elif isinstance(img, dict):
                    imgs.append(img.get('url') or img.get('src') or img.get('href') or '')
            boat['images'] = [i for i in imgs if i][:15]
            break

    return boat if boat.get('name') else None


def _extract_from_dom(page, html, limit):
    """Parse boat listings from rendered DOM elements."""
    boats = []

    # Selector candidates (boats.com uses class names that may vary)
    selector_groups = [
        '[data-testid="boat-card"]',
        '[class*="BoatCard"]',
        '[class*="listing-card"]',
        '[class*="boat-listing"]',
        '[class*="search-result-item"]',
        'article[class*="result"]',
    ]

    cards = []
    for sel in selector_groups:
        cards = page.css(sel)
        if cards:
            print(f"Found {len(cards)} cards with selector: {sel}")
            break

    if not cards:
        # Generic fallback: any article or li with a price-looking element
        cards = page.css('article, li[class*="result"]')
        print(f"Fallback: found {len(cards)} generic cards")

    for i, card in enumerate(cards[:limit]):
        boat = {}

        # Title
        title_el = card.css_first('h2, h3, h4, [class*="title"], [class*="name"]')
        if title_el:
            boat['name'] = str(title_el.get_all_text()).strip()

        # Price
        price_el = card.css_first('[class*="price"]')
        if price_el:
            boat['price'] = str(price_el.get_all_text()).strip()

        # Specs: year, length, location often in small tag spans
        for spec_el in card.css('[class*="spec"], [class*="detail"], span, li'):
            text = str(spec_el.get_all_text()).strip()
            if re.match(r'^\d{4}$', text) and 1960 <= int(text) <= 2030:
                boat.setdefault('year', text)
            elif re.search(r'\d+(\.\d+)?\s*(ft|m|\')', text, re.I):
                boat.setdefault('length', text)

        # Location
        loc_el = card.css_first('[class*="location"], [class*="city"], [class*="geo"]')
        if loc_el:
            boat['location'] = str(loc_el.get_all_text()).strip()

        # URL
        link_el = card.css_first('a[href]')
        if link_el:
            href = link_el.attrib.get('href', '')
            boat['url'] = BASE + href if href.startswith('/') else href

        # Images
        imgs = card.css('img[src]')
        boat['images'] = [img.attrib.get('src', '') for img in imgs if img.attrib.get('src')]

        if boat.get('name'):
            boats.append(boat)
            print(f"  [{i+1}] {boat.get('year','?')} {boat['name']} | {boat.get('price','N/A')} | {boat.get('location','?')}")

    return boats


def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 20

    boats = scrape_boats_com(limit)

    output_path = "scraped_boats.json"
    with open(output_path, "w") as f:
        json.dump(boats, f, indent=2)

    print(f"\nDone! {len(boats)} boats saved to {output_path}")
    if not boats:
        print("WARNING: 0 boats scraped — check logs above for blocking or selector issues")
        sys.exit(1)


if __name__ == "__main__":
    main()
