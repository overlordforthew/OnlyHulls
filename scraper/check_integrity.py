#!/usr/bin/env python3
"""
Data integrity checker for OnlyHulls scraped boat JSON.

Validates scraped data BEFORE import. Run on any scraped JSON file to catch
data quality issues. Outputs a cleaned JSON with bad boats filtered and a
detailed report.

Usage:
  python check_integrity.py <scraped.json> [--fix] [--strict]

  --fix     Output cleaned JSON to <scraped>_clean.json (rejects removed)
  --strict  Treat warnings as rejects (no images, non-English desc, etc.)

Exit codes:
  0 = all clean
  1 = warnings found (data imported but flagged)
  2 = rejects found (bad data blocked)

Rules are cumulative — add new checks here as we find import issues.
"""

import json, re, sys, os
from pathlib import Path

# ──────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────

MIN_PRICE_USD = 500          # Below this = likely junk or accessories
SUSPICIOUS_PRICE_USD = 2000  # Below this = warn (could be legit project boat)
MIN_LOA_FT = 25              # No dinghies
MAX_LOA_FT = 300             # Sanity cap
MIN_YEAR = 1900
MAX_YEAR = 2030
MIN_DESC_LENGTH = 20         # Shorter = probably useless
GOOD_DESC_LENGTH = 100       # Below this = warn

# Dinghy/accessory makes to reject outright
DINGHY_MAKES = re.compile(
    r'^(laser|optimist|sunfish|hobie|nacra|tohatsu|epropulsion|vanguard|bic|zim|'
    r'rs sailing|mclaughlin|dyer|west marine|windrider|fulcrum|winner|bluemagic|'
    r'zoum|zhoum|ko sailing|open|club|trident|cobra)$', re.I
)

# Dinghy/accessory keywords in model
DINGHY_MODELS = re.compile(
    r'\b(inflatable|dinghy|optimist|opti\b|sunfish|laser\b|kayak|canoe|'
    r'paddleboard|sup\b|trolling|outboard motor|tender|rib\b)\b', re.I
)

# Non-English language markers — common words/patterns in frequent source languages
# These appear in broker descriptions that get imported as-is
NON_ENGLISH_MARKERS = {
    'swedish': re.compile(
        r'\b(och|med|för|som|har|kan|det|ett|att|är|från|eller|mycket|båt|'
        r'segelbåt|utrustning|segel|motor|längd|bredd)\b', re.I
    ),
    'german': re.compile(
        r'\b(und|mit|für|das|die|der|ein|eine|oder|auch|ist|auf|aus|nach|'
        r'über|haben|kann|sehr|boot|segelboot|ausstattung|motor|länge|breite)\b', re.I
    ),
    'french': re.compile(
        r'\b(avec|pour|les|des|une|est|qui|dans|sur|par|nous|votre|très|'
        r'bateau|voilier|moteur|longueur|largeur)\b', re.I
    ),
    'dutch': re.compile(
        r'\b(met|voor|een|het|van|zijn|heeft|ook|kan|uit|door|over|'
        r'boot|zeilboot|motor|lengte|breedte)\b', re.I
    ),
    'italian': re.compile(
        r'\b(con|per|una|che|del|della|sono|anche|molto|questa|barca|'
        r'motore|lunghezza|larghezza)\b', re.I
    ),
}

# Minimum non-English word hits to flag as foreign language
NON_ENGLISH_THRESHOLD = 5


# ──────────────────────────────────────────────
# Parsing helpers (mirrors import-scraped.ts)
# ──────────────────────────────────────────────

def parse_price(raw):
    """Extract numeric price from string like '$45,000' or '€170.000'."""
    if raw is None:
        return None
    s = re.sub(r'[^0-9.]', '', str(raw).replace(',', ''))
    try:
        n = float(s)
        return n if n > 0 else None
    except (ValueError, TypeError):
        return None


def parse_number(raw):
    """Parse LOA/beam/draft, handling feet-inches like 13'10\"."""
    if raw is None:
        return None
    s = str(raw)
    # Feet-inches: 13'10" → 13.83
    m = re.match(r"^(\d+)['\u2019]\s*(\d+)?[\"'\u201d]?", s)
    if m:
        feet = int(m.group(1))
        inches = int(m.group(2)) if m.group(2) else 0
        return feet + inches / 12
    cleaned = re.sub(r'[^0-9.]', '', s)
    try:
        return float(cleaned) if cleaned else None
    except ValueError:
        return None


def parse_year(raw):
    if raw is None:
        return None
    try:
        n = int(str(raw)[:4])
        return n if MIN_YEAR <= n <= MAX_YEAR else None
    except (ValueError, TypeError):
        return None


def detect_language(text):
    """Detect if text is likely non-English by counting marker word hits."""
    if not text or len(text) < 50:
        return None
    for lang, pattern in NON_ENGLISH_MARKERS.items():
        hits = len(pattern.findall(text))
        if hits >= NON_ENGLISH_THRESHOLD:
            return lang
    return None


def has_html_artifacts(text):
    """Check if description has leftover HTML tags or entities."""
    if not text:
        return False
    return bool(re.search(r'<[a-z/]|&[a-z]+;|&lt;|&gt;|&amp;', text, re.I))


# ──────────────────────────────────────────────
# Integrity checks
# ──────────────────────────────────────────────

class Issue:
    def __init__(self, level, code, message):
        self.level = level   # REJECT, WARN, INFO
        self.code = code     # machine-readable code
        self.message = message

    def __repr__(self):
        return f"[{self.level}] {self.code}: {self.message}"


def check_boat(boat, idx):
    """Run all integrity checks on a single boat. Returns list of Issues."""
    issues = []
    name = boat.get('name', '')
    price_raw = boat.get('price')
    year_raw = boat.get('year')
    images = boat.get('images', [])
    desc = boat.get('description', '')
    location = boat.get('location', '')
    loa_raw = boat.get('length') or boat.get('loa')

    # ── REJECT-level checks ──

    if not name or not name.strip():
        issues.append(Issue('REJECT', 'NO_NAME', 'Missing boat name'))

    year = parse_year(year_raw)
    if year is None:
        issues.append(Issue('REJECT', 'NO_YEAR', f'Invalid or missing year: {year_raw}'))

    price = parse_price(price_raw)
    if price is None:
        issues.append(Issue('REJECT', 'NO_PRICE', f'Invalid or missing price: {price_raw}'))
    elif price < MIN_PRICE_USD:
        issues.append(Issue('REJECT', 'PRICE_TOO_LOW', f'Price ${price:.0f} below ${MIN_PRICE_USD} floor'))

    loa = parse_number(loa_raw)
    if loa is not None:
        if loa < MIN_LOA_FT:
            issues.append(Issue('REJECT', 'TOO_SMALL', f'LOA {loa:.1f}ft below {MIN_LOA_FT}ft minimum'))
        elif loa > MAX_LOA_FT:
            issues.append(Issue('REJECT', 'TOO_LARGE', f'LOA {loa:.1f}ft exceeds {MAX_LOA_FT}ft maximum'))

    # Dinghy/accessory detection
    if name:
        make = name.split()[0] if name.split() else ''
        if DINGHY_MAKES.match(make):
            issues.append(Issue('REJECT', 'DINGHY_MAKE', f'Dinghy/accessory make: {make}'))
        if DINGHY_MODELS.search(name):
            issues.append(Issue('REJECT', 'DINGHY_MODEL', f'Dinghy/accessory keyword in name: {name}'))

    # ── WARN-level checks ──

    if not images or len(images) == 0:
        issues.append(Issue('WARN', 'NO_IMAGES', 'No images — will show placeholder in catalog'))

    if price is not None and price < SUSPICIOUS_PRICE_USD:
        issues.append(Issue('WARN', 'SUSPICIOUS_PRICE', f'Price ${price:.0f} is suspiciously low'))

    lang = detect_language(desc)
    if lang:
        issues.append(Issue('WARN', 'NON_ENGLISH_DESC', f'Description appears to be {lang} (will show raw foreign text on detail page)'))

    if has_html_artifacts(desc):
        issues.append(Issue('WARN', 'HTML_IN_DESC', 'Description contains HTML artifacts'))

    if not location or not location.strip():
        issues.append(Issue('WARN', 'NO_LOCATION', 'Missing location'))

    # ── INFO-level checks ──

    if not desc or len(desc.strip()) < MIN_DESC_LENGTH:
        issues.append(Issue('INFO', 'NO_DESC', 'Missing or very short description'))
    elif len(desc.strip()) < GOOD_DESC_LENGTH:
        issues.append(Issue('INFO', 'SHORT_DESC', f'Description only {len(desc.strip())} chars'))

    if loa is None:
        issues.append(Issue('INFO', 'NO_LOA', 'Missing LOA'))

    missing_specs = []
    for field in ['beam', 'draft', 'hull', 'engine', 'rigging', 'type']:
        if not boat.get(field):
            missing_specs.append(field)
    if missing_specs:
        issues.append(Issue('INFO', 'MISSING_SPECS', f'Missing specs: {", ".join(missing_specs)}'))

    return issues


# ──────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    filepath = sys.argv[1]
    do_fix = '--fix' in sys.argv
    strict = '--strict' in sys.argv

    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        sys.exit(1)

    with open(filepath) as f:
        boats = json.load(f)

    print(f"Checking {len(boats)} boats from {filepath}...")
    print(f"Mode: {'strict (warnings = rejects)' if strict else 'normal'}")
    print("=" * 60)

    # Track stats
    stats = {'REJECT': 0, 'WARN': 0, 'INFO': 0}
    reject_codes = {}
    warn_codes = {}
    clean_boats = []
    problem_boats = []

    for idx, boat in enumerate(boats):
        issues = check_boat(boat, idx)

        has_reject = any(i.level == 'REJECT' for i in issues)
        has_warn = any(i.level == 'WARN' for i in issues)

        # In strict mode, warnings become rejects
        is_rejected = has_reject or (strict and has_warn)

        if is_rejected:
            problem_boats.append((idx, boat, issues))
        else:
            clean_boats.append(boat)

        for issue in issues:
            stats[issue.level] += 1
            if issue.level == 'REJECT':
                reject_codes[issue.code] = reject_codes.get(issue.code, 0) + 1
            elif issue.level == 'WARN':
                warn_codes[issue.code] = warn_codes.get(issue.code, 0) + 1

    # ── Report ──

    total = len(boats)
    clean = len(clean_boats)
    rejected = len(problem_boats)

    print(f"\n{'='*60}")
    print(f"RESULTS: {clean}/{total} clean, {rejected} rejected")
    print(f"Issues:  {stats['REJECT']} rejects, {stats['WARN']} warnings, {stats['INFO']} info")

    if reject_codes:
        print(f"\nReject reasons:")
        for code, count in sorted(reject_codes.items(), key=lambda x: -x[1]):
            print(f"  {code:<25} {count:>5}")

    if warn_codes:
        print(f"\nWarning reasons:")
        for code, count in sorted(warn_codes.items(), key=lambda x: -x[1]):
            print(f"  {code:<25} {count:>5}")

    # Show worst offenders (first 10 rejected boats)
    if problem_boats:
        print(f"\nSample rejected boats:")
        for idx, boat, issues in problem_boats[:10]:
            name = boat.get('name', '?')[:40]
            price = boat.get('price', '?')
            reasons = ', '.join(i.code for i in issues if i.level == 'REJECT')
            print(f"  [{idx}] {name:<40} ${price!s:<12} → {reasons}")

    # ── Fix mode: write cleaned JSON ──

    if do_fix:
        out_path = Path(filepath).stem + '_clean.json'
        out_dir = Path(filepath).parent
        out_file = out_dir / out_path
        with open(out_file, 'w') as f:
            json.dump(clean_boats, f, indent=2)
        print(f"\nCleaned JSON written to {out_file} ({clean} boats)")

    # Exit code
    if rejected > 0:
        sys.exit(2)
    elif stats['WARN'] > 0:
        sys.exit(1)
    else:
        sys.exit(0)


if __name__ == '__main__':
    main()
