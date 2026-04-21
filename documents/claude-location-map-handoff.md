# Claude Handoff: OnlyHulls Location / Map Work

Use this as the first prompt/context block when asking Claude to continue the
OnlyHulls location/map work.

## Role

You are taking over the OnlyHulls location/map rollout. Treat this as a
commercial-grade production data-quality project, not a UI experiment.

Your job is to keep improving location search and future map readiness while
preventing bad public pins. Do not enable the public map until the explicit
launch gates pass.

## Repository And Current State

- Repo: `overlordforthew/OnlyHulls`
- Local worktree used by Codex: `/root/worktrees/OnlyHulls-complete-public-mapping`
- Production branch: `main`
- Latest functional map/location merge at handoff: `a64a633`
- Pickup note added after that: `documents/pickup-location-map-round22.md`
- Public map feature status: disabled intentionally.
- Current expected live map API response:
  - URL: `https://onlyhulls.com/api/boats/map?limit=5`
  - Response: `404 {"error":"Map is not enabled."}`

Read these files before changing anything:

1. `documents/pickup-location-map-round22.md`
2. `documents/public-map-operations.md`
3. `documents/public-pin-aliases.md`
4. `documents/location-geocoding-rollout.md`
5. `reports/location-backlog/2026-04-21-round22.md`

## Consensus Requirement

The user wants this work to continue with the same consensus discipline Codex
used during the previous rounds. Do not treat consensus as optional process
decoration; it is part of the safety system for map/location work.

For every round:

1. Gather evidence first.
   - Read the relevant code, docs, production data, provider previews, and
     previous reports.
   - Bound the question tightly. Do not ask for a repo-wide vague review.
2. Run an independent review before implementation or production apply.
   - If you have access to another strong model or reviewer, ask it to challenge
     the proposed path.
   - If you are Claude and cannot call a separate reviewer, run a separate
     written arbitration pass yourself that explicitly labels each proposed
     action as `Confirmed`, `Partially Confirmed`, or `Rejected`, then act only
     on the confirmed overlap.
3. Before production apply, get a clear decision:
   - `APPLY`
   - `DO NOT APPLY`
   - blockers, if any
   - non-blocking follow-ups
4. After implementation and verification, do a second ship gate:
   - `SHIP`
   - `DO NOT SHIP`
   - blockers
   - residual risks
   - next recommended target
5. Record the consensus outcome in the docs or PR body.

Consensus should be especially strict for:

- adding verified aliases
- creating or changing gazetteer evidence
- promoting rows to public-pin precision
- changing geocode precision classification
- enabling any public map flag
- broadening source cleanup rules

The preferred output shape for each consensus pass:

```text
1. Decision: APPLY / DO NOT APPLY or SHIP / DO NOT SHIP
2. Blockers
3. Non-blocking follow-ups
4. Why this is safe or unsafe
5. Next target recommendation, if relevant
```

If consensus is uncertain, do not apply production changes. Leave the rows held
back and document why.

## Absolute Guardrails

Do not enable the public map.

Do not turn city, region, country, or admin-boundary geocodes into public pins.

Only `exact`, `street`, and `marina` precision rows can be public pins.

Do not add broad matching for terms like:

- `marina`
- `harbour`
- `yacht harbour`
- `marine`
- `dock`
- `port`

Verified facility work must be narrow, evidence-backed, and test-backed.

Do not apply production geocode changes without:

1. A focused preview.
2. A clean public-pin apply gate.
3. `publicPinEligibleRate=1` for tiny verified-public-pin batches unless there
   is an explicit documented reason.
4. `failed=0`.
5. `warnings=[]`.
6. `geographyMismatches=[]`.
7. Backup table recorded.
8. Follow-up retry lane showing `selectedRows=0`.
9. Backup-scoped map-pin audit passing.
10. Readiness checked.
11. Map API still disabled with 404.

## What Codex Completed

### Round 21: Lelystad Search Coverage

- PR `#28`, merge `097b367`, feature commit `dd6993a`.
- Backup table: `boat_geocode_backup_20260421141932`.
- 32 Lelystad rows gained city/search-only coordinates.
- 0 public pins.
- Public map stayed disabled.
- Added a closed exact `City, Country` confidence-3 search-only exception.

Important: this exception is not a public-pin shortcut.

### Round 21 Follow-Up: Backup Slug Hardening

- PR `#29`, merge `c372e9a`, feature commit `7f32735`.
- Fixed future geocode backup snapshots to include `slug` for audit convenience.
- Rollback remains keyed by immutable `id`.
- This addressed production log alerts about old backup tables missing `slug`.

### Round 22: Verified Chatham Marina Pins

- PR `#30`, merge `a64a633`, feature commit `73c6227`.
- Production backup table: `boat_geocode_backup_20260421152318`.
- Added verified alias:
  - `mdl chatham maritime marina boatyard`
- Canonical query:
  - `MDL Chatham Maritime Marina Boatyard, Chatham, United Kingdom`
- Provider result:
  - `MDL Chatham Maritime Marina Boatyard, Chatham, Medway, England, United Kingdom`
- Coordinates:
  - `51.4025553, 0.5321595`
- Required anchor:
  - country code `gb`
  - max distance `0.5 km`
  - score `>= 0.98`
  - provider `_type=boatyard`
  - provider `boatyard=MDL Chatham Maritime Marina Boatyard`

Only these source texts canonicalize:

- `Chatham Marina, Kent`
- `Chatham Marina, Chatham Kent`

These do not canonicalize:

- plain `Chatham Marina`
- `Chatham Marina, Kent Coast`
- Dover pier/road text
- Chatham-like water results
- wrong-country or low-score alias attempts

Production Round 22 apply:

- Targeted IDs: 5
- Selected rows: 4
- Excluded: 1 plain pending `Chatham Marina` row with no country
- Provider fetches: 1
- Public-pin eligible: 4
- Public-pin eligible rate: 1
- Geocoded: 4
- Review/failed/skipped: 0
- Precision: `marina=4`
- Geography mismatches: 0
- Warnings: 0
- Backup-scoped map-pin audit: 4/4 eligible
- Follow-up verified-alias lane: 0 selected rows
- Map API stayed disabled with 404

Four listings pinned:

- `1970-great-dane-37-chatham-marina`
- `1984-jeanneau-arcadia-chatham-marina`
- `1987-lm-30-chatham-marina`
- `2000-beneteau-oceanis-361-clipper-chatham-marina`

One listing intentionally stayed pending:

- `2000-jeanneau-sun-odyssey-32-2-chatham-marina`

## Current Readiness

At the end of Round 22:

- Verdict: `NO_GO_KEEP_PUBLIC_MAP_DISABLED`
- Active visible rows: 12,670
- Geocodable address count: 4,119
- Public pin count: 267
- Public coverage across geocodable addresses: 6.48%
- Active-visible public coverage: 2.11%
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

Launch blockers still exist:

- Golden accuracy artifact missing/stale.
- Public-pin coverage is far below launch threshold.
- Pending-ready queue is still too high.
- Review/failed rate is still too high.
- Regional coverage is still too low.

## Verification Already Completed

Before/around the Round 22 merge:

- Focused geocode tests: 48/48 passed.
- Full unit tests: 242/242 passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- GitHub CI:
  - `quality`: passed.
  - `browser-local`: passed.
- Production browser smoke:
  - passed 36/36 after one transient timing flake was rerun successfully.
- Production deploy health reported `a64a633`.
- Map API remained disabled with 404.

Claude consensus before the Round 22 production apply said:

- `APPLY`
- no blockers

A later final Claude review attempt hung for more than 10 minutes and was killed
cleanly. Do not interpret that as a negative review.

## Your First Task

Start Round 23. Do not jump directly to applying more pins.

The correct next move is to design and test a small verified facility gazetteer
evidence layer for hard POIs, then use it on tiny targeted batches only when the
evidence is strong.

Recommended Round 23 target set:

1. `Marina Anse Marcel`
2. `Marina Del Rey`
3. `Dover Marina`
4. `Green Cay Marina`
5. remaining plain `Chatham Marina`

The point of Round 23 is not to force these into public pins. The point is to
prove which of them, if any, can be promoted safely.

## Known Evidence For Round 23 Targets

### Marina Anse Marcel

Observed provider behavior:

- `Marina Anse Marcel, Saint Martin` resolved as broad city/search-only, not a
  marina-grade facility.
- `Marina Anse Marcel, Anse Marcel, Saint Martin` resolved broad/low.
- `Port de Lonvilliers Marina Anse Marcel, Saint Martin` resolved wrong.

Instruction:

- Defer public pin until there is verified facility-grade evidence.

### Marina Del Rey

Observed provider behavior:

- `Marina Del Rey, California, United States` resolved broad county/postcode.
- `Marina del Rey Marina, California, United States` risked resolving to the
  wrong `Marina, CA` area.
- `Marina del Rey Admiralty Way Marina, California, United States` produced
  hotel-ish evidence, not a clean marina facility.

Instruction:

- Do not public-pin from broad city/county/postcode evidence.
- This likely needs a verified facility/gazetteer model, not plain aliasing.

### Dover Marina

Observed provider behavior:

- `Dover Marina, Kent, United Kingdom` resolved to
  `Dover Pier, New Marina Curve Road`.
- The token `Marina` appears in road text.

Instruction:

- Keep this out of `marina` precision unless a different provider/evidence path
  proves an actual facility coordinate.

### Green Cay Marina

Observed provider behavior:

- Queries resolved to broad St. Croix / USVI area, not the marina facility.

Instruction:

- Defer public pin until verified facility coordinates exist.

### Plain Chatham Marina

Observed production row:

- One active pending row has plain `Chatham Marina` with no country.

Instruction:

- Do not canonicalize it to MDL Chatham without source/country enrichment.

## Recommended Round 23 Workflow

1. Read the handoff docs listed above.
2. Run a consensus/second-opinion review before implementation.
   - Ask whether to build a small verified gazetteer evidence layer or continue
     with one-off aliases.
   - Recommended answer: build a small structured gazetteer evidence layer.
   - The consensus output must include a clear `APPLY` / `DO NOT APPLY` or
     `SHIP` / `DO NOT SHIP` decision when it reaches an action gate.
3. Query production for the target rows.
   - Capture ID, slug, `location_text`, `location_country`, `location_region`,
     `location_confidence`, geocode status/query/precision, coordinates.
4. Preview provider results for every target and negative variant.
   - Keep provider evidence separate from source text assumptions.
5. Design the gazetteer structure conservatively.
   - It should support:
     - canonical facility name
     - accepted source aliases
     - country codes
     - latitude/longitude
     - max distance
     - minimum score
     - required provider component/type when available
     - evidence note
     - negative checks
6. Add tests first.
   - Positive exact facility case.
   - Wrong country.
   - Broad city/admin result.
   - Road/pier/parking/postcode false positives.
   - Missing-country source text.
7. Preview production targeted IDs with `--fetch-missing`.
8. Apply only if the preview is boring:
   - `publicPinEligibleRate=1`
   - `failed=0`
   - `warnings=[]`
   - `geographyMismatches=[]`
9. After apply:
   - Record backup table.
   - Rerun targeted retry lane; expect selectedRows=0.
   - Run backup-scoped map-pin audit.
   - Run readiness.
   - Confirm map API still returns 404.
10. Update docs and generate Round 23 backlog report.
11. Run:
   - focused tests
   - `npm run test:unit`
   - `npm run typecheck`
   - `npm run lint`
   - `npm run build`
   - browser smoke as appropriate
12. Use a PR, wait for CI, merge, and verify production deploy health.

## Production DB Environment Setup

Use this pattern from the worktree:

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

## Commands To Use

Check deploy health:

```bash
curl -fsS https://onlyhulls.com/api/public/deploy-health
```

Check map remains disabled:

```bash
curl -s -o /tmp/onlyhulls-map-status.txt -w '%{http_code}\n' 'https://onlyhulls.com/api/boats/map?limit=5'
cat /tmp/onlyhulls-map-status.txt
```

Run readiness:

```bash
npm run db:geocode-readiness -- --json
```

Generate Round 23 backlog:

```bash
npm run db:location-backlog -- --top=30 --stamp=2026-04-21-round23 --write
```

Targeted verified-alias preview pattern:

```bash
npm run db:geocode-locations -- --limit=5 \
  --boat-ids=<comma-separated-uuid-list> \
  --include-review \
  --retry-changed-review \
  --verified-public-pin-aliases \
  --fetch-missing
```

Targeted verified-alias apply pattern:

```bash
npm run db:geocode-locations -- --limit=5 \
  --boat-ids=<comma-separated-uuid-list> \
  --include-review \
  --retry-changed-review \
  --verified-public-pin-aliases \
  --apply
```

## What Not To Do

Do not enable:

- `PUBLIC_MAP_ENABLED=true`
- `NEXT_PUBLIC_MAP_ENABLED=true`

Do not launch a public map over city/region/country coordinates.

Do not treat a marina word inside a road, hotel, parking lot, postcode, county,
or broad city result as a marina facility.

Do not normalize plain `Chatham Marina` to the MDL Chatham boatyard without
country/source enrichment.

Do not add a global `marina` or `yacht harbour` classifier.

Do not apply a batch just because search results look plausible. Public map pins
need buyer-defensible precision.

## Desired Outcome

Round 23 should leave the project in one of two safe states:

1. A small, tested verified-gazetteer layer exists and one tiny target batch was
   safely applied with public map still disabled.
2. The evidence was insufficient, no public pins were applied, and the docs
   clearly explain why those targets remain held back.

Either outcome is acceptable. Bad public pins are not.
