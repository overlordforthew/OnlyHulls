#!/bin/bash
# Daily boat scrape + import pipeline for OnlyHulls
# Runs from cron on the Hetzner server
#
# Sources:
#   - sailboatlistings.com (broad sailing inventory)
#   - theyachtmarket.com (strong sailing inventory)
#   - mooringsbrokerage.com (charter exit catamarans)
#   - dreamyachtsales.com (charter exit fleet, cats + monos)
#   - catamaransite.com (catamaran brokerage)
#
# Focus: cruisers, liveaboards, bluewater sailboats 25ft+
# NO fishing boats, dinghies, or powerboats

set -euo pipefail

PROJECT_DIR="/root/projects/OnlyHulls"
SCRAPER_DIR="$PROJECT_DIR/scraper"
SCRIPTS_DIR="$PROJECT_DIR/scripts"
LOG_FILE="/tmp/onlyhulls-scrape.log"
LIMIT="${1:-100}"
APP_CONTAINER_PREFIX="qkggs84cs88o0gww4wc80gwo-"
TMP_DIR=$(python3 -c 'import os,tempfile; d=tempfile.gettempdir(); print("/tmp" if os.name != "nt" and d.startswith("/tmp/user/") else d)')

load_runtime_env() {
    local container
    container=$(docker ps --format '{{.Names}}' | grep "^${APP_CONTAINER_PREFIX}" | head -1 || true)
    if [ -z "$container" ]; then
        return
    fi

    for var in DATABASE_URL RESEND_API_KEY RESEND_FROM_EMAIL SMTP_HOST SMTP_PORT SMTP_SECURE SMTP_USER SMTP_PASS SMTP_FROM NEXT_PUBLIC_APP_URL NEXTAUTH_URL; do
        local value
        value=$(docker exec "$container" printenv "$var" 2>/dev/null || true)
        if [ -n "$value" ]; then
            printf -v "$var" '%s' "$value"
            export "$var"
        fi
    done
}

load_fallback_env() {
    if [ -n "${DATABASE_URL:-}" ]; then
        return
    fi
    export $(grep DATABASE_URL "$PROJECT_DIR/.env" | head -1 | xargs)
}

load_runtime_env
load_fallback_env

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

run_import_cycle() {
    local json_file="$1"
    local source_key="$2"
    local result
    local update_result
    local imported

    result=$(cd "$PROJECT_DIR" && npx tsx "$SCRIPTS_DIR/import-scraped.ts" "$json_file" "$source_key" 2>&1 | tail -1)
    log "  $result"
    imported=$(echo "$result" | grep -oP '\d+(?= imported)' || echo 0)
    TOTAL_IMPORTED=$((TOTAL_IMPORTED + imported))

    update_result=$(cd "$PROJECT_DIR" && npx tsx "$SCRIPTS_DIR/import-scraped.ts" "$json_file" "$source_key" --update 2>&1 | tail -1)
    log "  $update_result"
}

log "=== OnlyHulls daily scrape (limit=$LIMIT) ==="

TOTAL_IMPORTED=0
TOTAL_SKIPPED=0

# --- Sailboat Listings (most reliable, pure sailing) ---
log "Scraping sailboatlistings.com..."
if python3 "$SCRAPER_DIR/scrape_sailboats.py" "$LIMIT" >> "$LOG_FILE" 2>&1; then
    COUNT=$(python3 -c "import json; print(len(json.load(open('/tmp/scraped_boats.json'))))" 2>/dev/null || echo 0)
    log "  Scraped $COUNT boats from sailboatlistings.com"
    if [ "$COUNT" -gt 0 ]; then
        run_import_cycle /tmp/scraped_boats.json sailboatlistings
    fi
else
    log "  FAILED: sailboatlistings scrape error"
fi

# --- Apollo Duck â€” DROPPED (prices are JS-rendered, no static HTML access) ---

# --- The Yacht Market (sailing boats, bluewater focus) ---
log "Scraping theyachtmarket.com..."
if python3 "$SCRAPER_DIR/scrape_yachtmarket.py" "$LIMIT" >> "$LOG_FILE" 2>&1; then
    COUNT=$(python3 -c "import json; print(len(json.load(open('/tmp/scraped_yachtmarket.json'))))" 2>/dev/null || echo 0)
    log "  Scraped $COUNT boats from theyachtmarket.com"
    if [ "$COUNT" -gt 0 ]; then
        run_import_cycle /tmp/scraped_yachtmarket.json theyachtmarket
    fi
else
    log "  FAILED: theyachtmarket scrape error"
fi

# --- Moorings Brokerage (charter exit fleet catamarans) ---
log "Scraping mooringsbrokerage.com..."
if python3 "$SCRAPER_DIR/scrape_moorings.py" "$LIMIT" >> "$LOG_FILE" 2>&1; then
    COUNT=$(python3 -c "import json; print(len(json.load(open('/tmp/scraped_moorings.json'))))" 2>/dev/null || echo 0)
    log "  Scraped $COUNT boats from mooringsbrokerage.com"
    if [ "$COUNT" -gt 0 ]; then
        run_import_cycle /tmp/scraped_moorings.json moorings
    fi
else
    log "  FAILED: mooringsbrokerage scrape error"
fi

# --- Dream Yacht Sales (SSR cards, strong catamaran relevance) ---
log "Scraping dreamyachtsales.com..."
if python3 "$SCRAPER_DIR/scrape_dreamyacht.py" "$LIMIT" >> "$LOG_FILE" 2>&1; then
    COUNT=$(python3 -c "import json; print(len(json.load(open('${TMP_DIR}/scraped_dreamyacht.json'))))" 2>/dev/null || echo 0)
    log "  Scraped $COUNT boats from dreamyachtsales.com"
    if [ "$COUNT" -gt 0 ]; then
        run_import_cycle "${TMP_DIR}/scraped_dreamyacht.json" dreamyacht
    fi
else
    log "  FAILED: dreamyacht scrape error"
fi

# --- CatamaranSite (SSR cards, catamarans only) ---
log "Scraping catamaransite.com..."
if python3 "$SCRAPER_DIR/scrape_catamaransite.py" "$LIMIT" >> "$LOG_FILE" 2>&1; then
    COUNT=$(python3 -c "import json; print(len(json.load(open('${TMP_DIR}/scraped_catamaransite.json'))))" 2>/dev/null || echo 0)
    log "  Scraped $COUNT boats from catamaransite.com"
    if [ "$COUNT" -gt 0 ]; then
        run_import_cycle "${TMP_DIR}/scraped_catamaransite.json" catamaransite
    fi
else
    log "  FAILED: catamaransite scrape error"
fi

# --- Expire stale listings (not seen in 14+ days) ---
log "Expiring stale listings..."
EXPIRE_RESULT=$(cd "$PROJECT_DIR" && npx tsx "$SCRIPTS_DIR/expire-stale.ts" 2>&1)
log "  $EXPIRE_RESULT"

# --- Saved search email alerts ---
log "Sending saved search alerts..."
if ALERT_RESULT=$(cd "$PROJECT_DIR" && npx tsx "$SCRIPTS_DIR/send-saved-search-alerts.ts" 2>&1 | tail -1); then
    log "  $ALERT_RESULT"
else
    log "  FAILED: saved search alerts"
fi

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
