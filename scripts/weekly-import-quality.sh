#!/bin/bash
set -euo pipefail

PROJECT_DIR="/root/projects/OnlyHulls"
APP_CONTAINER_PREFIX="qkggs84cs88o0gww4wc80gwo-"
LOG_FILE="/tmp/onlyhulls-weekly-quality.log"
IMPORT_LIMIT="${IMPORT_LIMIT:-15000}"
HAIKU_IMPORT_LIMIT="${HAIKU_IMPORT_LIMIT:-250}"
HAIKU_MATCH_LIMIT="${HAIKU_MATCH_LIMIT:-120}"
CLAUDE_MODEL="${CLAUDE_MODEL:-haiku}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

find_app_container() {
  docker ps --format '{{.Names}}' | grep "^${APP_CONTAINER_PREFIX}" | head -1
}

find_container_ip() {
  docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$1"
}

APP_CONTAINER="$(find_app_container)"
if [ -z "${APP_CONTAINER:-}" ]; then
  echo "OnlyHulls app container not found" >&2
  exit 1
fi

DB_IP="$(find_container_ip onlyhulls-db)"
MEILI_IP="$(find_container_ip onlyhulls-meilisearch)"

export DATABASE_URL="postgresql://onlyhulls:changeme@${DB_IP}:5432/onlyhulls"
export MEILISEARCH_URL="http://${MEILI_IP}:7700"

for var in MEILISEARCH_API_KEY NEXT_PUBLIC_APP_URL NEXTAUTH_URL; do
  value="$(docker exec "$APP_CONTAINER" printenv "$var" 2>/dev/null || true)"
  if [ -n "$value" ]; then
    export "$var=$value"
  fi
done

log "=== OnlyHulls weekly quality pass ==="
log "Using app container: $APP_CONTAINER"
log "Resolving imported duplicate listings..."
(
  cd "$PROJECT_DIR"
  npm run db:resolve-import-duplicates -- --limit "$IMPORT_LIMIT"
) | tee -a "$LOG_FILE"

log "Running deterministic cleanup and reindex..."
(
  cd "$PROJECT_DIR"
  npm run db:clean-imports -- --limit "$IMPORT_LIMIT" --llm-limit 0 --skip-embeddings --reindex
) | tee -a "$LOG_FILE"

log "Running Claude Haiku copy refresh..."
(
  cd "$PROJECT_DIR"
  npx tsx scripts/claude-haiku-copy-pass.ts \
    --scope both \
    --model "$CLAUDE_MODEL" \
    --imports-limit "$HAIKU_IMPORT_LIMIT" \
    --matches-limit "$HAIKU_MATCH_LIMIT" \
    --reindex
) | tee -a "$LOG_FILE"

log "Writing source health report..."
(
  cd "$PROJECT_DIR"
  npm run db:source-health -- --limit 12
) | tee -a "$LOG_FILE"

log "Sending owner digest..."
(
  cd "$PROJECT_DIR"
  npm run alerts:owner-digest -- --days 7 --limit 12 --signup-limit 10
) | tee -a "$LOG_FILE"

log "=== Weekly quality pass complete ==="
