# Public Map Launch Readiness — Summary (as of Round 31)

This document captures where the OnlyHulls public map stands on its 13 launch gates after rounds 22–31, what the remaining blockers are, and which of them can be moved by additional automated work vs. which require a policy or data-enrichment decision.

## TL;DR

- **9 of 13 gates passing.** The 5 public-pin invariants (admin-boundary, invalid coords, missing metadata, low-score, stale) are all at zero. Country-hint mismatches are zero. Provider error rate is under threshold. `pending_ready_queue` crossed below 10% in Round 29.
- **4 gates failing.** Of those:
  - 1 is a **prod-runtime operator task** (`golden_set_accuracy`) — not shippable via git.
  - 2 are **structural ceilings** (`public_pin_coverage`, `regional_coverage_floor`) that cannot be closed by any amount of automated work at the current threshold values. They would need either threshold tuning or a region-specific launch strategy.
  - 1 is **grindable with diminishing returns** (`review_failed_rate`) — each source-cleanup or cache invalidation moves it 1–2% but the remaining rows are mostly conf=2 city matches the classifier correctly refuses.

## Gate status

| Gate | Current | Target | Status | What it takes to close |
|---|---|---|---|---|
| paid_provider_configured | opencage:configured | — | ✓ | — |
| country_hint_mismatch_zero | 0 | 0 | ✓ | — |
| provider_error_rate | ~0.5% | <5% per bucket | ✓ | — |
| public_admin_boundary_zero | 0 | 0 | ✓ | — |
| invalid_public_coordinates_zero | 0 | 0 | ✓ | — |
| public_pin_metadata_complete | 0 | 0 | ✓ | — |
| public_pin_score_floor | 0 | 0 | ✓ | — |
| stale_public_coordinates_zero | 0 | 0 | ✓ | — |
| pending_ready_queue | 9.2% | <10% | ✓ | — |
| golden_set_accuracy | missing_artifact | fresh <=30d, median <=1km, precision match >=80% | ✗ | Run `npm run db:geocode-compare -- --mode=golden --fetch-missing --provider=opencage --max-fetches=50 --write-artifact` inside the production container; artifact writes to `tmp/geocode-compare-latest.json` which the readiness report reads from `process.cwd()`. This is an **operator task** — not shippable via git. |
| public_pin_coverage | 6.7% | ≥85% | ✗ | **Structural ceiling.** Target requires ~3,500 marina-precision pins vs 280 current. Most remaining geocodable rows have city-only source text (e.g. `Florida`, `California`, `Athens, Greece`) — these can NEVER become marina pins by any automated geocoding, only via manual seller-facing source-text enrichment. Realistic paths: (a) lower threshold via `MAP_READINESS_MIN_PUBLIC_PIN_PCT` — product decision; (b) launch region-by-region where a market naturally has good listing text; (c) bulk manual text enrichment — not automatable from this codebase. |
| review_failed_rate | 33.76% | <5% | ✗ | **Grindable with diminishing returns.** Search-coverage batches climb this; targeted cleanups (R30) move it 1–2% per round. Remaining ~350 review rows are mostly conf=2 city matches (Bodrum, Marmaris, Corfu) that OpenCage rates low because the name is ambiguous. To pass <5% requires: (a) per-cluster source-cleanup rules for specific dirty-text patterns (slow, custom per cluster, probably 5–10 more rounds of effort for modest gains), (b) a confidence-floor policy change, or (c) seller-facing source-text enrichment. Realistically, a target of ~15–20% is the automatable floor; <5% needs a policy change. |
| regional_coverage_floor | 20 failing countries | No country with >=50 visible listings below 60% public-pin coverage | ✗ | **Structural ceiling.** US has 5,995 listings and 1 public pin (0.02%). Getting US to 60% would need ~3,600 US marina pins. Most US listings say `Florida` or `California` — same city-level limit as `public_pin_coverage`. The best country is UK at 9.9%. Realistic paths: (a) lower threshold, (b) regional launch (only launch markets that already pass), (c) bulk enrichment. |

## Current state metrics

| Metric | Start (Round 22) | Now (Round 31) | Δ |
|---|---|---|---|
| Verified aliases | 10 | 14 | +4 (Chatham was already there; R23+24+25 added Green Cay, Toronto Island, Alcaidesa, D-Marin Didim) |
| Public pins | 267 | 280 | +13 |
| Raw coordinates | 805 | 2007 | +1202 |
| Pending-ready rate | 23.62% | 9.21% | -14.41 ✓ (gate passed) |
| Review/failed rate | 30.82% | 33.76% | +2.94 (climbed due to search-coverage; partially clawed back by R30 cleanup) |
| Invariants (5) | all 0 | all 0 | ✓ (with one R28 regression caught + R29 fixed via cache invalidation + classifier guard) |
| Unit tests | 242 | 259 | +17 (R23+R24+R25 alias/canonicalization + R28 classifier-guard regression) |

## Code + data changes that shipped

- **Round 23** (PR #31): `green cay marina` alias + `providerCountryCodes` field for multi-country aliases (narrow OpenCage country-filter widening).
- **Round 24** (PR #32): `toronto island marina` alias + wrong-country anchor regression tests from Round 23 gate #2 follow-up.
- **Round 25** (PR #33): `alcaidesa marina` + `d marin didim marina` aliases. Alcaidesa exercises the Round 23 country-filter widening (second consumer).
- **Round 26** (PR #34): 100-row search-coverage batch.
- **Round 27** (PR #35): 250-row search-coverage batch (script caps at 250 per batch via internal diversity guard).
- **Round 28** (PR #36): 3× 250-row batches + classifier guard rejecting admin-boundary `_type` from `resultAndQueryHaveKnownMarinaName`. Caught a Tortola/Nanny-Cay-as-island promotion.
- **Round 29** (PR #37): 3× 250-row batches, **pushed `pending_ready_queue` below 10% target**. Caught a cache-poisoning case where Round 28's fix didn't cover stale cache entries.
- **Round 30** (PR #38): Deleted 17 pre-Round-21 stale cache entries for `exact City, Country` conf=3 queries; 43 rows moved review→geocoded.
- **Round 31** (this branch): Two more `--include-review` batches; 12 rows moved review→geocoded. Diminishing returns.

## Recommended next decisions

For further progress toward the 85% `public_pin_coverage` target, the automated levers are exhausted. The remaining options are:

1. **Threshold tuning.** Current `MAP_READINESS_MIN_PUBLIC_PIN_PCT=85` and `regional_coverage_floor >=60%` were set aspirationally. If the data quality ceiling is closer to 10–20% public-pin coverage, the thresholds could be adjusted to reflect that and the map could launch.
2. **Regional launch.** Launch the map in UK/Panama/Bahamas/Sint Maarten/Greece where per-country coverage is higher, and keep it gated for US/Spain/France/Italy until more data arrives. Requires a launch-flag mechanism that respects country.
3. **Manual source-text enrichment.** The 6,466 `needs_more_specific_location` rows can't be fixed by code; they need the seller to add a city/marina name. A seller-facing prompt or admin review UI could raise this over time.
4. **Generate the golden accuracy artifact in prod.** One-time operator task, closes one gate immediately.
5. **More source-cleanup rules for conf=2 review clusters.** Each cluster is ~20 rows; probably 5–10 rounds would shave review_failed_rate from ~34% to ~20%. Still doesn't reach <5%.

## What "10/10" realistically means for this feature

Given the data quality ceiling, the automatable state is:
- All invariants green (where we are now)
- `pending_ready_queue` under target (where we are now)
- `review_failed_rate` around ~20% (a few more rounds of targeted cleanup)
- `public_pin_coverage` around ~10–15% (pick off remaining gazetteer candidates + continued cleanup)
- `regional_coverage_floor` shows pockets of strong coverage and pockets that need seller enrichment

A **"10/10 for what the map can be with current data"** is a Public-Map-Launched state in select countries with a lower coverage threshold. A **"10/10 by the originally-set thresholds"** requires threshold tuning or bulk enrichment — both outside automated scope.
