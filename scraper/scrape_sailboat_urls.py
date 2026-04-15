#!/usr/bin/env python3
"""Scrape explicit sailboatlistings detail URLs into import-ready JSON."""

import argparse
import json
import re
from pathlib import Path

from scrape_sailboats import scrape_boat


def parse_args():
    parser = argparse.ArgumentParser(
        description="Scrape specific sailboatlistings detail URLs into JSON."
    )
    parser.add_argument("--input", required=True, help="Path to input JSON array")
    parser.add_argument("--output", required=True, help="Path to output JSON array")
    return parser.parse_args()


def normalize_candidates(raw_candidates):
    candidates = []
    for item in raw_candidates:
        if isinstance(item, str):
            url = item
            boat_id = None
        else:
            url = str(item.get("url") or "").strip()
            boat_id = str(item.get("id") or "").strip() or None

        if not url:
            continue

        if not boat_id:
            match = re.search(r"/view/(\d+)", url)
            boat_id = match.group(1) if match else None

        if not boat_id:
            continue

        candidates.append({"id": boat_id, "url": url})

    return candidates


def main():
    args = parse_args()
    input_path = Path(args.input)
    output_path = Path(args.output)
    raw_candidates = json.loads(input_path.read_text())
    candidates = normalize_candidates(raw_candidates)

    boats = []
    for index, candidate in enumerate(candidates, start=1):
        boat = scrape_boat(candidate["id"], candidate["url"])
        if boat:
            boats.append(boat)
        if index <= 5 or index % 50 == 0:
            print(f"[{index}/{len(candidates)}] scraped {candidate['id']} -> {'ok' if boat else 'failed'}")

    output_path.write_text(json.dumps(boats, indent=2))
    print(
        json.dumps(
            {
                "selected": len(candidates),
                "scraped": len(boats),
                "output": str(output_path),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
