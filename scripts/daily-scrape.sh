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

# --- Apollo Duck — DROPPED (prices are JS-rendered, no static HTML access) ---

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

# --- Catamarans.com (pure catamaran brokerage) ---
log "Scraping catamarans.com..."
if python3 "$SCRAPER_DIR/scrape_catamarans_com.py" "$LIMIT" >> "$LOG_FILE" 2>&1; then
    COUNT=$(python3 -c "import json; print(len(json.load(open('/tmp/scraped_catamarans_com.json'))))" 2>/dev/null || echo 0)
    log "  Scraped $COUNT boats from catamarans.com"
    if [ "$COUNT" -gt 0 ]; then
        RESULT=$(cd "$PROJECT_DIR" && npx tsx "$SCRIPTS_DIR/import-scraped.ts" /tmp/scraped_catamarans_com.json catamarans_com 2>&1 | tail -1)
        log "  $RESULT"
        IMPORTED=$(echo "$RESULT" | grep -oP '\d+(?= imported)' || echo 0)
        TOTAL_IMPORTED=$((TOTAL_IMPORTED + IMPORTED))
    fi
else
    log "  FAILED: catamarans.com scrape error"
fi

# --- Moorings Brokerage (charter exit fleet catamarans) ---
log "Scraping mooringsbrokerage.com..."
if python3 "$SCRAPER_DIR/scrape_moorings.py" "$LIMIT" >> "$LOG_FILE" 2>&1; then
    COUNT=$(python3 -c "import json; print(len(json.load(open('/tmp/scraped_moorings.json'))))" 2>/dev/null || echo 0)
    log "  Scraped $COUNT boats from mooringsbrokerage.com"
    if [ "$COUNT" -gt 0 ]; then
        RESULT=$(cd "$PROJECT_DIR" && npx tsx "$SCRIPTS_DIR/import-scraped.ts" /tmp/scraped_moorings.json moorings 2>&1 | tail -1)
        log "  $RESULT"
        IMPORTED=$(echo "$RESULT" | grep -oP '\d+(?= imported)' || echo 0)
        TOTAL_IMPORTED=$((TOTAL_IMPORTED + IMPORTED))
    fi
else
    log "  FAILED: mooringsbrokerage scrape error"
fi

# --- Denison Yachting (16,793 listings, data-price SSR) ---
log "Scraping denisonyachtsales.com..."
if python3 "$SCRAPER_DIR/scrape_denison.py" "$LIMIT" >> "$LOG_FILE" 2>&1; then
    COUNT=$(python3 -c "import json; print(len(json.load(open('/tmp/scraped_denison.json'))))" 2>/dev/null || echo 0)
    log "  Scraped $COUNT boats from denisonyachtsales.com"
    if [ "$COUNT" -gt 0 ]; then
        RESULT=$(cd "$PROJECT_DIR" && npx tsx "$SCRIPTS_DIR/import-scraped.ts" /tmp/scraped_denison.json denison 2>&1 | tail -1)
        log "  $RESULT"
        IMPORTED=$(echo "$RESULT" | grep -oP '\d+(?= imported)' || echo 0)
        TOTAL_IMPORTED=$((TOTAL_IMPORTED + IMPORTED))
    fi
else
    log "  FAILED: denison scrape error"
fi

# --- Playwright-based scrapers (run sequentially to manage memory) ---
# Kill any orphaned chromium processes before starting
pkill -f "chromium.*headless" 2>/dev/null || true

for PW_SCRAPER in multihullworld:multihullworld apolloduck_us:apolloduck_us catamaransite:catamaransite multihullcompany:multihullcompany camperandnicholsons:camperandnicholsons vi_yachtbroker:vi_yachtbroker dreamyacht:dreamyacht boote_yachten:boote_yachten; do
    PW_FILE="${PW_SCRAPER%%:*}"
    PW_SOURCE="${PW_SCRAPER##*:}"
    PW_JSON="/tmp/scraped_${PW_FILE}.json"

    log "Scraping ${PW_FILE} (Playwright)..."
    if timeout 120 python3 "$SCRAPER_DIR/scrape_${PW_FILE}.py" "$LIMIT" >> "$LOG_FILE" 2>&1; then
        COUNT=$(python3 -c "import json; print(len(json.load(open('${PW_JSON}'))))" 2>/dev/null || echo 0)
        log "  Scraped $COUNT boats"
        if [ "$COUNT" -gt 0 ]; then
            RESULT=$(cd "$PROJECT_DIR" && npx tsx "$SCRIPTS_DIR/import-scraped.ts" "$PW_JSON" "$PW_SOURCE" 2>&1 | tail -1)
            log "  $RESULT"
            IMPORTED=$(echo "$RESULT" | grep -oP '\d+(?= imported)' || echo 0)
            TOTAL_IMPORTED=$((TOTAL_IMPORTED + IMPORTED))
        fi
    else
        log "  FAILED: ${PW_FILE} scrape error or timeout"
    fi

    # Clean up chromium between runs
    pkill -f "chromium.*headless" 2>/dev/null || true
    sleep 2
done

# --- Expire stale listings (not seen in 14+ days) ---
log "Expiring stale listings..."
EXPIRE_RESULT=$(cd "$PROJECT_DIR" && npx tsx "$SCRIPTS_DIR/expire-stale.ts" 2>&1)
log "  $EXPIRE_RESULT"

# --- Summary ---
TOTAL_BOATS=$(docker exec onlyhulls-db psql -U onlyhulls -d onlyhulls -t -c "SELECT count(*) FROM boats WHERE status='active'" 2>/dev/null | tr -d ' ')
SOURCE_BREAKDOWN=$(docker exec onlyhulls-db psql -U onlyhulls -d onlyhulls -t -c "SELECT COALESCE(source_name, 'Platform') as src, count(*) as cnt FROM boats WHERE status='active' GROUP BY source_name ORDER BY cnt DESC" 2>/dev/null)

log ""
log "=== Summary ==="
log "New imports: $TOTAL_IMPORTED"
log "Total active listings: $TOTAL_BOATS"
log "By source:"
echo "$SOURCE_BREAKDOWN" | while read line; do
    [ -n "$line" ] && log "  $line"
done
log "=== Done ==="
