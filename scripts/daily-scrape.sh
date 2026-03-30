#!/bin/bash
# Daily boat scrape + import pipeline for OnlyHulls
# Runs from cron on the Hetzner server
#
# Sources (server-scrapable, no Cloudflare blocks):
#   - sailboatlistings.com (540 sailboats, 100% sailing focus)
#   - apolloduck.com (2,400+ cruising yachts, EU+US)
#   - theyachtmarket.com (5,700 sailing boats, bluewater subcats)
#
# Focus: cruisers, liveaboards, bluewater sailboats 25ft+
# NO fishing boats, dinghies, or powerboats

set -euo pipefail

PROJECT_DIR="/root/projects/OnlyHulls"
SCRAPER_DIR="$PROJECT_DIR/scraper"
SCRIPTS_DIR="$PROJECT_DIR/scripts"
LOG_FILE="/tmp/onlyhulls-scrape.log"
LIMIT="${1:-100}"

# Load DATABASE_URL from .env
export $(grep DATABASE_URL "$PROJECT_DIR/.env" | head -1 | xargs)

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

log "=== OnlyHulls daily scrape (limit=$LIMIT) ==="

TOTAL_IMPORTED=0
TOTAL_SKIPPED=0

# --- Sailboat Listings (most reliable, pure sailing) ---
log "Scraping sailboatlistings.com..."
if python3 "$SCRAPER_DIR/scrape_sailboats.py" "$LIMIT" >> "$LOG_FILE" 2>&1; then
    COUNT=$(python3 -c "import json; print(len(json.load(open('/tmp/scraped_boats.json'))))" 2>/dev/null || echo 0)
    log "  Scraped $COUNT boats from sailboatlistings.com"
    if [ "$COUNT" -gt 0 ]; then
        RESULT=$(cd "$PROJECT_DIR" && npx tsx "$SCRIPTS_DIR/import-scraped.ts" /tmp/scraped_boats.json sailboatlistings 2>&1 | tail -1)
        log "  $RESULT"
        IMPORTED=$(echo "$RESULT" | grep -oP '\d+(?= imported)' || echo 0)
        TOTAL_IMPORTED=$((TOTAL_IMPORTED + IMPORTED))
    fi
else
    log "  FAILED: sailboatlistings scrape error"
fi

# --- Apollo Duck (cruising yachts, EU+US) ---
log "Scraping apolloduck.com..."
if python3 "$SCRAPER_DIR/scrape_apolloduck.py" "$LIMIT" >> "$LOG_FILE" 2>&1; then
    COUNT=$(python3 -c "import json; print(len(json.load(open('/tmp/scraped_apolloduck.json'))))" 2>/dev/null || echo 0)
    log "  Scraped $COUNT boats from apolloduck.com"
    if [ "$COUNT" -gt 0 ]; then
        RESULT=$(cd "$PROJECT_DIR" && npx tsx "$SCRIPTS_DIR/import-scraped.ts" /tmp/scraped_apolloduck.json apolloduck 2>&1 | tail -1)
        log "  $RESULT"
        IMPORTED=$(echo "$RESULT" | grep -oP '\d+(?= imported)' || echo 0)
        TOTAL_IMPORTED=$((TOTAL_IMPORTED + IMPORTED))
    fi
else
    log "  FAILED: apolloduck scrape error"
fi

# --- The Yacht Market (sailing boats, bluewater focus) ---
log "Scraping theyachtmarket.com..."
if python3 "$SCRAPER_DIR/scrape_yachtmarket.py" "$LIMIT" >> "$LOG_FILE" 2>&1; then
    COUNT=$(python3 -c "import json; print(len(json.load(open('/tmp/scraped_yachtmarket.json'))))" 2>/dev/null || echo 0)
    log "  Scraped $COUNT boats from theyachtmarket.com"
    if [ "$COUNT" -gt 0 ]; then
        RESULT=$(cd "$PROJECT_DIR" && npx tsx "$SCRIPTS_DIR/import-scraped.ts" /tmp/scraped_yachtmarket.json theyachtmarket 2>&1 | tail -1)
        log "  $RESULT"
        IMPORTED=$(echo "$RESULT" | grep -oP '\d+(?= imported)' || echo 0)
        TOTAL_IMPORTED=$((TOTAL_IMPORTED + IMPORTED))
    fi
else
    log "  FAILED: theyachtmarket scrape error"
fi

# --- Expire stale listings (not seen in 14+ days) ---
log "Expiring stale listings..."
EXPIRE_RESULT=$(cd "$PROJECT_DIR" && npx tsx "$SCRIPTS_DIR/expire-stale.ts" 2>&1)
log "  $EXPIRE_RESULT"

# --- Summary ---
TOTAL_BOATS=$(docker exec onlyhulls-db psql -U onlyhulls -d onlyhulls -t -c "SELECT count(*) FROM boats WHERE status='active'" 2>/dev/null | tr -d ' ')
SOURCE_BREAKDOWN=$(docker exec onlyhulls-db psql -U onlyhulls -d onlyhulls -t -c "SELECT COALESCE(source_name, 'Platform') as src, count(*) FROM boats WHERE status='active' GROUP BY source_name ORDER BY count DESC" 2>/dev/null)

log ""
log "=== Summary ==="
log "New imports: $TOTAL_IMPORTED"
log "Total active listings: $TOTAL_BOATS"
log "By source:"
echo "$SOURCE_BREAKDOWN" | while read line; do
    [ -n "$line" ] && log "  $line"
done
log "=== Done ==="
