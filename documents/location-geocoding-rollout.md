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
- Production one-off location text cleanup has rollback snapshots in `boat_location_text_cleanup_backup_20260421014841`, `boat_location_text_cleanup_backup_20260421020349`, and `boat_location_text_cleanup_backup_20260421022049`.
- Do not normalize `Green Cay Marina`, `St. Thomas Yacht Club`, `Puerto Bahia Marina`, broad `Clarke's Court` rows without the exact boatyard/marina phrase, `Riva Di Traiano`, `Villanova Marina`, `Marina Frapa`, `BVI Yacht Charter Docks`, `Marina Di Ragusa`, `Sune Carlsson Boatyard`, `Red Frog Marina`, `Pankor/Pangkor Marina`, `Ocean Marina Pattaya`, `Wiarton/Wiatron Marina`, `Marina Del Ray Orillia`, `Marina Riviera Nayarit`, `Marina Guaymas`, `Rio Dulce Marina`, `Swanwick Marina`, `Marina De L'Anse Marcel`, `Palm Cay Marina`, `Yachtclub Seget Marina Baotic`, `D-Marin Lefkas`, `Conwy Marina`, `Chichester Marina`, `Dover Marina`, `Chatham Marina`, `Medway Yacht Club`, `Port Solent Marina`, `Shotley Marina`, `Lagoon Marina Cole Bay`, `Carlyle West Access Marina`, `Shores Of Leech Lake Marina`, `Tollesbury Marina`, `Deko Marina`, `Carrickfergus Harbour Marina`, `Roses, Empuriabrava Marina`, `Northshore Shipyard, Chichester`, or `Pembroke Dock, Pembrokeshire` yet. Current provider previews still return city/review/unknown precision for those rows, so they need provider/policy review before public pins.

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

Recent verified public-pin apply checkpoints:

- `boat_geocode_backup_20260421034834`: 43-row round 6 targeted changed-review batch applied with `PUBLIC_MAP_ENABLED=false`; 26 marina-grade public pins written, 17 city/region/country/unknown results held in review with null coordinates, 0 failed, 0 geography mismatches, 0 broad public coordinates. Follow-up map-pin audit returned 25/25 sampled pins at marina precision, the targeted retry lane selected 0 rows after apply, and backfill preflight returned GO. Readiness remains `NO_GO_KEEP_PUBLIC_MAP_DISABLED`; public pins increased to 185 and active-visible public coverage is 1.47%.
- `boat_geocode_backup_20260421032519`: 91-row round 5 public-pin batch applied with `PUBLIC_MAP_ENABLED=false`; 57 marina-grade public pins written, 34 broad/review results held with null coordinates, 0 failed, 0 geography mismatches, 0 broad public coordinates. Follow-up map-pin audit returned 25/25 sampled pins at marina precision, post-apply rerun selected 0 rows and made 0 provider calls, and backfill preflight returned GO with OpenCage configured. Readiness remains `NO_GO_KEEP_PUBLIC_MAP_DISABLED` while total public-pin coverage is still below launch thresholds.
- `boat_geocode_backup_20260421025357`: 25-row round 4 public-pin batch applied with `PUBLIC_MAP_ENABLED=false`; 18 marina/street/exact public pins written, 7 city/country results held in review with null coordinates, 0 failed, 0 geography mismatches, 0 broad public coordinates. Follow-up map-pin audit returned 18/18 eligible pins and backfill preflight returned GO with OpenCage configured.

Recent verified search-coverage apply checkpoints:

- `boat_geocode_backup_20260421035740`: 100-row round 7 default search-coverage batch applied with `PUBLIC_MAP_ENABLED=false`; 63 city/region/country search-only coordinates written, 37 low-confidence/low-precision rows held in review with null coordinates, 0 failed, 0 geography mismatches, 0 public-grade pins created, 0 invalid coordinates, and 0 rows missing geocode metadata. Readiness remains `NO_GO_KEEP_PUBLIC_MAP_DISABLED`; public pins stayed at 185 while raw coordinates increased to 494.

## Rollback

Every apply batch creates a `boat_geocode_backup_<timestamp>` table before writing. Keep those tables until the batch has passed the sample-pin audit and readiness report.

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
