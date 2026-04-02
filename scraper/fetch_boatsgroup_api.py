#!/usr/bin/env python3
"""Fetch sailboat listings from the Boats Group Inventory API.

Covers BoatTrader, YachtWorld, and boats.com via a single unified API.
Requires an API key from Boats Group (https://api.boats.com/docs).

Usage:
    python fetch_boatsgroup_api.py [limit]           # default: 500
    python fetch_boatsgroup_api.py 2000

    # Filter by site:
    BOATSGROUP_SITE=boattrader python fetch_boatsgroup_api.py 1000
    BOATSGROUP_SITE=yachtworld python fetch_boatsgroup_api.py 1000

Environment:
    BOATSGROUP_API_KEY  — Required. API key from Boats Group.
    BOATSGROUP_SITE     — Optional. Filter: "boattrader", "yachtworld", or "all" (default).

Output:
    /tmp/scraped_boatsgroup.json  (or per-site files if BOATSGROUP_SITE=all)
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error
import urllib.parse


API_BASE = "https://api.boats.com/inventory/search"
PAGE_SIZE = 100  # rows per request (API max TBD — start conservative)

# Map API site IDs to output files and source keys
SITES = {
    "boattrader": {"param": "BtolID", "output": "/tmp/scraped_boattrader.json", "url_base": "https://www.boattrader.com"},
    "yachtworld": {"param": "YachtWorldID", "output": "/tmp/scraped_yachtworld.json", "url_base": "https://www.yachtworld.com"},
}


def fetch_page(api_key, offset=0, rows=PAGE_SIZE, extra_params=None):
    """Fetch one page of sailboat listings from the API."""
    params = {
        "key": api_key,
        "BoatCategoryCode": "SAIL",
        "condition": "used",
        "status": "Active",
        "rows": str(rows),
        "offset": str(offset),
        "fields": ",".join([
            "DocumentID", "MakeString", "Model", "ModelYear",
            "NominalLength", "BeamMeasure", "DraftMeasure",
            "TotalPrice", "PriceCurrency",
            "BoatLocation.BoatCityName", "BoatLocation.BoatStateCode", "BoatLocation.BoatCountryID",
            "HullMaterialCode", "EngineManufacturerName", "TotalEnginePowerQuantity",
            "BoatDescription", "Images",
            "BtolID", "YachtWorldID", "BcnaID",
            "NumberOfCabins", "NumberOfBerthsRange",
            "FuelTypeName", "RiggingTypeName", "KeelTypeCode",
            "DisplacementMeasure",
        ]),
    }
    if extra_params:
        params.update(extra_params)

    url = f"{API_BASE}?{urllib.parse.urlencode(params)}"

    req = urllib.request.Request(url, headers={
        "Accept": "application/vnd.dmm-v1+json",
        "User-Agent": "OnlyHulls/1.0 (onlyhulls.com)",
    })

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"  HTTP {e.code}: {body[:200]}")
        return None
    except Exception as e:
        print(f"  Request failed: {e}")
        return None


def map_listing(item):
    """Map an API listing to the ScrapedBoat JSON schema."""
    boat = {}

    make = (item.get("MakeString") or "").strip()
    model = (item.get("Model") or "").strip()
    year = item.get("ModelYear")

    if make and model:
        boat["name"] = f"{year} {make} {model}".strip() if year else f"{make} {model}"
    elif make:
        boat["name"] = f"{year} {make}".strip() if year else make
    else:
        return None  # no make = skip

    if year:
        boat["year"] = str(year)

    # Price
    price = item.get("TotalPrice")
    currency = item.get("PriceCurrency", "USD")
    if price:
        boat["price"] = str(price)
        boat["currency"] = currency

    # Dimensions
    length = item.get("NominalLength")
    if length:
        boat["length"] = str(length)

    beam = item.get("BeamMeasure")
    if beam:
        boat["beam"] = str(beam)

    draft = item.get("DraftMeasure")
    if draft:
        boat["draft"] = str(draft)

    # Location
    loc_parts = []
    loc = item.get("BoatLocation") or item
    city = loc.get("BoatCityName") or item.get("BoatLocation.BoatCityName")
    state = loc.get("BoatStateCode") or item.get("BoatLocation.BoatStateCode")
    country = loc.get("BoatCountryID") or item.get("BoatLocation.BoatCountryID")
    if city:
        loc_parts.append(str(city))
    if state:
        loc_parts.append(str(state))
    if country and country != "US":
        loc_parts.append(str(country))
    if loc_parts:
        boat["location"] = ", ".join(loc_parts)

    # Specs
    hull = item.get("HullMaterialCode")
    if hull:
        boat["hull"] = str(hull)

    engine_make = item.get("EngineManufacturerName") or ""
    engine_hp = item.get("TotalEnginePowerQuantity") or ""
    if engine_make or engine_hp:
        boat["engine"] = f"{engine_make} {engine_hp}hp".strip() if engine_hp else engine_make

    rigging = item.get("RiggingTypeName")
    if rigging:
        boat["rigging"] = str(rigging)

    fuel = item.get("FuelTypeName")
    if fuel:
        boat["fuel_type"] = str(fuel)

    keel = item.get("KeelTypeCode")
    if keel:
        boat["keel_type"] = str(keel)

    displacement = item.get("DisplacementMeasure")
    if displacement:
        boat["displacement"] = str(displacement)

    cabins = item.get("NumberOfCabins")
    if cabins:
        boat["cabins"] = str(cabins)

    berths = item.get("NumberOfBerthsRange")
    if berths:
        boat["berths"] = str(berths)

    # Description
    desc = item.get("BoatDescription")
    if desc:
        boat["description"] = str(desc).strip()

    # Images
    images_raw = item.get("Images") or []
    if isinstance(images_raw, list):
        boat["images"] = [
            img.get("Uri") or img.get("uri") or img.get("URL") or ""
            for img in images_raw
            if isinstance(img, dict)
        ]
        boat["images"] = [u for u in boat["images"] if u][:15]

    # URL — construct from site-specific IDs
    doc_id = item.get("DocumentID")
    btol_id = item.get("BtolID")
    yw_id = item.get("YachtWorldID")

    if btol_id:
        slug = f"{year}-{make}-{model}-{btol_id}".lower().replace(" ", "-")
        boat["url"] = f"https://www.boattrader.com/boat/{slug}/"
    elif yw_id:
        slug = f"{year}-{make}-{model}-{yw_id}".lower().replace(" ", "-")
        boat["url"] = f"https://www.yachtworld.com/yacht/{slug}/"
    elif doc_id:
        boat["url"] = f"https://www.boats.com/boat/{doc_id}/"

    return boat if boat.get("url") else None


def fetch_all(api_key, limit, extra_params=None):
    """Paginate through all matching listings up to limit."""
    boats = []
    offset = 0
    total = None

    while len(boats) < limit:
        remaining = limit - len(boats)
        rows = min(PAGE_SIZE, remaining)

        print(f"  Fetching offset={offset}, rows={rows}...")
        data = fetch_page(api_key, offset=offset, rows=rows, extra_params=extra_params)

        if not data:
            print("  API returned no data — stopping")
            break

        # Handle different response shapes
        results = []
        if isinstance(data, list):
            results = data
        elif isinstance(data, dict):
            results = (
                data.get("results") or data.get("Results") or
                data.get("listings") or data.get("Listings") or
                data.get("data") or []
            )
            if total is None:
                total = data.get("numResults") or data.get("totalResults") or data.get("total")
                if total:
                    print(f"  Total available: {total}")

        if not results:
            print("  No more results")
            break

        for item in results:
            boat = map_listing(item)
            if boat:
                boats.append(boat)

        print(f"  Got {len(results)} results, {len(boats)} boats total")

        if len(results) < rows:
            break  # last page

        offset += len(results)
        time.sleep(0.5)  # be respectful

    return boats[:limit]


def main():
    api_key = os.environ.get("BOATSGROUP_API_KEY")
    if not api_key:
        print("ERROR: BOATSGROUP_API_KEY environment variable required")
        print("Get a key at: https://www.boatsgroup.com/about-us/contact-us/")
        sys.exit(1)

    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 500
    site = os.environ.get("BOATSGROUP_SITE", "all").lower()

    print(f"Boats Group API fetcher | site={site} | limit={limit}")

    if site == "all":
        # Fetch everything, split by site ID into separate files
        boats = fetch_all(api_key, limit)

        bt_boats = [b for b in boats if "boattrader.com" in b.get("url", "")]
        yw_boats = [b for b in boats if "yachtworld.com" in b.get("url", "")]
        other = [b for b in boats if "boattrader.com" not in b.get("url", "") and "yachtworld.com" not in b.get("url", "")]

        for label, subset, path in [
            ("BoatTrader", bt_boats, "/tmp/scraped_boattrader.json"),
            ("YachtWorld", yw_boats, "/tmp/scraped_yachtworld.json"),
            ("boats.com", other, "/tmp/scraped_boatsgroup_other.json"),
        ]:
            if subset:
                with open(path, "w") as f:
                    json.dump(subset, f, indent=2)
                print(f"  {label}: {len(subset)} boats → {path}")

        total = len(boats)
    else:
        boats = fetch_all(api_key, limit)
        output = SITES.get(site, {}).get("output", f"/tmp/scraped_{site}.json")
        with open(output, "w") as f:
            json.dump(boats, f, indent=2)
        total = len(boats)
        print(f"  {total} boats → {output}")

    print(f"\nDone! {total} sailboats fetched from Boats Group API")
    if total == 0:
        print("WARNING: 0 boats — check API key and parameters")
        sys.exit(1)


if __name__ == "__main__":
    main()
