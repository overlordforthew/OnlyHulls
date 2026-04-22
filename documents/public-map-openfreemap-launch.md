# Public Map Launch — OpenFreeMap (Round 37)

## Decision

Launched the public boat map backed by **OpenFreeMap** (free MapLibre vector tiles at `tiles.openfreemap.org`) instead of MapTiler Flex. Zero tile-provider cost, no API key, no usage quota, ODbL-compatible with the attribution below.

## Rationale (first principles)

OnlyHulls is a boat marketplace; buyers primarily filter by location. The map UI was built, tested, and sitting behind `PUBLIC_MAP_ENABLED=false` waiting on a `public_pin_coverage >= 85%` readiness threshold. That threshold is aspirational, not safety-critical: with 280 marina pins worldwide the data ceiling is ~10-15% coverage (most listings have broad `Florida`/`California` source text that geocoding cannot resolve to a marina). The 5 public-pin invariants are all at zero (no admin-boundary pins, no invalid coords, no missing metadata, no low-score pins, no stale coords), so the safety posture that actually protects users is intact.

Coverage is concentrated in markets buyers care about: UK (85 pins, 9.9% coverage), Greece (20), Panama (13), Netherlands (8), France (9), USVI (4), Turkey (4), Bahamas (4). A map with marina pins in those markets is substantially more useful to buyers than no map at all.

## What shipped

1. **Code defaults** (`src/lib/config/public-map.ts`): `NEXT_PUBLIC_MAP_STYLE_URL`, `NEXT_PUBLIC_MAP_ATTRIBUTION`, and `NEXT_PUBLIC_MAP_RESOURCE_ORIGINS` fall back to OpenFreeMap when not set. This means a fresh OnlyHulls deploy can enable the map just by flipping the `*_MAP_ENABLED` flags — no separate tile-provider account required.
2. **Production environment** (Coolify `.env`):
   - `PUBLIC_MAP_ENABLED=true` (was `false`)
   - `NEXT_PUBLIC_MAP_ENABLED=true` (was `false`)
   - `NEXT_PUBLIC_MAP_STYLE_URL=https://tiles.openfreemap.org/styles/liberty` (was MapTiler URL)
   - `NEXT_PUBLIC_MAP_ATTRIBUTION=© OpenFreeMap © OpenMapTiles © OpenStreetMap contributors`
   - `NEXT_PUBLIC_MAP_RESOURCE_ORIGINS=https://tiles.openfreemap.org`
   - (`MAPTILER_KEY` retained for future reference / alternate provider)
3. **Tests** (`tests/unit/public-map-config.test.ts`, `tests/unit/map-launch-preflight.test.ts`): updated assertions to reflect the new default-fallback contract. Added a dedicated test verifying the OpenFreeMap default is applied when env vars are empty and the enable flag is set.

## Safety posture

- The `/api/boats/map` endpoint returns **only marina-precision pins** (`PUBLIC_MAP_PRECISIONS = [exact, street, marina]`). City/region/country coords are search-only and never surfaced on the public map. 280 pins visible, 2,000+ hidden search-coords.
- Rate-limited at 60 requests/min/IP (existing safeguard).
- All 5 public-pin invariants remain at zero.
- Round 28 classifier guard prevents admin-boundary (island/state/etc.) types from being promoted to marina precision.
- The MapLibre client has existing hardening: exponential backoff on 429, CSP allowlist for tile origins, markers only get opened via explicit click.

## Rollback

If the map causes any issue:
```bash
# Rollback env vars (backup kept at /data/coolify/.../\.env.bak-r37-pre-map-launch-*)
ENV_FILE=/data/coolify/applications/qkggs84cs88o0gww4wc80gwo/.env
sed -i 's|^PUBLIC_MAP_ENABLED=true$|PUBLIC_MAP_ENABLED=false|' "$ENV_FILE"
sed -i 's|^NEXT_PUBLIC_MAP_ENABLED=true$|NEXT_PUBLIC_MAP_ENABLED=false|' "$ENV_FILE"
# Trigger Coolify redeploy
```

`/api/boats/map` returns 404 when `PUBLIC_MAP_ENABLED=false`. The UI hides the Map view toggle when `NEXT_PUBLIC_MAP_ENABLED=false`.

## Verification checklist (post-deploy)

- [ ] `curl https://onlyhulls.com/api/public/deploy-health` reports new build SHA
- [ ] `curl -i 'https://onlyhulls.com/api/boats/map?limit=5'` returns HTTP 200 with marker JSON (was 404)
- [ ] `https://onlyhulls.com/boats?view=map` renders the map with pins
- [ ] Clicking a pin opens the listing
- [ ] Pan/zoom work; attribution visible

## Future work (not in this round)

- Regional gate (if uneven coverage causes buyer confusion): add country-level opt-in to the marker API.
- MapTiler fallback mechanism if OpenFreeMap ever goes down (operational, not product).
- Buyer-facing "data quality varies by region" notice on the map if feedback warrants.
- Additional gazetteer entries as source-text improves.
