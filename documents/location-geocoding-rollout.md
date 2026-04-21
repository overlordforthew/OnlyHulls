# Location Geocoding Rollout

This runbook is for the first commercial coordinate backfill. It does not launch the public map. Keep `PUBLIC_MAP_ENABLED=false` until the admin readiness panel, readiness report, and sample-pin audit all agree the data is ready.

## Provider Policy

- Use `opencage` for commercial backfills. OpenCage documents long-lived result storage in its API and pricing docs: https://opencagedata.com/api and https://opencagedata.com/pricing.
- Use public Nominatim only for small validation runs. The OpenStreetMap Foundation Nominatim policy caps public use at about one request per second and discourages bulk geocoding: https://operations.osmfoundation.org/policies/nominatim/.
- Do not use a geocoder whose terms forbid storing geocoded results unless that provider also supplies the rendered map under compatible terms.

## Preflight

Use the preflight phase that matches the operation:

- `--phase=backfill` is for safe coordinate writes. It requires OpenCage, the intended database, public map flags off, and next-batch apply safety, but it does not require MapTiler launch config yet.
- `--phase=launch` is for exposing the buyer-facing map. It stays strict: map tile config, provider pings, readiness gates, review queue, stale pins, and low-score pins must all pass before the public flags are enabled.

1. Confirm production env:

   ```bash
   PUBLIC_MAP_ENABLED=false
   LOCATION_GEOCODING_PROVIDER=opencage
   LOCATION_GEOCODING_API_KEY=<live OpenCage key>
   LOCATION_GEOCODING_USER_AGENT=OnlyHulls/1.0 (<monitored support email>)
   LOCATION_GEOCODING_EMAIL=<monitored support email>
   ```

2. Refresh derived location markets before buying coordinates:

   ```bash
   npm run db:backfill-location-markets
   ```

3. Run the read-only readiness report and fix P0 blockers before any write batch:

   ```bash
   npm run db:map-launch-preflight -- --phase=backfill
   npm run db:geocode-readiness
   npm run db:geocode-review
   ```

   `db:map-launch-preflight -- --phase=backfill` is the non-destructive GO/NO-GO gate for coordinate batches. It checks geocoder env, public map flags are off, readiness availability, review queue state, and the next batch size before any `--apply` run. Tile-provider env is intentionally deferred to the launch phase.

   Add `--ping` only when you intentionally want live provider connectivity checks. In `backfill` phase, ping mode makes one OpenCage `no_record=1` probe request and defers map style checks to launch, so use it after the real OpenCage key is configured and before the first paid batch:

   ```bash
   npm run db:map-launch-preflight -- --phase=backfill --ping
   ```

4. Refresh the provider comparison/golden-set artifact:

   ```bash
   npm run db:geocode-compare -- --mode=golden --fetch-missing --provider=opencage --max-fetches=50
   npm run db:geocode-readiness
   ```

5. Confirm the admin location readiness panel has no country-hint mismatch groups and no provider/config blockers.

## First Apply Batch

Start with a batch small enough to manually inspect:

```bash
npm run db:geocode-locations -- --limit=25 --fetch-missing
```

For the initial buyer-map pin lane, prefer the opt-in public-pin selector before any apply:

```bash
npm run db:geocode-locations -- --limit=25 --public-pin-candidates --fetch-missing
```

The `--public-pin-candidates` lane is intentionally separate from the default search-coverage lane. It selects marina, yacht club, boatyard, shipyard, dock, quay, darsena, `port de plaisance`, and similar marine-specific rows first, so broad city-only rows can be handled later without polluting the initial public-pin rollout. It intentionally excludes standalone `puerto`, `porto`, `harbour`, `marine`, and `yacht` terms because those frequently resolve to city, country, or broad place results rather than public map pins.

In the public-pin lane, only provider results with `exact`, `street`, or `marina` precision are eligible to update boat coordinates. City, region, country, and unknown results are still audited and cached during apply, but they are held in review for later search-coverage work. The summary fields `publicPinEligible`, `publicPinHeldBack`, and `publicPinEligibleRate` are the launch-safety signal for this lane.

Apply only after the preview is clean:

```bash
npm run db:geocode-locations -- --limit=25 --public-pin-candidates --apply
```

The apply command blocks when `publicPinEligibleRate` is below `0.6`. Treat that as a data-quality stop, not a script failure: clean the bad source rows, adjust the lane with tests, or run a smaller verified batch before trying again.

Current source-cleanup scope:

- Test-backed query normalization exists for recurring `Nanny Cay Boatyard` and hyphenated/parenthetical `Marina Bas-Du-Fort` source text because provider previews return marina precision for their canonical queries.
- Test-backed query normalization also exists for recurring `Hodge's Creek Marina Hotel`, `Camper & Nicholsons Port Louis Marina`, `Zea Marina`, `La Paz, Costa Baja Marina, Americas`, `La Cruz Marina Near Puerto Vallarta`, dirty `Shelter Bay Marina` variants, `Linton Bay Marina Garrote Coln`, `Verkoophaven Delta Marina` and `Schepenkring Delta Marina` variants, `Marina Vaiare`, `Chiapas Marina`, `Puerto Escondido Loreto Marina, BCS`, `Bluffers Park Yacht Club`, `Foxs Marina, Ipswich`, `Penarth Marina Cardiff`, `Greystones Harbour Marina`, `Northern Ireland, Carrickfergus Marina`, `Clarke's Court Boatyard & Marina`, `British Virgin Islands, Hodge's Creek Marina, Caribbean`, `Dubrovnik, Komolac, ACI Marina Dubrovnik`, `Šibenik, Marina Zaton, Mediterranean`, `Kos, Kos Marina, Mediterranean`, and `Marsh Harbour, Conch Inn Marina, Bahamas` source text because provider previews return marina precision for their canonical queries.
- Round 18 adds test-backed geocode-query cleanup for Dutch `Aan Verkoopsteiger In` sales-dock prefixes, Saint Martin/Sint Maarten suffix variants, misspelled place tokens (`Bahmas`, `Martiniqe`, `El Hiero`, `Santantioco`, scoped `Grenade Caribbean`), anchored Canadian Lake Huron/Osoyoos rows, and directional fragments such as `North East Of`. Round 21 extends the Dutch rule to the observed `Aaan Verkoopsteiger In` typo. This cleanup intentionally leaves imported `location_text` untouched and uses narrow targeted runs or `--retry-changed-review` so only rows whose normalized query changed are retried.
- Round 19 adds test-backed geocode-query cleanup for `Trogir, Yachtclub Seget (Marina Baotić)` source text, canonicalizing it to `Marina Baotic, Seget Donji, Croatia` only because live OpenCage preview returns the marina-grade facility while the broader Trogir/Yachtclub queries return only Trogir city.
- Round 22 adds test-backed geocode-query cleanup only for exact `Chatham Marina, Kent` and `Chatham Marina, Chatham Kent` source text, canonicalizing those reviewed rows to `MDL Chatham Maritime Marina Boatyard, Chatham, United Kingdom`. Plain `Chatham Marina` without Kent/country context remains unselected.
- Round 23 adds test-backed geocode-query cleanup only for exact `Green Cay Marina St. Croix`, `Green Cay Marina, St Croix, Virgin Islands (US) (USVI)`, and `Green Cay Marina, Virgin Islands (US) (USVI)` source texts, canonicalizing those reviewed/pending rows to `Green Cay Marina, Christiansted, US Virgin Islands`. BVI-suffixed `Green Cay Marina, St Croix, BVI`, plain `Green Cay Marina` without country, and `Cay Marina, St. Croix` are intentionally not canonicalized; they either stay held at `buildGeocodeQuery` upstream or fail the `green cay marina` anchor's country/component gate. Round 23 also formalizes an optional alias-definition contract (`canonicalProviderQuery`, `acceptedSourceTexts`, `negativeSourceTexts`) and adds a unit contract test that enforces every `acceptedSourceTexts` entry canonicalizes exactly to `canonicalProviderQuery` via `prepareGeocodeLocationText` and every `negativeSourceTexts` entry does not.
- Round 24 adds one narrow anchored `^\s*Toronto\s+Island\s+Marina\s*$` canonicalization rule that rewrites exactly that bare text (no country/region qualifier) to `Toronto Island Marina, Toronto, Ontario, Canada`. Any qualified variant passes through unchanged; the verified `toronto island marina` alias anchor still applies to those.
- Round 25 adds two anchored canonicalization rules: `Alcaidesa Marina In Spain Near Gibraltar` → `Alcaidesa Marina, La Línea de la Concepción, Spain`, and `Didim Marina, Turkey` → `D-Marin Didim Marina, Didim, Turkey`. Both are strictly exact matches; near-miss variants (e.g. `Didim Harbour, Turkey`, `Alcaidesa Marina, Gibraltar Bay`) are intentionally not touched and remain handled by the alias anchor's country/component rejection. The Alcaidesa alias sets `countryCodes=["es","gi"]`, which triggers the Round 23 `providerCountryCodes` widening so OpenCage receives `countrycode=es,gi` — required because the facility is tagged `country_code=es` even when the row's stored country is Gibraltar.
- Production one-off location text cleanup has rollback snapshots in `boat_location_text_cleanup_backup_20260421014841`, `boat_location_text_cleanup_backup_20260421020349`, and `boat_location_text_cleanup_backup_20260421022049`.
- Do not normalize `Green Cay Marina`, `St. Thomas Yacht Club`, `Puerto Bahia Marina`, broad `Clarke's Court` rows without the exact boatyard/marina phrase, `Riva Di Traiano`, `Villanova Marina`, `BVI Yacht Charter Docks`, `Marina Di Ragusa`, `Sune Carlsson Boatyard`, `Red Frog Marina`, `Pankor/Pangkor Marina`, `Ocean Marina Pattaya`, `Wiarton/Wiatron Marina`, `Marina Del Ray Orillia`, `Marina Riviera Nayarit`, `Marina Guaymas`, `Rio Dulce Marina`, `Swanwick Marina`, `Marina De L'Anse Marcel`, `D-Marin Lefkas`, `Dover Marina`, plain `Chatham Marina` without Kent/country context, `Port Solent Marina`, `Shotley Marina`, `Carlyle West Access Marina`, `Shores Of Leech Lake Marina`, `Tollesbury Marina`, `Deko Marina`, `Carrickfergus Harbour Marina`, `Roses, Empuriabrava Marina`, `Northshore Shipyard, Chichester`, or `Pembroke Dock, Pembrokeshire` yet. Current provider previews still return city/review/unknown precision for those rows, so they need provider/policy review before public pins.
- Round 16 verified aliases for `Conwy Marina`, `Chichester Marina`, `Palm Cay Marina`, `Medway Yacht Club`, `Lagoon Marina`, and `Marina Frapa`, plus the Round 19 `Marina Baotic`, Round 20 `Linton Bay Marina`, and Round 22 `MDL Chatham Maritime Marina Boatyard` aliases, are not broad source-text normalization rules. Retry those only through `--verified-public-pin-aliases`, which keeps them behind explicit alias evidence and the public-pin apply gate.

Rollback for the one-off text cleanup uses the backup table for the affected rows:

```sql
UPDATE boats b
SET location_text = backup.location_text,
    updated_at = backup.updated_at
FROM boat_location_text_cleanup_backup_YYYYMMDDHHMMSS backup
WHERE b.id = backup.id;
```

The script refuses `--apply` when `PUBLIC_MAP_ENABLED=true` unless `--allow-public-map-apply` is passed for an intentional live-map maintenance run. Do not use that override during the initial backfill.

Public Nominatim write-runs are intentionally capped to small validation batches. If a Nominatim batch hits the validation ceiling, switch to OpenCage for production instead of overriding by habit.

## Batch Review

After each apply batch, inspect the JSON output:

- `precisionSplit`: exact, street, and marina are public-map candidates; city is searchable but not a hard public pin.
- `failureReasons`: provider quota/rate-limit failures mean stop and fix provider health before retrying.
- `geographyMismatches`: any country or region mismatch blocks scale-up until source text or country inference is fixed.
- `samplePins`: open every audit URL in the first batch. For later batches, inspect at least 20 random pins or every emitted sample, whichever is smaller.

Then generate a reusable sample from persisted public-map pins:

```bash
npm run db:map-pin-audit -- --limit=25 --seed=first-batch
```

If the geocode apply command printed a `backupTable`, audit only rows touched by that batch:

```bash
npm run db:map-pin-audit -- --backup-table=boat_geocode_backup_YYYYMMDDHHMMSS --limit=25 --seed=first-batch
```

The backup-table filter scopes the audit to boats touched by that batch, but the coordinates shown come from the current `boats` row. If a later batch rewrites the same boat, rerun the audit with a fresh seed before treating that sample as accepted.

Record each sample pin as accept/reject. Scale only when at least 95% of sampled pins land in the correct city/marina/harbor area and all exact/street/marina pins look defensible to a buyer.

For the final launch audit, write a reviewed attestation artifact with zero rejected pins:

```bash
npm run db:map-pin-audit -- --limit=25 --seed=launch-review --attest --reviewed-by=<operator> --accepted=25 --rejected=0 --emit-report=artifacts/map-pin-audit-launch.json
```

Launch preflight requires that artifact and recomputes the sample hash against the current database:

```bash
npm run db:map-launch-preflight -- --phase=launch --ping --pin-audit-report=artifacts/map-pin-audit-launch.json
```

Then rerun:

```bash
npm run db:map-launch-preflight -- --phase=backfill
npm run db:geocode-readiness
npm run db:geocode-review
```

## Backlog Analysis

Before building new gazetteer rules or large cleanup batches, generate a backlog snapshot:

```bash
npm run db:location-backlog -- --top=30 --stamp=YYYY-MM-DD-roundN --write
```

The script writes `reports/location-backlog/<stamp>.json` and `.md`. Treat the `actionableLiftCandidates`, `gazetteerSeedRecommendations`, `sourceCleanupPatternCandidates`, and `manualEnrichmentDeduplication` sections as the next-round planning input. Do not use the report as launch approval; it is a targeting tool while `PUBLIC_MAP_ENABLED=false`.

## Scaling

Increase batch size gradually only when the previous batch has:

- no `geographyMismatches`;
- no unexpected `failureReasons`;
- review/failed rows triaged by bucket;
- public-pin coverage improving without low-score or stale-pin blockers;
- `publicPinEligibleRate >= 0.6` for the public-pin lane;
- a fresh compare artifact less than 30 days old.

Recommended sequence:

```bash
npm run db:geocode-locations -- --limit=25 --public-pin-candidates --fetch-missing
npm run db:geocode-locations -- --limit=25 --public-pin-candidates --apply
npm run db:geocode-locations -- --limit=100 --public-pin-candidates --fetch-missing
npm run db:geocode-locations -- --limit=100 --public-pin-candidates --apply
```

Use `--include-review` only after the review queue has been cleaned up. It should not be used to repeatedly retry bad source text.

When a reviewed row becomes eligible only because code now produces a different normalized geocode query, use the targeted retry lane instead of broad review retries:

```bash
npm run db:geocode-locations -- --limit=100 --public-pin-candidates --include-review --retry-changed-review --fetch-missing
```

`--retry-changed-review` excludes pending rows and only reprocesses review/failed rows whose current normalized query key differs from the stored `location_geocode_query`. This keeps source-cleanup rounds bounded to rows the new code actually changed. Apply still requires the normal public-pin gates: `publicPinEligibleRate >= 0.6`, `failed=0`, `warnings=[]`, and `geographyMismatches=[]`.

Round 14 classifier hardening is preview-only: `yacht harbour` remains outside the public-pin candidate lane until a later round validates lane expansion. The guard now requires marine POI result/query term agreement instead of substring matches, so `Suffolk Yacht Harbour` resolving to `Harbourside Kitchen` stays review/unknown while `Burnham Yacht Harbour` remains marina precision when the provider result names the harbour directly.

Round 15 introduces verified public-pin aliases as a narrow lane for reviewed marine facilities that are too risky to match by broad term. The first alias is `burnham yacht harbour`; global `yacht harbour` matching remains disabled because the same preview set included `Suffolk Yacht Harbour` resolving to `Harbourside Kitchen` and postcode variants resolving only to city precision. See `documents/public-pin-aliases.md` before adding future aliases.

Round 16 adds a dedicated reviewed-alias retry lane:

```bash
npm run db:geocode-locations -- --limit=25 --include-review --verified-public-pin-aliases
```

Use this only for documented aliases in `documents/public-pin-aliases.md`. It intentionally narrows review retries to rows whose current geocode query contains a verified alias instead of re-opening every row selected by the broader marina public-pin lane. Cached city/unknown results promote only when the same alias appears in the provider result and the result stays inside the documented country/coordinate anchor.

Round 19 adds an even narrower changed-geocoded retry lane for existing non-public city/region/country/unknown coordinates whose recomputed query changed:

```bash
npm run db:geocode-locations -- --limit=25 --include-review --retry-changed-review --retry-changed-geocoded --verified-public-pin-aliases
```

`--retry-changed-geocoded` is disabled unless `--verified-public-pin-aliases` is also passed, is capped to `--limit=50`, excludes existing public-grade exact/street/marina pins, and requires a verified alias in both the source location text and recomputed query. Use it only when a vetted canonical query can safely upgrade old search-only coordinates to public-pin precision.

If a retried non-public city/region/country/unknown row does not return public-pin precision, the public-pin apply lane holds it in review and clears the stale non-public coordinates. That is intentional: a verified-alias retry is a pin-quality correction path, not a way to preserve old broad search coordinates at all costs. Preview first and expect raw coordinate count to decrease if a future batch finds non-promoting results.

Recent verified public-pin apply checkpoints:

- `reports/location-backlog/2026-04-21-round25.{json,md}`: round 25 backlog snapshot after the Alcaidesa Marina + D-Marin Didim Marina alias apply. 275 public pins, verdict remains `NO_GO_KEEP_PUBLIC_MAP_DISABLED`. Same deferred debt as Round 24 plus Round 25 probe results: Empuriabrava Marina, Ensenada Cruiseport Marina, Fort Pierce City Marina, Liberty Harbor Marina, Felixstowe Ferry Boatyard, Cathedral Bluffs Yacht Club, and Etobicoke Yacht Club (bare query returns a different yacht club — unsafe).
- `boat_geocode_backup_20260421213442`: 2-row round 25 verified-alias batch applied with `PUBLIC_MAP_ENABLED=false`; 1 `Alcaidesa Marina In Spain Near Gibraltar` row canonicalized to `Alcaidesa Marina, La Línea de la Concepción, Spain` and 1 `Didim Marina, Turkey` row canonicalized to `D-Marin Didim Marina, Didim, Turkey`; each geocoded to facility coords at `precision=marina`, `score=1`. 2/2 marina pins, 0 held back, 0 failed, 0 geography mismatches, 0 warnings, an empty follow-up verified-alias lane, 2/2 backup-scoped audit, and `/api/boats/map` still returning 404 while disabled. Alcaidesa is the second consumer of the Round 23 `providerCountryCodes` widening (after Green Cay Marina) because the facility is country=es-tagged while the row is country=gi-tagged.
- `reports/location-backlog/2026-04-21-round24.{json,md}`: round 24 backlog snapshot after the Toronto Island Marina alias apply. 273 public pins, verdict remains `NO_GO_KEEP_PUBLIC_MAP_DISABLED`. Red Frog Marina (Panama), Pembroke Dock (UK), Tollesbury Marina (UK), and Sune Carlsson Boatyard (Sweden) each probed without facility-grade OpenCage evidence and remain deferred; plain Chatham Marina, Chatham/River Medway, Dover Marina, Marina Anse Marcel, Marina Del Rey, and the 2 Palm Cay Marina city-precision rows also remain deferred.
- `boat_geocode_backup_20260421194136`: 2-row round 24 Toronto Island Marina verified-alias batch applied with `PUBLIC_MAP_ENABLED=false`; both pending bare `Toronto Island Marina` rows were canonicalized to `Toronto Island Marina, Toronto, Ontario, Canada` and geocoded to `Toronto Island Marina, Island Park Trail, Toronto, ON M5J 2E9, Canada`, `precision=marina`, `score=1`. The batch had 2/2 marina pins, 0 held back, 0 failed, 0 geography mismatches, 0 warnings, an empty follow-up verified-alias lane, a 2/2 backup-scoped audit, and `/api/boats/map` still returned 404 while disabled. Round 24 also folded a non-blocking wrong-country anchor regression test (`green cay marina` with a BVI-tagged near-duplicate must fail the anchor country check) from Round 23 gate #2.
- `reports/location-backlog/2026-04-21-round23.{json,md}`: round 23 backlog snapshot after the Green Cay Marina alias apply. 271 public pins, verdict remains `NO_GO_KEEP_PUBLIC_MAP_DISABLED`. The report still recommends `gazetteer_first`; deferred clusters Marina Anse Marcel (water-only), Marina Del Rey (district-only), Dover Marina (pier/road), and plain Chatham Marina without country each need new provider evidence before any public-pin apply.
- `boat_geocode_backup_20260421174140`: 4-row round 23 Green Cay Marina verified-alias batch applied with `PUBLIC_MAP_ENABLED=false`; 3 reviewed `Green Cay Marina St. Croix` / `Green Cay Marina, Virgin Islands (US) (USVI)` rows and 1 `Green Cay Marina, Virgin Islands (US) (USVI)` row were canonicalized to `Green Cay Marina, Christiansted, US Virgin Islands` and geocoded to `Green Cay Marina, 5000 Southgate Estate, Shoys, Christiansted, VI 00820, United States of America`, `precision=marina`, `score=1`. The batch had 4/4 marina pins, 0 held back, 0 failed, 0 geography mismatches, 0 warnings, an empty follow-up verified-alias lane, a 4/4 backup-scoped audit, and `/api/boats/map` still returned 404 while disabled. Round 23 also introduced narrow provider-side country-filter widening (`GeocodeQuery.providerCountryCodes`) that only populates for multi-country aliases (`lagoon marina`, `green cay marina`); non-alias queries and single-country aliases continue to pass the single `countryHint` to OpenCage.
- `reports/location-backlog/2026-04-21-round22.{json,md}`: round 22 backlog snapshot after the Chatham alias apply. It found 12,670 active visible rows, 267 public pins, 371 public-pin-likely rows, 0 country-hint mismatches, 6,466 `needs_more_specific_location` rows, 2,965 pending-ready rows, 2,061 unknown-location rows, 542 held-back coordinate rows, and 369 review rows. The report still recommends `gazetteer_first`; public map launch remains blocked by low coverage, pending-ready volume, review/failed volume, regional coverage, and missing golden accuracy.
- `boat_geocode_backup_20260421152318`: 4-row round 22 verified-alias batch applied with `PUBLIC_MAP_ENABLED=false`; exact `Chatham Marina, Kent` and `Chatham Marina, Chatham Kent` reviewed rows were geocoded to `MDL Chatham Maritime Marina Boatyard, Chatham, Medway, England, United Kingdom`, `precision=marina`, `score=1`. The plain pending `Chatham Marina` row with no country stayed unselected. The batch had 4/4 marina pins, 0 held back, 0 failed, 0 geography mismatches, 0 warnings, an empty follow-up verified-alias lane, a 4/4 backup-scoped audit, and `/api/boats/map` still returned 404 while disabled.
- `reports/location-backlog/2026-04-21-round20.{json,md}`: round 20 backlog snapshot after the Linton Bay Marina apply and Lagoon cache-backed repair. It found 12,666 active visible rows, 263 public pins, 371 public-pin-likely rows, 0 country-hint mismatches, 6,466 `needs_more_specific_location` rows, 2,993 pending-ready rows, 2,061 unknown-location rows, 510 held-back coordinate rows, and 373 review rows. The report still recommends `cleanup_first`; public map launch remains blocked by low coverage and nonzero review/failed geocodes.
- `boat_geocode_backup_20260421133028`: 3-row round 20 verified-alias batch applied with `PUBLIC_MAP_ENABLED=false`; 2 Linton Bay Marina rows were geocoded to `Linton Bay Marina, Carretera Portobelo - La Guaira, Puerto Lindo, Colón, Panama`, and 1 existing Lagoon Marina row was released from the verified cache. The batch had 3/3 marina pins, 0 held back, 0 failed, 0 geography mismatches, and 0 warnings.
- `boat_location_market_backup_round20_202604211333` and `boat_location_market_rollback_backup_round20_202604211343`: a Cole Bay/Sint Maarten metadata correction was attempted after the first apply, then rolled back before commit. The required preview showed `Lagoon Marina Cole Bay, Sint Maarten` resolving to broad `Cole Bay, Sint Maarten` at city precision rather than the Lagoon Marina facility, so the metadata shortcut was rejected.
- `boat_geocode_backup_20260421134416`: targeted 2-row Lagoon repair after the rollback. The run used explicit `--boat-id` filters, made 0 provider calls, wrote 2 cached `Lagoon Marina, Wellington Road, Cul-de-Sac, Sint Maarten` marina pins, found 0 held back, 0 failed, 0 geography mismatches, and 0 warnings, and the backup-scoped audit returned 2/2 eligible pins. Follow-up verified-alias lane selected 0 rows, public pins returned to 263, active-visible public coverage reached 2.08%, raw coordinates returned to 773, held-back coordinates stayed 510, and readiness remains `NO_GO_KEEP_PUBLIC_MAP_DISABLED`.
- `reports/location-backlog/2026-04-21-round19.{json,md}`: round 19 backlog snapshot after the Marina Baotić apply. It found 12,666 active visible rows, 260 public pins, 371 public-pin-likely rows, 0 country-hint mismatches, 6,466 `needs_more_specific_location` rows, 2,993 pending-ready rows, 2,064 unknown-location rows, 510 held-back coordinate rows, and 373 review rows. The Yachtclub Seget / Marina Baotić gazetteer cluster is no longer in the candidate queue; next public-pin-shaped work starts with smaller gazetteer clusters like Marina Anse Marcel, Marina Del Rey, Chatham Marina, Dover Marina, and Green Cay Marina.
- `boat_geocode_backup_20260421125714`: 12-row round 19 Marina Baotić verified-alias batch applied with `PUBLIC_MAP_ENABLED=false`; 8 existing Trogir city coordinates and 4 review rows were promoted to marina-grade OpenCage pins, 0 held back, 0 failed, 0 geography mismatches, 0 warnings, and 12/12 backup-scoped map-pin audit rows eligible. Follow-up verified-alias changed-geocoded lane selected 0 rows, public pins increased to 260, active-visible public coverage increased to 2.05%, raw coordinates increased to 770, held-back coordinates decreased to 510, and country-hint mismatches remained 0. Readiness remains `NO_GO_KEEP_PUBLIC_MAP_DISABLED`.
- `reports/location-backlog/2026-04-21-round18.{json,md}`: round 18 backlog snapshot after the changed-review cleanup apply. It found 12,666 active visible rows, 248 public pins, 371 public-pin-likely rows, 0 country-hint mismatches, 6,466 `needs_more_specific_location` rows, 2,993 pending-ready rows, 2,064 unknown-location rows, 518 held-back coordinate rows, and 377 review rows. The report still recommends cleanup-first because raw source text remains dirty in pending/unfixable rows even though the current round fixed only the safe reviewed-row geocode query lane.
- `reports/location-backlog/2026-04-21-round17.{json,md}`: first round 17 backlog snapshot after the verified-alias rollout. It found 12,666 active visible rows, 248 public pins, 6,462 `needs_more_specific_location` rows, 2,997 pending-ready rows, 2,064 unknown-location rows, 513 held-back coordinate rows, and 382 review rows. The report ranked deterministic cleanup first (`Aan Verkoopsteiger In`, Saint Martin/Sint Maarten variants, misspellings, lake-context, and directional fragments) and identified gazetteer candidates including Yachtclub Seget / Marina Baotic, Marina Anse Marcel, Marina Del Rey, Chatham Marina, Dover Marina, and Green Cay Marina.
- `boat_geocode_backup_20260421112827`: 23-row round 16 reviewed-alias retry batch applied with `PUBLIC_MAP_ENABLED=false`; 23 cached rows wrote marina-grade pins, 0 held back, 0 failed, 0 geography mismatches, 0 warnings, and 23 precision promotions from cached city/unknown precision to verified alias marina precision. Backup-scoped map-pin audit returned 23/23 eligible pins, follow-up verified-alias lane selected 0 rows, public pins increased to 248, active-visible public coverage increased to 1.97%, raw coordinates increased to 761, and country-hint mismatches remained 0. Readiness remains `NO_GO_KEEP_PUBLIC_MAP_DISABLED`.
- `boat_geocode_backup_20260421111221`: 13-row round 15 verified-alias public-pin candidate batch applied with `PUBLIC_MAP_ENABLED=false`; 13 Burnham Yacht Harbour rows wrote marina-grade OpenCage pins, 0 held back, 0 failed, 0 geography mismatches, and 0 warnings. Backup-scoped map-pin audit returned 13/13 eligible pins. Follow-up public-pin candidate lane selected 0 rows, readiness remains `NO_GO_KEEP_PUBLIC_MAP_DISABLED`, public pins increased to 225, active-visible public coverage increased to 1.79%, raw coordinates increased to 738, and country-hint mismatches remained 0.
- `boat_geocode_backup_20260421103145`: 11-row round 12 cache-only public-pin candidate batch applied with `PUBLIC_MAP_ENABLED=false`; 10 marina-grade public pins written from already cached Nanny Cay and Port Pin Rolland results, 1 Dover Marina city-level result held in review with null coordinates, 0 provider calls, 0 failed, 0 geography mismatches, and 0 warnings. Follow-up map-pin audit returned 10/10 eligible pins at marina precision, the public-pin candidate lane selected 0 rows after apply, and `/api/boats/map` returned 404 while disabled. Readiness remains `NO_GO_KEEP_PUBLIC_MAP_DISABLED`; public pins increased to 212, public coverage is 1.68%, and raw coordinates increased to 712.
- `boat_geocode_backup_20260421034834`: 43-row round 6 targeted changed-review batch applied with `PUBLIC_MAP_ENABLED=false`; 26 marina-grade public pins written, 17 city/region/country/unknown results held in review with null coordinates, 0 failed, 0 geography mismatches, 0 broad public coordinates. Follow-up map-pin audit returned 25/25 sampled pins at marina precision, the targeted retry lane selected 0 rows after apply, and backfill preflight returned GO. Readiness remains `NO_GO_KEEP_PUBLIC_MAP_DISABLED`; public pins increased to 185 and active-visible public coverage is 1.47%.
- `boat_geocode_backup_20260421032519`: 91-row round 5 public-pin batch applied with `PUBLIC_MAP_ENABLED=false`; 57 marina-grade public pins written, 34 broad/review results held with null coordinates, 0 failed, 0 geography mismatches, 0 broad public coordinates. Follow-up map-pin audit returned 25/25 sampled pins at marina precision, post-apply rerun selected 0 rows and made 0 provider calls, and backfill preflight returned GO with OpenCage configured. Readiness remains `NO_GO_KEEP_PUBLIC_MAP_DISABLED` while total public-pin coverage is still below launch thresholds.
- `boat_geocode_backup_20260421025357`: 25-row round 4 public-pin batch applied with `PUBLIC_MAP_ENABLED=false`; 18 marina/street/exact public pins written, 7 city/country results held in review with null coordinates, 0 failed, 0 geography mismatches, 0 broad public coordinates. Follow-up map-pin audit returned 18/18 eligible pins and backfill preflight returned GO with OpenCage configured.

Recent verified search-coverage apply checkpoints:

- `boat_geocode_backup_20260421214859`: 100-row Round 26 default search-coverage batch applied with `PUBLIC_MAP_ENABLED=false`; 80 rows geocoded (89 city + 1 marina-grade via verified alias match + 6 region), 20 held in review (16 low_confidence + 4 low_precision), 0 failed, 0 geography mismatches, 0 warnings. The one marina-grade promotion came from an already-aliased row surfacing through the default lane — not a new alias. `/api/boats/map` still 404. Readiness deltas: publicPinCount 275→276, rawCoordinateCount 817→897, pendingReadyCount 3001→2901, pendingReadyRate 23.62%→22.83% (target <10%, so ~15-20 more batches of this size to close the gate).
- `boat_geocode_backup_20260421215651`: 250-row Round 27 default search-coverage batch (requested 500 but script capped at 250 via internal query-diversity guard) with `PUBLIC_MAP_ENABLED=false`; 155 rows geocoded (192 city + 1 marina + 51 region + 6 unknown), 95 held in review (88 low_confidence + 4 low_precision + 2 no_result + 1 degenerate_query), 0 failed, 0 geography mismatches, 0 warnings. Readiness: publicPinCount 276→277, rawCoordinateCount 897→1052, pendingReadyCount 2901→2651, pendingReadyRate 22.83%→20.86%. Note: `review_failed_rate` climbs on search-coverage batches (29.98%→31.29%) because rows that fail confidence/precision gates move from pending to review; bringing that gate down separately requires source-cleanup rules or manual triage on the top review clusters (Athens Greece, Marmaris, Le Marin, Preveza, Šibenik).
- `boat_geocode_backup_20260421220148`, `..._20260421220226`, `..._20260421220305`: three consecutive 250-row Round 28 default search-coverage batches with `PUBLIC_MAP_ENABLED=false`. Aggregate: 472 rows geocoded (net coord writes), 278 held in review, 0 failed, 0 geography mismatches, 0 warnings. Readiness deltas: publicPinCount 277→278, rawCoordinateCount 1052→1523, pendingReadyCount 2651→1901, pendingReadyRate 20.86%→15.09%. **Round 28 also caught and fixed a classifier bug**: the `Tortola, Nanny Cay, British Virgin Islands` query resolved to `_type=island`, `_category=natural/water` but was being promoted to `marina` precision because both query and result contained `nanny cay` (a `STATIC_KNOWN_MARINA_NAME_TERMS` entry), tripping the `public_admin_boundary_zero` readiness invariant (0→1). The offending row (boat `1358b7c2-ab13-422e-a498-28b8e218f159`) was rolled back via its pre-batch backup snapshot (restored to pending status). The code fix adds a guard in `resultAndQueryHaveKnownMarinaName`: if the result `_type` is in `ADMIN_REGION_ADDRESS_TYPES` (state/region/province/county/island) or is `country`/`continent`, the function returns false and does not promote to marina precision. All existing legitimate marina pins are on facility-shaped types (`marina`/`boatyard`/`basin`/`pier`/named-water-component) and are unaffected by the guard; 23 existing Nanny Cay pins all sit on `_type=marina, _category=outdoors/recreation` which the guard continues to accept.
- `boat_geocode_backup_20260421221405`, `..._20260421221515`, `..._20260421221605`: three consecutive 250-row Round 29 default search-coverage batches with `PUBLIC_MAP_ENABLED=false`. Aggregate: 431 rows geocoded, 319 held in review, 0 failed, 0 geography mismatches, 0 warnings. Readiness deltas: publicPinCount 278→280 (net, after Round-29 cleanup below), rawCoordinateCount 1523→1952, pendingReadyCount 1901→1170, **pendingReadyRate 15.09%→9.21% — GATE PASSED** (target <10%). **Round 29 also caught a cache-poisoning case**: the Round 28 classifier fix prevented NEW bad classifications, but the already-cached bad entry from Round 28 Batch 2 (`query_key=tortola nanny cay british virgin islands`, cached at `precision=marina` with `_type=island`) kept serving marina-precision hits for any new row with the same query, re-promoting 2 Tortola rows (`1358b7c2` and `03fc4c20`) that ran through Round 29 Batch 1. Remediation: (a) backed up and deleted the one bad cache entry (`location_geocode_cache_r29_fix_backup` keeps the snapshot), (b) rolled both boat rows back to pending via `boat_geocode_backup_20260421221405`, (c) verified with a fresh `--fetch-missing` preview that the Round 28 classifier guard now correctly holds the result at `region` precision. Post-cleanup verify: all 5 public-pin invariants back to 0, pending_ready_rate gate still passing at 9.21%. **Lesson: after any classifier bug fix, scan `location_geocode_cache` for pre-fix entries with public-grade precision on admin-boundary `_type` values; delete those entries so future rows re-classify via the corrected code.**
- `boat_geocode_backup_20260421222917`: Round 30 stale-cache cleanup + `--include-review` batch with `PUBLIC_MAP_ENABLED=false`. Target: 17 cache entries that pre-dated the Round 21 `exact City, Country` confidence-3 exception and were therefore stored as `status=review, error=low_confidence` despite now qualifying for search-only promotion. Backed up the snapshot to `location_geocode_cache_r30_stale_review_backup` (17 rows) then deleted those entries and ran `--include-review --limit=500` to pull affected boats. Aggregate: 250 rows selected, 43 geocoded (city-precision search coverage), 207 held in review (conf=2 rows or other failure modes not addressed by this fix), 0 failed, 0 geography mismatches, 0 warnings. Readiness deltas: publicPinCount unchanged at 280, **review_failed_rate 35.54%→34.16%** (small improvement; the 207 re-held rows re-wrote their cache entries, so subsequent runs won't re-fetch them). Broader review_failed_rate progress requires targeting the conf=2 low_confidence cluster (Bodrum, Marmaris, Corfu) which would need either source-cleanup rules canonicalizing to known-good queries, or a policy decision on the confidence floor itself.
- `boat_geocode_backup_20260421223505`, `..._20260421223528`: two consecutive Round 31 `--include-review --limit=500 --apply` batches with `PUBLIC_MAP_ENABLED=false`. Aggregate: 500 rows selected, 12 geocoded (5 batch-1 + 7 batch-2… actually 11+1), 488 held in review, 0 failed, 0 geography mismatches, 0 warnings. Readiness deltas: publicPinCount unchanged at 280, rawCoordinateCount 1952→2007, review_failed_rate 34.16%→33.76%. **Round 31 demonstrates that `--include-review` has hit diminishing returns**: after Round 30 cleaned the conf=3 low-hanging fruit, subsequent batches only pull in the conf=2 stuck rows (Bodrum/Marmaris/Corfu) and no-result queries that the classifier correctly refuses to promote. Additional review_failed_rate progress requires EITHER (a) per-cluster source-cleanup rules for specific dirty-text patterns (slow, custom per cluster), (b) a policy decision on confidence floor (would need a separate consensus gate), OR (c) manual seller-facing source-text enrichment (out of scope for automated work).


- `boat_geocode_backup_20260421141932`: 32-row round 21 Dutch Lelystad cleanup batch applied with `PUBLIC_MAP_ENABLED=false`; 31 `Aan Verkoopsteiger In Lelystad` rows and 1 `Aaan Verkoopsteiger In Lelystad` row collapsed to one OpenCage query, `Lelystad, Netherlands`. The first preview correctly stopped when OpenCage returned city precision at confidence 3 as `review/low_confidence`; consensus then added a test-backed exact `City, Country` confidence-3 acceptance path for search-only city coordinates while preserving county, region, street, POI, marina, country-mismatch, and confidence-below-3 review guards. This path is a closed search-coverage exception, not a public-pin shortcut; do not extend it to marina/street/exact pin work. The final preview/apply made 1 provider call with 31 in-memory cache reuses, wrote 32 city search-only coordinates at `Lelystad, Flevoland, Netherlands`, found 0 failed rows, 0 review rows, 0 geography mismatches, 0 public-pin promotions, and 0 warnings. Readiness remains `NO_GO_KEEP_PUBLIC_MAP_DISABLED`; public pins stayed at 263, raw coordinates increased to 805, held-back coordinates increased to 542, city coordinates increased to 444, pending-ready rows dropped to 2,961, review rows stayed at 373, country-hint mismatches stayed at 0, and `/api/boats/map` still returns 404 while disabled. `reports/location-backlog/2026-04-21-round21.{json,md}` now recommends `gazetteer_first`; the backlog report also no longer re-ranks already geocoded search-only rows as source-cleanup work.
- `boat_geocode_backup_20260421123258`: 6-row round 18 changed-review cleanup batch applied with `PUBLIC_MAP_ENABLED=false`; 5 city search-only coordinates were written for cleaned Dutch, Canadian Lake Huron/Osoyoos, Canary Islands, and Sardinia queries, 1 low-confidence Georgetown Exuma Bahamas region result stayed in review with null coordinates, 0 failed rows, 0 geography mismatches, and 0 public-grade pins were created. The post-apply changed-review lane selected 0 rows, readiness remains `NO_GO_KEEP_PUBLIC_MAP_DISABLED`, public pins stayed at 248, raw coordinates increased to 766, held-back coordinates increased to 518, and `/api/boats/map` returned 404 while disabled.
- `boat_geocode_backup_20260421104607`: 25-row round 13 default search-coverage batch applied with `PUBLIC_MAP_ENABLED=false`; 13 city search-only coordinates written, 12 review rows held with null coordinates, 0 failed, 0 geography mismatches, and 0 public-grade pins created. New quality guards held the previously accepted `West, Greece` to hotel result as `directional_fragment_poi` and the `Argentario, Italy` to inland Trento result as `ambiguous_coastal_name`; the accepted city rows remained geocoded. Readiness remains `NO_GO_KEEP_PUBLIC_MAP_DISABLED`; public pins stayed at 212, raw coordinates increased to 725, held-back coordinates increased to 513, and `/api/boats/map` returned 404 while disabled.
- `boat_geocode_backup_20260421101809`: 62-row round 11 changed-review batch applied with `PUBLIC_MAP_ENABLED=false`; 41 rows geocoded, 21 rows held in review, 0 failed, 0 geography mismatches, and 12 marina-grade public pins written from recurring Nanny Cay, Marina du Marin, Marmaris Yacht Marina, Port Tino Rossi, and Port Pin Rolland source text. Follow-up `boat_geocode_backup_20260421102124` released 2 additional Nanny Cay marina pins from cache with 0 provider calls. The targeted retry lane selected 0 rows after apply. Readiness remains `NO_GO_KEEP_PUBLIC_MAP_DISABLED`; public pins increased to 202 and raw coordinates increased to 702.
- `boat_geocode_backup_20260421093615`: 100-row round 10 default search-coverage batch applied with `PUBLIC_MAP_ENABLED=false`; 45 rows geocoded, 55 rows held in review, 0 failed, 0 geography mismatches, 0 invalid coordinates, and 0 review rows with coordinates. The batch wrote 44 city/region search-only coordinates plus one verified duplicate `Spice Island Marine, Grenada` street-grade coordinate (`17e67f38-1059-467e-83f4-51aacf596b32`, `1991-beneteau-oceanis-440-spice-island-marine`). New quality guards held 3 `S, France` degenerate-query rows and 1 `Ionian Sea, Greece` waterbody-to-hotel false positive in review. Follow-up quality sweep used `boat_geocode_quality_backup_20260421094111` to downgrade 2 older `S, France` rows from geocoded to review and clear their stale coordinates. Readiness remains `NO_GO_KEEP_PUBLIC_MAP_DISABLED`; public pins increased to 188, raw coordinates increased to 659, and country-hint mismatches remained `0`.
- `boat_geocode_backup_20260421090823`: 100-row round 9 default search-coverage batch applied with `PUBLIC_MAP_ENABLED=false`; 76 rows geocoded, 24 low-confidence/low-precision/no-result rows held in review with null coordinates, 0 failed, 0 geography mismatches, 0 invalid coordinates, and 0 rows missing geocode metadata. The batch wrote 75 city/region/country search-only coordinates plus one legitimate street-grade `Spice Island Marine, Grenada` coordinate (`083a7281-ba96-464c-bc61-783d47ac7f73`, `1982-morgan-41-spice-island-marine`) that must remain explicitly reviewed before any public map launch. Public map flags remained false and readiness remained `NO_GO_KEEP_PUBLIC_MAP_DISABLED`; country-hint mismatches remained `0`.
- `boat_geocode_backup_20260421085953`: 100-row round 8 default search-coverage batch applied with `PUBLIC_MAP_ENABLED=false`; 60 rows geocoded, 40 low-confidence/low-precision/no-result rows held in review with null coordinates, 0 failed, 0 geography mismatches, 0 invalid coordinates, and 0 rows missing geocode metadata. The batch wrote 59 city/region/country search-only coordinates plus one legitimate marina-grade `Ventura Harbor, California` coordinate (`fb8e7fbb-be5a-44a9-8cf1-30400f9d7cd4`, `2007-catalina-250-wing-keel-ventura-harbor`) that must remain explicitly reviewed before any public map launch. Public map flags remained false and readiness remained `NO_GO_KEEP_PUBLIC_MAP_DISABLED`.
- `boat_geocode_backup_20260421035740`: 100-row round 7 default search-coverage batch applied with `PUBLIC_MAP_ENABLED=false`; 63 city/region/country search-only coordinates written, 37 low-confidence/low-precision rows held in review with null coordinates, 0 failed, 0 geography mismatches, 0 public-grade pins created, 0 invalid coordinates, and 0 rows missing geocode metadata. Readiness remains `NO_GO_KEEP_PUBLIC_MAP_DISABLED`; public pins stayed at 185 while raw coordinates increased to 494.

Recent verified location-market hygiene checkpoints:

- `boat_location_market_backup_usvi_20260421090257`: 4-row USVI metadata correction applied after round 8 readiness surfaced country-hint mismatches. Updated only `location_country`, `location_region`, `location_market_slugs`, `location_confidence`, and `location_approximate` for explicit USVI rows; coordinates and geocode provider payloads were byte-identical to the backup after update. Follow-up readiness returned country-hint mismatches `0`.

## Rollback

Every apply batch creates a `boat_geocode_backup_<timestamp>` table before writing. Keep those tables until the batch has passed the sample-pin audit and readiness report. New backup tables include `slug` for audit convenience only, but rollback remains keyed on immutable `id`; backup tables created before the round 21 follow-up may not have `slug`, so join those older tables back to `boats` on `id` for slug-based inspection.

Latest round-specific rollback reference: round 25 Alcaidesa Marina + D-Marin Didim Marina used `boat_geocode_backup_20260421213442`. Round 24 Toronto Island Marina used `boat_geocode_backup_20260421194136`. Round 23 Green Cay Marina used `boat_geocode_backup_20260421174140`. Round 22 Chatham Marina used `boat_geocode_backup_20260421152318`. Round 20 Linton Bay Marina used `boat_geocode_backup_20260421133028`; the follow-up Lagoon cache-backed repair used `boat_geocode_backup_20260421134416`. The rejected Cole Bay metadata experiment can be inspected through `boat_location_market_backup_round20_202604211333` and `boat_location_market_rollback_backup_round20_202604211343`.

To roll back one batch, replace `<backup_table>` with the backup table name printed by the script:

```sql
BEGIN;

UPDATE boats b
SET location_lat = backup.location_lat,
    location_lng = backup.location_lng,
    location_country = backup.location_country,
    location_region = backup.location_region,
    location_market_slugs = backup.location_market_slugs,
    location_confidence = backup.location_confidence,
    location_approximate = backup.location_approximate,
    location_geocoded_at = backup.location_geocoded_at,
    location_geocode_status = backup.location_geocode_status,
    location_geocode_provider = backup.location_geocode_provider,
    location_geocode_query = backup.location_geocode_query,
    location_geocode_place_name = backup.location_geocode_place_name,
    location_geocode_precision = backup.location_geocode_precision,
    location_geocode_score = backup.location_geocode_score,
    location_geocode_error = backup.location_geocode_error,
    location_geocode_attempted_at = backup.location_geocode_attempted_at,
    location_geocode_payload = backup.location_geocode_payload,
    updated_at = NOW()
FROM <backup_table> backup
WHERE b.id = backup.id;

COMMIT;
```

After rollback, rerun `npm run db:geocode-readiness` and `npm run db:geocode-review`.

## Public Map Gate

Do not enable `PUBLIC_MAP_ENABLED=true` from this runbook. Public map launch is a separate release decision after:

- readiness gates are green;
- country-hint mismatches are zero;
- review/failed geocodes are below thresholds;
- exact/street/marina public-pin coverage is high enough for the buyer experience;
- tile style, attribution, rate limits, and map UI have been reviewed together.
