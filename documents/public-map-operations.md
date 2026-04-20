# Public Map Operations

The public map is built, but it is intentionally gated. Keep both map flags off in production until coordinate readiness, tile billing, CSP, attribution, and staging smoke tests all pass together.

## Consensus Decision

Use **MapTiler Flex** as the first commercial map tile provider.

Why:

- It is MapLibre-friendly and fits the MapLibre client already in OnlyHulls.
- It starts as a commercial plan at $25/month, which is a better early-marketplace fit than jumping to a higher fixed plan.
- It uses session-based pricing for map initialization, which matches our opt-in Map view. A user can pan and zoom inside a session without creating a new map session.
- It includes static maps, which keeps the door open for later listing-detail snapshots, email previews, or share cards without adding another vendor.
- It has explicit usage analytics and budget controls, which matters because public maps can become a quiet spend leak.

Use **Stadia Starter** as the fallback if tile-credit economics become preferable. Keep OpenCage as the coordinate source of record either way. Do not use Stadia Starter geocoding for persisted boat coordinates because the Starter plan is temporary-storage only.

Defer **Mapbox** for the first launch. Mapbox is strong, but OnlyHulls does not need the ecosystem lock-in or pricing model before the map has proven buyer value.

Sources checked on April 20, 2026:

- MapTiler Cloud pricing: https://www.maptiler.com/cloud/pricing/
- Stadia Maps pricing: https://stadiamaps.com/pricing/
- Mapbox pricing: https://www.mapbox.com/pricing

## Production Env Shape

Set these only after the staging checklist passes:

```bash
PUBLIC_MAP_ENABLED=true
NEXT_PUBLIC_MAP_ENABLED=true
MAPTILER_KEY=...
NEXT_PUBLIC_MAP_STYLE_URL=https://api.maptiler.com/maps/streets-v2/style.json?key=$MAPTILER_KEY
NEXT_PUBLIC_MAP_ATTRIBUTION=© MapTiler © OpenStreetMap contributors
NEXT_PUBLIC_MAP_RESOURCE_ORIGINS=https://api.maptiler.com,https://tiles.maptiler.com
MAP_READINESS_MIN_MARKET_TAG_PCT=95
MAP_READINESS_MIN_CITY_OR_BETTER_PCT=85
MAP_READINESS_MIN_PUBLIC_PIN_PCT=85
MAP_READINESS_MIN_NON_APPROX_PUBLIC_PIN_PCT=50
MAP_READINESS_MAX_REVIEW_FAILED_PCT=0
MAP_READINESS_STALE_PIN_DAYS=90
MAP_READINESS_MIN_PIN_SCORE=0.6
```

Notes:

- `PUBLIC_MAP_ENABLED` gates the server marker API.
- `NEXT_PUBLIC_MAP_ENABLED` gates the buyer-facing Map button.
- Flip both flags together. If only the client flag is enabled, the UI appears but the marker API returns `404`. If only the server flag is enabled, the API exists but buyers cannot open the map.
- The MapTiler key is URL-embedded and public by design. Restrict it in the MapTiler dashboard to `https://onlyhulls.com/*` and `https://www.onlyhulls.com/*`.
- Keep a budget/session cap on the MapTiler account at launch. Prefer graceful map unavailability over surprise overage until real map usage is known.
- Do not add wildcard CSP origins. Add explicit hosts to `NEXT_PUBLIC_MAP_RESOURCE_ORIGINS`.
- Use `/admin/map-readiness` as the aggregate launch gate before enabling the public flags. It intentionally reports counts, percentages, precision/status/provider splits, and blockers without exposing coordinates, listing IDs, user IDs, or slugs.

## Staging Checklist

Use `--phase=launch` for every public-map exposure decision. `--phase=backfill` is only for coordinate-write readiness while the public map stays off.

1. `npm run db:map-launch-preflight -- --phase=launch --ping --pin-audit-report=artifacts/map-pin-audit-launch.json` returns `GO` against the intended staging/production database and configured providers.
2. OpenCage backfill coverage and `/admin/map-readiness` gates are green.
3. Admin Source Health and `db:map-launch-preflight` explain the imported-inventory waterfall: active imported, quality pass, fresh pass, buyer visible, stale-source held, and policy held. Do not launch the map over an unexplained inventory drop.
4. A fresh zero-rejection `npm run db:map-pin-audit -- --limit=25 --seed=launch-review --attest --reviewed-by=<operator> --accepted=25 --rejected=0 --emit-report=artifacts/map-pin-audit-launch.json` sample has been reviewed.
5. MapTiler key is referrer-restricted to staging and production domains.
6. MapTiler budget/session cap is configured.
7. Staging env has `PUBLIC_MAP_ENABLED=true` and `NEXT_PUBLIC_MAP_ENABLED=true`.
8. Staging CSP includes every required style, tile, glyph, sprite, and image origin without using `*`.
9. Browser tests pass with map off, map happy path, 429 response, and broken style response.
10. Manual smoke: search a market, switch to Map, click a marker, open the listing, then switch back to grid/rows.

## Launch Sequence

1. Confirm deploy health is on the intended build.
2. Run `npm run db:map-launch-preflight -- --phase=launch --ping --pin-audit-report=artifacts/map-pin-audit-launch.json` in production and confirm it returns `GO`.
3. Set `PUBLIC_MAP_ENABLED=true`.
4. Set `NEXT_PUBLIC_MAP_ENABLED=true`.
5. Redeploy.
6. Run production smoke tests.
7. Manually verify `/boats?location=puerto-rico`, `/boats?location=florida`, and one non-US market.
8. Watch map request volume, tile-provider usage, API 429s, and CSP reports.

## Rollback

Turn off the buyer-facing surface first:

```bash
NEXT_PUBLIC_MAP_ENABLED=false
```

Redeploy. If server/API load is also a concern, turn off:

```bash
PUBLIC_MAP_ENABLED=false
```

The list, grid, row view, location search, saved searches, and listing pages continue to work with both map flags off.

## Risks To Keep Visible

- Map sessions are created when the Map view initializes. Do not make the Map view the default without reforecasting spend.
- Listing-detail mini maps, static images, and emails multiply provider usage. Treat each as a separate launch decision.
- MapTiler attribution must remain visible on every map view.
- The public API must remain slug-only. Do not expose internal boat ids, seller ids, or owner data for clustering or analytics.
- City, region, and country geocodes stay search-only. Do not turn broad geocodes into public pins.
- OpenCage remains the persisted coordinate source of record. Do not mix provider geocoding results without lineage fields and a migration plan.
- The launch audit proves the reviewed deterministic sample still matches current data. Keep its freshness window short because newly added public pins outside that sample still rely on readiness thresholds and follow-up audits.
