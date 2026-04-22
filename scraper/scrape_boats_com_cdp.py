#!/usr/bin/env python3
"""Prototype B: boats.com scraper via CDP against an already-running headful Chrome.

Differs from scrape_boats_com.py (Prototype A, Scrapling/Camoufox) by attaching to
Elmo's persistent Chrome session at 127.0.0.1:9223 — inheriting its cookies,
fingerprint, and extensions. Same schema, same output, same Cloudflare defenses,
same human pacing.

Usage:
    python scrape_boats_com_cdp.py [pages]   # default: 5

Output:
    /tmp/scraped_boats_cdp.json
    /tmp/boats_com_cdp_run.json
    /tmp/boats_com_cdp_cloudflare.flag
    /tmp/boats_com_cdp_suspicious.flag
"""

import json
import random
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

BASE = "https://www.boats.com"
LIST_URL = f"{BASE}/boats-for-sale/?class=sail"
CDP_URL = "http://127.0.0.1:9223"

OUTPUT_JSON = Path("/tmp/scraped_boats_cdp.json")
RUN_METRICS = Path("/tmp/boats_com_cdp_run.json")
CLOUDFLARE_FLAG = Path("/tmp/boats_com_cdp_cloudflare.flag")
SUSPICIOUS_FLAG = Path("/tmp/boats_com_cdp_suspicious.flag")

PAGE_PAUSE_MIN = 30
PAGE_PAUSE_MAX = 75
INITIAL_WARMUP_MIN = 4
INITIAL_WARMUP_MAX = 12

CF_H1_MARKERS = (
    "gateway time-out",
    "just a moment",
    "attention required",
    "access denied",
    "error 1020",
    "error 1015",
)
CF_TITLE_MARKERS = ("internal server error",) + CF_H1_MARKERS
CF_BLOCK_STATUS = {403, 429, 503, 520, 521, 522, 523, 524, 525, 526, 527}
CF_HEADER_HINTS = ("cf-ray", "cf-cache-status", "cf-chl-bypass", "cf-mitigated")
CF_SERVER_SUBSTRINGS = ("cloudflare",)

# Extractor runs once in the page and returns the cards in one call.
EXTRACTOR_JS = r"""
() => {
  const absolute = (src) => {
    if (!src) return null;
    const s = src.trim();
    if (s.startsWith('//')) return 'https:' + s;
    if (s.startsWith('/')) return 'https://www.boats.com' + s;
    if (s.startsWith('http://') || s.startsWith('https://')) return s;
    return null;
  };
  const first = (root, sel) => {
    const el = root.querySelector(sel);
    return el ? (el.innerText || '').trim() : '';
  };
  const cards = Array.from(document.querySelectorAll('[data-listing-id]'));
  const out = [];
  for (const card of cards) {
    const id = (card.getAttribute('data-listing-id') || '').trim();
    if (!id) continue;
    const link = card.querySelector('a[href*="/sailing-boats/"]');
    if (!link) continue;
    const href = link.getAttribute('href') || '';
    if (!href) continue;
    const url = href.startsWith('/') ? 'https://www.boats.com' + href : href;
    const name = first(card, 'h2') || first(card, 'h3');
    if (!name) continue;
    const imgEls = card.querySelectorAll('img');
    const images = [];
    for (const im of imgEls) {
      const abs = absolute(im.getAttribute('data-src') || im.getAttribute('src'));
      if (abs && !images.includes(abs)) images.push(abs);
      if (images.length >= 15) break;
    }
    const sellerRaw = first(card, '.seller');
    const seller = sellerRaw.replace(/^\s*Seller\s*/i, '').trim();
    out.push({
      id,
      name,
      year: first(card, '.year'),
      price: first(card, '.price'),
      location: first(card, '.country'),
      seller,
      url,
      images,
    });
  }
  return out;
}
"""


def human_pause(label, lo, hi):
    delay = random.uniform(lo, hi)
    print(f"  pause {delay:.1f}s ({label})", flush=True)
    time.sleep(delay)


def classify_cloudflare(status, headers, title_text, h1_text, cards_count):
    if status and status in CF_BLOCK_STATUS:
        return True, f"status={status}"

    header_keys_lower = {str(k).lower(): str(v).lower() for k, v in (headers or {}).items()}
    server = header_keys_lower.get("server", "")
    has_cf_header = any(h in header_keys_lower for h in CF_HEADER_HINTS) or any(
        s in server for s in CF_SERVER_SUBSTRINGS
    )

    title_lower = (title_text or "").lower()
    if any(m in title_lower for m in CF_TITLE_MARKERS):
        return True, f"title_marker:{title_lower[:60]}"

    h1_lower = (h1_text or "").lower()
    if any(m in h1_lower for m in CF_H1_MARKERS) and cards_count == 0:
        return True, f"h1_cf_marker:{h1_lower[:60]}"

    if status and status != 200 and has_cf_header:
        return True, f"status={status}+cf_header"
    if status == 200 and cards_count == 0 and has_cf_header:
        return True, "200+zero_cards+cf_header"
    return False, ""


def write_cf_flag(page_num, url, status, reason):
    CLOUDFLARE_FLAG.write_text(json.dumps({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "page": page_num,
        "url": url,
        "status": status,
        "reason": reason,
    }, indent=2))


def goto(page, url, referer=None):
    """Navigate and return (status, headers_dict). Empty values if no response object."""
    resp = page.goto(url, wait_until="domcontentloaded", timeout=45000, referer=referer)
    if not resp:
        return None, {}
    try:
        headers = resp.all_headers()
    except Exception:
        headers = {}
    return resp.status, headers


def wait_for_cards_or_settled(page, timeout_ms=10000):
    """Wait for listing cards OR a fully-settled page.

    Prefer listing cards; fall through on timeout. Returns when we're ready
    to extract, regardless of outcome.
    """
    try:
        page.wait_for_selector("[data-listing-id]", timeout=timeout_ms)
    except PWTimeout:
        # No cards yet — could be empty result, could be challenge. Let classify_cloudflare decide.
        try:
            page.wait_for_load_state("networkidle", timeout=3000)
        except PWTimeout:
            pass


def main():
    pages = 5
    if len(sys.argv) > 1:
        try:
            pages = int(sys.argv[1])
        except ValueError:
            print(f"Usage: scrape_boats_com_cdp.py [pages]. Got: {sys.argv[1]!r}", flush=True)
            sys.exit(64)
        if pages < 1 or pages > 200:
            print(f"pages out of range (1..200): {pages}", flush=True)
            sys.exit(64)

    CLOUDFLARE_FLAG.unlink(missing_ok=True)
    SUSPICIOUS_FLAG.unlink(missing_ok=True)

    boats_by_id = {}
    cf_hits = 0
    http_errors = 0
    suspicious_empty = 0
    started = datetime.now(timezone.utc)

    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp(CDP_URL)
        # Isolated context so our navigation, cookies, and storage do NOT touch
        # whatever tabs the user has open in the headful Chrome session.
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1440, "height": 900},
        )
        page = context.new_page()

        print(f"boats.com scrape (CDP): pages=1..{pages}", flush=True)
        human_pause("initial jitter", INITIAL_WARMUP_MIN, INITIAL_WARMUP_MAX)

        referer = "https://www.google.com/"

        try:
            for page_num in range(1, pages + 1):
                url = LIST_URL if page_num == 1 else f"{LIST_URL}&page={page_num}"
                print(f"[page {page_num}] GOTO {url}", flush=True)

                try:
                    status, headers = goto(page, url, referer=referer)
                except PWTimeout:
                    print("  navigation timeout — aborting", flush=True)
                    http_errors += 1
                    break
                except Exception as e:
                    print(f"  nav error: {e}", flush=True)
                    http_errors += 1
                    break

                wait_for_cards_or_settled(page, timeout_ms=10000)

                title = page.title() or ""
                h1_text = page.evaluate("() => { const h = document.querySelector('h1'); return h ? h.innerText : ''; }") or ""
                cards = page.evaluate(EXTRACTOR_JS)

                is_cf, cf_reason = classify_cloudflare(status, headers, title, h1_text, len(cards))
                if is_cf:
                    print(f"  Cloudflare detected ({cf_reason}) — aborting", flush=True)
                    write_cf_flag(page_num, url, status, cf_reason)
                    cf_hits += 1
                    break

                if status and status != 200:
                    print(f"  HTTP {status} — aborting", flush=True)
                    http_errors += 1
                    break

                new_on_page = 0
                for b in cards:
                    if not b.get("id") or b["id"] in boats_by_id:
                        continue
                    boats_by_id[b["id"]] = b
                    new_on_page += 1
                print(f"  page {page_num}: {new_on_page} new, {len(boats_by_id)} total", flush=True)

                if new_on_page == 0:
                    suspicious_empty += 1
                    SUSPICIOUS_FLAG.write_text(json.dumps({
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "page": page_num,
                        "url": url,
                        "cards_seen": len(cards),
                        "title": title,
                    }, indent=2))
                    print("  zero new listings — stopping", flush=True)
                    break

                referer = url
                if page_num < pages:
                    human_pause(f"between page {page_num} and {page_num+1}", PAGE_PAUSE_MIN, PAGE_PAUSE_MAX)
        finally:
            page.close()
            # The isolated context can be dropped cleanly; it only existed for this run.
            try:
                context.close()
            except Exception:
                pass
            # Do NOT close the browser — it's the user's persistent Chrome.

    boats = list(boats_by_id.values())
    OUTPUT_JSON.write_text(json.dumps(boats, indent=2))

    duration = (datetime.now(timezone.utc) - started).total_seconds()
    metrics = {
        "started_at": started.isoformat(),
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "duration_seconds": round(duration, 1),
        "pages_requested": pages,
        "boats_scraped": len(boats),
        "cloudflare_hits": cf_hits,
        "http_errors": http_errors,
        "suspicious_empty_pages": suspicious_empty,
        "output_path": str(OUTPUT_JSON),
        "technique": "playwright_connect_over_cdp",
    }
    RUN_METRICS.write_text(json.dumps(metrics, indent=2))

    print(f"\nDone. {len(boats)} boats → {OUTPUT_JSON}", flush=True)
    print(f"Metrics → {RUN_METRICS}", flush=True)
    if cf_hits:
        sys.exit(2)
    if not boats:
        sys.exit(1)


if __name__ == "__main__":
    main()
