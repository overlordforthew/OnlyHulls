#!/bin/bash
# Orchestrate the boats.com scrape: scraper runs on Elmo (residential PH IP),
# orchestrator runs on Hetzner (closer to the DB and to Overlord's notify.sh).
#
# Aborts on Cloudflare detection with a WhatsApp alert via Overlord's
# notification-hub (notify.sh). Discord channel is scaffolded but not
# configured with a webhook yet; WhatsApp is the admin's primary channel.
#
# Usage: daily-scrape-boats-com.sh [pages]   # default: 15
set -u

PAGES="${1:-15}"

ELMO="elmoserver"
ELMO_SCRAPER_DIR="/root/scrapers/onlyhulls"
ELMO_VENV_PY="${ELMO_SCRAPER_DIR}/venv/bin/python"
ELMO_SCRAPER="${ELMO_SCRAPER_DIR}/scrape_boats_com.py"
ELMO_OUTPUT="/tmp/scraped_boats.json"
ELMO_METRICS="/tmp/boats_com_run.json"
ELMO_CF_FLAG="/tmp/boats_com_cloudflare.flag"
ELMO_SUS_FLAG="/tmp/boats_com_suspicious.flag"

LOCAL_OUTPUT="/tmp/scraped_boats_from_elmo.json"
LOCAL_METRICS="/tmp/boats_com_run_from_elmo.json"
LOCAL_CF_FLAG="/tmp/boats_com_cloudflare_from_elmo.flag"
LOCAL_SUS_FLAG="/tmp/boats_com_suspicious_from_elmo.flag"
LOG_FILE="/var/log/onlyhulls/boats-com-scrape.log"
IMPORT_LOG="/var/log/onlyhulls/boats-com-import.log"

ONLYHULLS_REPO="/root/projects/OnlyHulls"
NOTIFY="/root/overlord-slim-context/skills/notification-hub/scripts/notify.sh"
APP_CONTAINER_PREFIX="qkggs84cs88o0gww4wc80gwo-"

mkdir -p "$(dirname "$LOG_FILE")"

log() { echo "[$(date -u '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

require_binary() {
    command -v "$1" >/dev/null 2>&1 || { log "FATAL: missing binary on Hetzner: $1"; exit 97; }
}
require_binary jq
require_binary ssh
require_binary scp

# Clear local copies of flags so we don't re-alert on stale files from a prior run.
rm -f "$LOCAL_CF_FLAG" "$LOCAL_SUS_FLAG" "$LOCAL_OUTPUT" "$LOCAL_METRICS"

notify_alert() {
    # Routes alerts via Overlord's notification-hub. Default Discord webhook
    # isn't configured on this server, so we go straight to WhatsApp (the primary
    # admin channel per ADMIN_JID in notify.sh). If DISCORD_WEBHOOK_URL ever gets
    # set in /root/overlord/.env, switch this to --channel default for WA→Discord→Email fallback.
    local msg="$1"
    if [ ! -x "$NOTIFY" ]; then
        log "WARN: notify.sh not found at $NOTIFY — alert dropped: $msg"
        return 0
    fi
    "$NOTIFY" send "$msg" --channel whatsapp >>"$LOG_FILE" 2>&1 \
        || log "WARN: notify.sh send failed — alert may not have reached admin"
}

log "=== boats.com scrape orchestrator (pages=$PAGES) ==="

# Run the scraper on Elmo, streaming its stdout/stderr into our log.
ssh -o ConnectTimeout=15 "$ELMO" "'$ELMO_VENV_PY' '$ELMO_SCRAPER' $PAGES" >>"$LOG_FILE" 2>&1
scrape_rc=$?
log "remote scraper exit=$scrape_rc"

# Pull metrics and flag files from Elmo regardless of exit code.
scp -o ConnectTimeout=15 -q "${ELMO}:${ELMO_METRICS}" "$LOCAL_METRICS" 2>>"$LOG_FILE" || log "WARN: could not pull metrics from Elmo"
scp -o ConnectTimeout=15 -q "${ELMO}:${ELMO_CF_FLAG}" "$LOCAL_CF_FLAG" 2>/dev/null || true
scp -o ConnectTimeout=15 -q "${ELMO}:${ELMO_SUS_FLAG}" "$LOCAL_SUS_FLAG" 2>/dev/null || true

metric() { jq -r "$1 // empty" "$LOCAL_METRICS" 2>/dev/null; }
count=$(metric '.boats_scraped'); count="${count:-0}"
duration=$(metric '.duration_seconds'); duration="${duration:-?}"

if [ -f "$LOCAL_CF_FLAG" ]; then
    reason=$(jq -r '.reason // "unknown"' "$LOCAL_CF_FLAG" 2>/dev/null || echo unknown)
    page=$(jq -r '.page // "?"' "$LOCAL_CF_FLAG" 2>/dev/null || echo "?")
    status=$(jq -r '.status // "?"' "$LOCAL_CF_FLAG" 2>/dev/null || echo "?")
    notify_alert "🚨 boats.com scraper — Cloudflare hit on page ${page} (status=${status}, reason=${reason}). ${count} listings captured before abort. No import run. Flag details on Elmo:${ELMO_CF_FLAG}."
    log "Cloudflare abort: ${reason}"
    exit 2
fi

if [ "$scrape_rc" -ne 0 ]; then
    notify_alert "⚠️ boats.com scraper exited with code ${scrape_rc}. ${count} listings captured. No import run. See ${LOG_FILE} on Hetzner."
    exit "$scrape_rc"
fi

log "scraped ${count} listings in ${duration}s"

if [ "$count" -eq 0 ]; then
    notify_alert "⚠️ boats.com scraper returned 0 listings. No import run."
    exit 1
fi

# Pull the scraped JSON over from Elmo.
if ! scp -o ConnectTimeout=15 -q "${ELMO}:${ELMO_OUTPUT}" "$LOCAL_OUTPUT" >>"$LOG_FILE" 2>&1; then
    notify_alert "⚠️ boats.com scraper: scp from Elmo failed. ${count} listings captured but not imported."
    exit 3
fi

# Resolve DB URL the same way daily-scrape.sh does.
APP_CONTAINER=$(docker ps --format '{{.Names}}' | grep "^${APP_CONTAINER_PREFIX}" | head -1)
if [ -z "$APP_CONTAINER" ]; then
    notify_alert "⚠️ boats.com scraper: OnlyHulls app container not running. ${count} listings captured but not imported."
    exit 10
fi
DB_URL=$(docker exec "$APP_CONTAINER" printenv DATABASE_URL)
DB_IP=$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}} {{end}}' onlyhulls-db | awk '{print $1}')
export DATABASE_URL="${DB_URL//@onlyhulls-db:/@${DB_IP}:}"

mkdir -p "$(dirname "$IMPORT_LOG")"
: > "$IMPORT_LOG"

set -o pipefail
( cd "$ONLYHULLS_REPO" && npx tsx scripts/import-scraped.ts "$LOCAL_OUTPUT" boats_com 2>&1 ) | tee -a "$IMPORT_LOG" | tail -1 | while IFS= read -r line; do log "import: $line"; done
import_rc=${PIPESTATUS[0]}
if [ "$import_rc" -ne 0 ]; then
    notify_alert "⚠️ boats.com scraper: initial import failed (rc=${import_rc}). ${count} listings captured. Full log: ${IMPORT_LOG}."
    exit 4
fi

( cd "$ONLYHULLS_REPO" && npx tsx scripts/import-scraped.ts "$LOCAL_OUTPUT" boats_com --update 2>&1 ) | tee -a "$IMPORT_LOG" | tail -1 | while IFS= read -r line; do log "update: $line"; done
update_rc=${PIPESTATUS[0]}
set +o pipefail
if [ "$update_rc" -ne 0 ]; then
    notify_alert "⚠️ boats.com scraper: update pass failed (rc=${update_rc}). Initial import succeeded. Full log: ${IMPORT_LOG}."
    # Don't fail the run — initial import landed.
fi

if [ -f "$LOCAL_SUS_FLAG" ]; then
    sus_page=$(jq -r '.page // "?"' "$LOCAL_SUS_FLAG" 2>/dev/null || echo "?")
    notify_alert "ℹ️ boats.com scraper: suspicious zero-cards page at page ${sus_page} (${count} listings still imported). Worth a look next time."
fi

log "=== done ==="
