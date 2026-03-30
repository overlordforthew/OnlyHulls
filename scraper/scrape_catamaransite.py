#!/usr/bin/env python3
"""Scrape cruising catamaran listings from catamaransite.com.

JSON-LD structured data, curated listings.

Usage: python scrape_catamaransite.py [limit]
"""
import json, re, sys
from scrapling import Fetcher

BASE = "https://www.catamaransite.com"
fetcher = Fetcher()

def scrape_page(url):
    page = fetcher.get(url, timeout=20)
    if page.status != 200: return []
    html = page.body.decode("utf-8", errors="replace")
    boats = []

    # Try JSON-LD first
    for block_m in re.finditer(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>', html, re.DOTALL):
        try:
            data = json.loads(block_m.group(1))
            items = []
            if isinstance(data, list): items = data
            elif data.get("@type") == "ItemList": items = data.get("itemListElement", [])
            elif data.get("@type") == "Product": items = [data]

            for item in items:
                product = item.get("item", item) if isinstance(item, dict) else item
                if not isinstance(product, dict) or product.get("@type") != "Product": continue

                boat = {}
                if product.get("name"): boat["name"] = product["name"]
                if product.get("url"):
                    u = product["url"]
                    boat["url"] = BASE + u if u.startswith("/") else u

                offers = product.get("offers", {})
                if isinstance(offers, list): offers = offers[0] if offers else {}
                if offers.get("price"):
                    price = float(offers["price"])
                    if price > 500:
                        currency = offers.get("priceCurrency", "USD")
                        sym = {"USD": "$", "EUR": "€", "GBP": "£"}.get(currency, "$")
                        boat["price"] = f"{sym}{price:,.0f}"

                if product.get("image"):
                    img = product["image"]
                    boat["images"] = [img] if isinstance(img, str) else img[:5]
                else:
                    boat["images"] = []

                # Year from name
                year_m = re.search(r'\b(19[5-9]\d|20[0-2]\d)\b', boat.get("name", ""))
                if year_m: boat["year"] = year_m.group(1)

                if boat.get("name") and boat.get("price"): boats.append(boat)
        except: continue

    # Fallback: parse links
    if not boats:
        links = re.findall(r'/yachts-for-sale/([^"]+?)/', html)
        seen = set()
        for slug in links:
            if slug in seen: continue
            seen.add(slug)
            boat = {"url": f"{BASE}/yachts-for-sale/{slug}/"}
            name = slug.replace("-", " ").title()
            boat["name"] = name

            ctx_idx = html.find(slug)
            if ctx_idx >= 0:
                ctx = re.sub(r'<[^>]+>', ' ', html[max(0,ctx_idx-400):ctx_idx+400])
                price_m = re.search(r'[€$]([\d,]{4,})', ctx)
                if price_m: boat["price"] = price_m.group(0)
                year_m = re.search(r'\b(20[0-2]\d)\b', ctx)
                if year_m: boat["year"] = year_m.group(1)

            boat["images"] = []
            if boat.get("name") and boat.get("price"): boats.append(boat)

    return boats

def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    print(f"Scraping catamaransite.com (limit={limit})...")
    boats = scrape_page(BASE)[:limit]
    with open("/tmp/scraped_catamaransite.json", "w") as f: json.dump(boats, f, indent=2)
    print(f"Done! {len(boats)} boats saved")

if __name__ == "__main__": main()
