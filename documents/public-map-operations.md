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
```

Notes:

- `PUBLIC_MAP_ENABLED` gates the server marker API.
- `NEXT_PUBLIC_MAP_ENABLED` gates the buyer-facing Map button.
- Flip both flags together. If only the client flag is enabled, the UI appears but the marker API returns `404`. If only the server flag is enabled, the API exists but buyers cannot open the map.
- The MapTiler key is URL-embedded and public by design. Restrict it in the MapTiler dashboard to `https://onlyhulls.com/*` and `https://www.onlyhulls.com/*`.
- Keep a budget/session cap on the MapTiler account at launch. Prefer graceful map unavailability over surprise overage until real map usage is known.
- Do not add wildcard CSP origins. Add explicit hosts to `NEXT_PUBLIC_MAP_RESOURCE_ORIGINS`.

## Staging Checklist

1. OpenCage backfill coverage and admin readiness gates are green.
2. At least one sample-pin audit has been reviewed for obvious bad coordinates.
3. MapTiler key is referrer-restricted to staging and production domains.
4. MapTiler budget/session cap is configured.
5. Staging env has `PUBLIC_MAP_ENABLED=true` and `NEXT_PUBLIC_MAP_ENABLED=true`.
6. Staging CSP includes every required style, tile, glyph, sprite, and image origin without using `*`.
7. Browser tests pass with map off, map happy path, 429 response, and broken style response.
8. Manual smoke: search a market, switch to Map, click a marker, open the listing, then switch back to grid/rows.

## Launch Sequence

1. Confirm deploy health is on the intended build.
2. Set `PUBLIC_MAP_ENABLED=true`.
3. Set `NEXT_PUBLIC_MAP_ENABLED=true`.
4. Redeploy.
5. Run production smoke tests.
6. Manually verify `/boats?location=puerto-rico`, `/boats?location=florida`, and one non-US market.
7. Watch map request volume, tile-provider usage, API 429s, and CSP reports.

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
