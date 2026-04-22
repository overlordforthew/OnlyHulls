# Claude Handoff: OnlyHulls Location / Map Work

Use this as the first prompt/context block when asking Claude or Codex to
continue OnlyHulls location/map work.

## Current Policy (2026-04-22)

Every boat resolves to **country** (minimum) or **city** (maximum). Nothing
else is acceptable. Marina/street/exact are forbidden as targets, as persisted
precision values, and as public map categories.

Full policy doc: `documents/country-city-geocoding.md`. Read that before
changing anything in `src/lib/locations/`.

## Repository State

- Repo: `overlordforthew/OnlyHulls`
- Production branch: `main`
- Deploy: Coolify auto-deploy on push to `main`
- Health probe: `https://onlyhulls.com/api/public/deploy-health`

## Consensus Requirement

Location/map changes have a prior history of subtle data-quality regressions,
so this work continues to require a consensus gate before any production-data
change.

For every phase:

1. Gather evidence: read code, docs, prod data shape, prior reports. Bound
   the question tightly.
2. Run an independent review before implementation. Use `/consensus` (Claude
   Opus + Codex GPT-5.4 xhigh) or an equivalent second opinion.
3. Only apply data changes (migrations, backfills, deletions) after the
   consensus outcome is recorded.
4. Capture backup tables for any destructive or lossy change. Name them
   `<domain>_backup_<migration-number>_<short-reason>`.

## What Got Retired

Rounds 22-37 built a marina-precision regime with a verified-public-pin alias
gazetteer, marine-anchor scoring, and candidate lanes. That regime was
retired on 2026-04-22 when the location floor was reset to country/city only.

- Legacy docs: `documents/legacy/`
- Retirement summary: `documents/legacy/RETIRED.md`

If a future ask sounds like it wants marina-grade precision back, check with
Gil before acting. The decision was explicit and non-negotiable at the time
it was made.

## Active Files

| File | Purpose |
|---|---|
| `src/lib/locations/country-centroids.ts` | ISO alpha-2 → centroid, pure data |
| `src/lib/locations/geocoding.ts` | Provider calls, review gates, country derivation |
| `src/lib/locations/map-coordinates.ts` | Public precision set, coord rounding |
| `src/lib/locations/map-pin-audit.ts` | Audit helpers (normalized) |
| `src/lib/locations/map-pin-audit-data.ts` | Admin audit data fetch |
| `scripts/geocode-boat-locations.ts` | Backfill runner |
| `migrations/036_clamp_legacy_marina_precision.sql` | Applied 2026-04-22 |
| `migrations/037_restore_marina_precision.sql` | Documented revert, not applied |

## Do Not

- Do not re-introduce marina/street/exact as targets or persisted values.
- Do not enable `exact`/`street`/`marina` in `PUBLIC_MAP_PRECISIONS`.
- Do not call a provider for boats where only `location_country` is usable —
  use `deriveCountryGeocodeResult` and save the round-trip.
- Do not drop `boats_geocode_precision_backup_036_marina_clamp` without
  consensus — it is the only reversible path for the clamp.

## Suggested First Actions For A New Session

1. Read `documents/country-city-geocoding.md`.
2. Check deploy health at `https://onlyhulls.com/api/public/deploy-health`.
3. Check precision distribution:
   ```bash
   docker exec onlyhulls-db psql -U onlyhulls -d onlyhulls -tAc \
     "SELECT location_geocode_precision, COUNT(*) FROM boats \
      WHERE location_geocode_precision IS NOT NULL GROUP BY 1 ORDER BY 2 DESC"
   ```
4. Scan `reports/location-backlog/` for the most recent round's notes.
5. Ask Gil what the current goal is before touching anything.
