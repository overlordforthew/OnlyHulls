# Country-City Geocoding Policy

**Effective date:** 2026-04-22
**Status:** Active — this is how OnlyHulls resolves boat locations today.

## The Rule

Every boat's public location resolves to **country** (minimum) or **city**
(maximum). No other precision is acceptable as a target, a persisted value, or
a public map display category.

- If all we can confidently recover is the country — use the country centroid.
- If we can recover `city, country` — use a city-precision pin (2 decimal
  places ≈ 1 km).
- If we cannot recover either — status stays `review`/`pending`, not a guessed
  higher-precision pin.

Marina/street/exact are **forbidden** at every layer: as provider targets, as
persisted precision values, and as map-pin categories.

## Pipeline Shape

```
location_text + location_country
  │
  ├── country-only input?     → deriveCountryGeocodeResult (no provider call)
  │                               → country centroid from country-centroids.ts
  │                               → status="geocoded", precision="country"
  │
  └── richer input?           → strip marine/street tokens from query
                                → geocodeWithNominatim or geocodeWithOpenCage
                                → accept: country, city (2dp)
                                → floor: if < city but country extractable,
                                         fall back to deriveCountryGeocodeResult
```

Both provider paths treat `country` precision as a success state (no longer
demoted to `review`). The OpenCage low-confidence floor and the Nominatim
score floor both exempt `country` precision — country-level matches legitimately
have low confidence because they cover a large area.

## Public Map

`PUBLIC_MAP_PRECISIONS = ["city"]` after Phase 6 lands. Country-precision rows
are visible in list/search/facets but **not** on the map at launch.

A separate future decision may add a country-aggregate endpoint to the map
(one marker per country, sized by count). That is out of scope for this rollout.

## Data Migrations

- `036_clamp_legacy_marina_precision.sql` — clamps pre-existing exact/street/
  marina rows down to city with 2-decimal coord rounding. Applied 2026-04-22.
  Backup table: `boats_geocode_precision_backup_036_marina_clamp`.
- `037_restore_marina_precision.sql` — documented revert. Not applied; run
  only if the policy is reversed.

## Key Files

| File | Purpose |
|---|---|
| `src/lib/locations/country-centroids.ts` | ISO alpha-2 → `{lat, lng, name}` map (~250 entries). |
| `src/lib/locations/geocoding.ts` | `deriveCountryGeocodeResult`, provider calls, review gates. |
| `src/lib/locations/map-coordinates.ts` | `PUBLIC_MAP_PRECISIONS`, `COORDINATE_DECIMALS`. |
| `src/lib/locations/map-pin-audit-data.ts` | Admin audit — uses `parseMapPinAuditPrecision` so city rows surface. |

## What Got Retired

See `documents/legacy/RETIRED.md` for a summary of the marina-alias regime
that was removed. The 16 commits of Round 22-37 work are preserved in git
history; the docs are in `documents/legacy/`.

## Backfill

~11,000 boats sat `pending` at the policy change. Most resolve for free via
`deriveCountryGeocodeResult` (country centroid, no provider call). A subset
with extractable city/country text can be upgraded to city precision via the
provider, batched 500 at a time with the standard consensus-before-apply
pattern used elsewhere in the project.

## Operator Checklist (per batch)

1. Dry-run cache-only: `npm run db:geocode-locations -- --limit=500`
2. Dry-run fetch-missing: `npm run db:geocode-locations -- --fetch-missing --limit=500`
3. Apply: `npm run db:geocode-locations -- --apply --limit=500`
4. Verify via `/admin/map-readiness` that precision distribution stays within
   expected city/country split.
