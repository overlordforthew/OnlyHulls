# OnlyHulls Location / Map Pickup

Last updated: 2026-04-21T16:05:00Z

Read this file first when resuming the location/map work. It is the handoff
state after stopping at the end of Round 22.

## Current State

- Repo: `overlordforthew/OnlyHulls`
- Local worktree: `/root/worktrees/OnlyHulls-complete-public-mapping`
- Production branch: `main`
- Production deploy health at stop point: `a64a6339c27748ba67be9dc657d4514fe241c1f2`
- Public map status: intentionally disabled.
- Live disabled-map check at stop point:
  - `https://onlyhulls.com/api/boats/map?limit=5`
  - expected response: `404 {"error":"Map is not enabled."}`

Do not enable the public map until launch readiness passes. City, region, and
country geocodes are search-only. Public pins must remain limited to `exact`,
`street`, and `marina` precision rows that pass audit.

## What We Shipped

### Round 21: Lelystad Search Coverage

- PR: `#28`
- Merge commit: `097b367`
- Feature commit: `dd6993a`
- Backup table: `boat_geocode_backup_20260421141932`
- Result:
  - 32 Dutch Lelystad rows geocoded as city/search-only coordinates.
  - 0 public pins created.
  - 0 failed rows.
  - 0 geography mismatches.
  - Public map stayed disabled.
- Important policy added:
  - The exact `City, Country` confidence-3 path is a closed search-coverage exception.
  - It is not a public-pin shortcut.

### Round 21 Follow-Up: Geocode Backup Slug Hardening

- PR: `#29`
- Merge commit: `c372e9a`
- Feature commit: `7f32735`
- Reason:
  - Production logs showed a manual audit query against an old
    `boat_geocode_backup_*` table using `slug`, but older backup snapshots did
    not include `slug`.
- Result:
  - Future geocode backup snapshots include `slug` for audit convenience.
  - Rollback remains `id`-based.
  - Runtime column assertion was added.
  - No new `column "slug" does not exist` DB errors were present after the fix.

### Round 22: Verified Chatham Marina Geocoding

- PR: `#30`
- Merge commit: `a64a633`
- Feature commit: `73c6227`
- Production backup table: `boat_geocode_backup_20260421152318`
- Consensus:
  - Claude pre-apply review said `APPLY`, no blockers.
  - A later final Claude review attempt hung for more than 10 minutes and was
    killed cleanly. Do not treat that as a negative review; the actual
    pre-apply consensus gate completed and approved the batch.

Round 22 added one verified public-pin alias:

- Alias: `mdl chatham maritime marina boatyard`
- Canonical query:
  - `MDL Chatham Maritime Marina Boatyard, Chatham, United Kingdom`
- Provider result:
  - `MDL Chatham Maritime Marina Boatyard, Chatham, Medway, England, United Kingdom`
- Coordinates:
  - latitude `51.4025553`
  - longitude `0.5321595`
- Anchor requirements:
  - country code `gb`
  - max distance `0.5 km`
  - score `>= 0.98`
  - provider `_type=boatyard`
  - provider `boatyard=MDL Chatham Maritime Marina Boatyard`

Round 22 canonicalizes only these exact reviewed source texts:

- `Chatham Marina, Kent`
- `Chatham Marina, Chatham Kent`

Round 22 intentionally does not canonicalize:

- plain `Chatham Marina`
- `Chatham Marina, Kent Coast`
- Dover `New Marina Curve Road` / pier results
- water-typed Chatham-like provider results
- wrong-country or low-score alias attempts

Production apply result:

- Targeted IDs: 5
- Selected rows: 4
- Excluded row: 1 plain pending `Chatham Marina` row with no country; reason
  `unknown_location`
- Selected unique queries: 1
- Provider fetches: 1
- Cache hits in run: 3
- Public-pin eligible: 4
- Public-pin eligible rate: 1
- Geocoded: 4
- Review: 0
- Failed: 0
- Skipped: 0
- Precision split: `marina=4`
- Geography mismatches: 0
- Warnings: 0
- Follow-up verified-alias retry lane: selected 0 rows
- Backup-scoped map-pin audit: 4/4 eligible pins

The four Chatham listings now pinned:

- `1970-great-dane-37-chatham-marina`
- `1984-jeanneau-arcadia-chatham-marina`
- `1987-lm-30-chatham-marina`
- `2000-beneteau-oceanis-361-clipper-chatham-marina`

The remaining plain Chatham listing stayed pending:

- `2000-jeanneau-sun-odyssey-32-2-chatham-marina`

## Verification Completed

Local verification before merge:

- `node --import tsx --test tests/unit/geocode-candidate-lanes.test.ts tests/unit/location-geocoding.test.ts`
  - 48/48 passed.
- `npm run test:unit`
  - 242/242 passed.
- `npm run typecheck`
  - passed.
- `npm run lint`
  - passed.
- `npm run build`
  - passed.
- `npm run test:browser:prod`
  - 36/36 passed before merge.
- `git diff --check`
  - passed.

GitHub verification for PR `#30`:

- `quality`
  - passed.
- `browser-local`
  - passed.

Post-deploy verification:

- Deploy health reported `a64a633`.
- Live map API remained disabled with `404`.
- First full production browser smoke had one timing failure at the final
  `/boats?q=lagoon` card lookup after 35/36 passed.
- Targeted rerun of that failed test passed immediately.
- Full production browser smoke rerun passed 36/36.

## Current Readiness Snapshot

Round 22 readiness verdict remained:

- `NO_GO_KEEP_PUBLIC_MAP_DISABLED`

Important numbers at stop point:

- Active visible rows: 12,670
- Geocodable address count: 4,119
- Public pin count: 267
- Public coverage rate across geocodable addresses: 6.48%
- Active-visible public coverage rate: 2.11%
- Raw coordinate count: 809
- Held-back coordinate count: 542
- City coordinate count: 444
- Regional coordinate count: 98
- Country hint mismatches: 0
- Public admin boundary count: 0
- Invalid public coordinate count: 0
- Public missing metadata count: 0
- Low-score public pin count: 0
- Stale public coordinate count: 0

Launch blockers still present:

- Missing/fresh golden accuracy artifact.
- Public-pin coverage is far below launch target.
- Pending-ready queue remains high.
- Review/failed rate remains high.
- Regional public-pin coverage is far below launch target.

## Files Updated In Round 22

Core logic:

- `src/lib/locations/geocoding.ts`
- `src/lib/locations/verified-public-pin-aliases.ts`

Tests:

- `tests/unit/geocode-candidate-lanes.test.ts`
- `tests/unit/location-geocoding.test.ts`

Docs and reports:

- `documents/public-pin-aliases.md`
- `documents/public-map-operations.md`
- `documents/location-geocoding-rollout.md`
- `reports/location-backlog/2026-04-21-round22.json`
- `reports/location-backlog/2026-04-21-round22.md`

## Rollback Reference

Round 22 geocode rollback table:

- `boat_geocode_backup_20260421152318`

Rollback remains keyed by immutable `id`, not `slug`. The `slug` column exists
only for audit convenience in new backup tables.

If Round 22 needs to be reverted, use the standard geocode rollback SQL in
`documents/location-geocoding-rollout.md`, replacing `<backup_table>` with:

```sql
boat_geocode_backup_20260421152318
```

After rollback, rerun:

```bash
npm run db:geocode-readiness -- --json
npm run db:map-pin-audit -- --backup-table=boat_geocode_backup_20260421152318 --limit=10 --seed=round22-chatham
curl -s -o /tmp/onlyhulls-map-status.txt -w '%{http_code}\n' 'https://onlyhulls.com/api/boats/map?limit=5'
```

## Pickup Plan For Round 23

Recommendation: keep following `gazetteer_first`, but do not add broad aliases.
The next step should be a small verified facility gazetteer evidence layer for
hard POIs.

Primary Round 23 target set:

1. `Marina Anse Marcel`
2. `Marina Del Rey`
3. `Dover Marina`
4. `Green Cay Marina`
5. remaining plain `Chatham Marina`

Known evidence from Round 22 exploration:

- `Marina Anse Marcel`
  - Current provider result was broad city/region, not a marina-grade facility.
  - Defer until there is verified facility evidence.
- `Marina Del Rey`
  - Current provider result was broad Los Angeles County/postcode/city-ish.
  - A query variant resolved to the wrong `Marina, CA` / Monterey area.
  - Reject as public pin until a facility-specific evidence model exists.
- `Dover Marina`
  - Current provider result was `Dover Pier, New Marina Curve Road`.
  - The marina token appears in road text; keep out of marina precision.
- `Green Cay Marina`
  - Current provider result was broad St. Croix / USVI, not facility-grade.
  - Defer until facility coordinates can be verified.
- Plain `Chatham Marina`
  - One row remains pending with no country.
  - Do not canonicalize it without country/source enrichment.

Recommended Round 23 workflow:

1. Run `/consensus` first with Claude.
   - Ask whether to build a general verified-gazetteer evidence structure or
     continue with one-off aliases.
   - My recommendation is a small structured gazetteer, not more text-only
     aliases.
2. Query production for the Round 23 target rows.
   - Count active visible rows.
   - Capture `location_text`, `location_country`, `location_confidence`,
     current geocode status/query/precision, and slugs.
3. For each target, collect provider previews and negative previews.
   - Keep provider proof separate from source-text guesswork.
   - Require facility-grade coordinates and exact/marine provider evidence.
4. Add a verified gazetteer entry only when evidence is strong enough.
   - Expected fields:
     - canonical facility name
     - accepted source aliases
     - country code
     - latitude/longitude
     - max distance
     - required provider component/type if applicable
     - evidence note
     - negative checks
5. Add unit tests before any production apply.
   - Positive exact facility case.
   - Wrong country.
   - Broad city/admin result.
   - Road/pier/parking/postcode false positives.
   - Missing-country source text.
6. Preview production with targeted IDs.
   - Use `--fetch-missing`.
   - Expect `publicPinEligibleRate=1` for any public-pin apply.
   - Do not apply if there are warnings, failed rows, geography mismatches, or
     broad public-pin candidates.
7. Apply only a tiny targeted batch.
   - Keep `PUBLIC_MAP_ENABLED=false`.
   - Record the backup table.
8. Post-apply checks:
   - Targeted retry lane should select 0 rows.
   - Backup-scoped map-pin audit should be all eligible.
   - Readiness should still say public map disabled unless the larger launch
     gates are actually met.
   - Live map API should remain 404.
9. Update docs and generate a new backlog report.
10. Run tests, build, CI, merge, and post-deploy smoke.

## Useful Resume Commands

Set production DB env through the running app container:

```bash
set -a
. /root/.onlyhulls-map-secrets.env
set +a
APP_CONTAINER=$(docker ps --format '{{.Names}}' | rg '^qkggs84cs88o0gww4wc80gwo-' | head -1)
PROD_DB_URL=$(docker exec "$APP_CONTAINER" printenv DATABASE_URL)
export DATABASE_URL="${PROD_DB_URL/onlyhulls-db:5432/127.0.0.1:5433}"
export LOCATION_GEOCODING_PROVIDER=opencage
export PUBLIC_MAP_ENABLED=false
export NEXT_PUBLIC_MAP_ENABLED=false
```

Check production deploy health:

```bash
curl -fsS https://onlyhulls.com/api/public/deploy-health
```

Confirm public map is still disabled:

```bash
curl -s -o /tmp/onlyhulls-map-status.txt -w '%{http_code}\n' 'https://onlyhulls.com/api/boats/map?limit=5'
cat /tmp/onlyhulls-map-status.txt
```

Run readiness:

```bash
npm run db:geocode-readiness -- --json
```

Generate next backlog:

```bash
npm run db:location-backlog -- --top=30 --stamp=2026-04-21-round23 --write
```

Run the verified-alias retry lane for a targeted batch:

```bash
npm run db:geocode-locations -- --limit=5 \
  --boat-ids=<comma-separated-uuid-list> \
  --include-review \
  --retry-changed-review \
  --verified-public-pin-aliases \
  --fetch-missing
```

Apply only after consensus and a clean preview:

```bash
npm run db:geocode-locations -- --limit=5 \
  --boat-ids=<comma-separated-uuid-list> \
  --include-review \
  --retry-changed-review \
  --verified-public-pin-aliases \
  --apply
```

## Stop Condition

We stopped intentionally after Round 22 because:

- The Chatham batch is complete and live.
- Public map remains safely disabled.
- The next good work is a design/data-quality step, not another rushed apply.
- The next round should start with consensus and a verified gazetteer approach.
