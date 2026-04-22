# Retired Location/Map Documentation

The documents in this folder describe the **marina-precision regime** that ran
from Round 22 through Round 37. That regime was retired on **2026-04-22** when
the location floor was reset to **country-minimum, city-maximum** (no marina,
street, or exact targets — ever).

These files are preserved as historical context for why the current pipeline
looks the way it does. They do **not** describe current behavior. For that,
see:

- `documents/country-city-geocoding.md` — the live policy and pipeline
- `documents/claude-location-map-handoff.md` — current handoff for Claude/Codex

## What changed on 2026-04-22

- `PUBLIC_MAP_PRECISIONS` shrank to `["city"]` (was `["exact", "street", "marina", "city"]`).
- All persisted rows at `exact`/`street`/`marina` precision were clamped to
  `city` with 2-decimal coord rounding (migration `036_clamp_legacy_marina_precision.sql`).
  Pre-clamp state is captured in
  `boats_geocode_precision_backup_036_marina_clamp` and is reversible via
  migration `037_restore_marina_precision.sql`.
- The verified-public-pin alias gazetteer and all related candidate lanes,
  marina-anchor scoring, and facility-grade matching code was deleted from
  the runtime.
- The geocoding pipeline now accepts `country` precision as success and
  synthesizes country-precision results locally from stored `location_country`
  when the provider would otherwise return nothing usable.

## Rationale

The project owner directed: "Find each listing's home country. If that is all
it has, great. If it has city/country, great. Stop there. No specific address
or marina. PERIOD."

The marina-targeting work was not wrong for its prior goals — it simply is not
what the product wants now. The backup tables are kept so this choice is
reversible without re-running provider calls.
