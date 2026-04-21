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
MAP_STYLE_PING_REFERER=https://onlyhulls.com/boats
MAP_READINESS_MIN_MARKET_TAG_PCT=95
MAP_READINESS_MIN_CITY_OR_BETTER_PCT=85
MAP_READINESS_MIN_PUBLIC_PIN_PCT=85
MAP_READINESS_MIN_NON_APPROX_PUBLIC_PIN_PCT=50
MAP_READINESS_MAX_REVIEW_FAILED_PCT=0
MAP_READINESS_STALE_PIN_DAYS=90
MAP_READINESS_MIN_PIN_SCORE=0.6
```

Notes:

- `PUBLIC_MAP_ENABLED` gates the server marker API.
- `NEXT_PUBLIC_MAP_ENABLED` gates the buyer-facing Map button.
- Flip both flags together. If only the client flag is enabled, the UI appears but the marker API returns `404`. If only the server flag is enabled, the API exists but buyers cannot open the map.
- The MapTiler key is URL-embedded and public by design. Restrict it in the MapTiler dashboard to `https://onlyhulls.com/*` and `https://www.onlyhulls.com/*`.
- Launch preflight sends a browser-realistic `Referer` for the MapTiler style ping. Keep `MAP_STYLE_PING_REFERER` on an OnlyHulls HTTPS URL, or add staging hosts through `MAP_STYLE_PING_ALLOWED_HOSTS` only when staging truly needs its own referrer.
- Keep a budget/session cap on the MapTiler account at launch. Prefer graceful map unavailability over surprise overage until real map usage is known.
- Do not add wildcard CSP origins. Add explicit hosts to `NEXT_PUBLIC_MAP_RESOURCE_ORIGINS`.
- Use `/admin/map-readiness` as the aggregate launch gate before enabling the public flags. It intentionally reports counts, percentages, precision/status/provider splits, and blockers without exposing coordinates, listing IDs, user IDs, or slugs.

## Staging Checklist

Use `--phase=launch` for every public-map exposure decision. `--phase=backfill` is only for coordinate-write readiness while the public map stays off.

1. `npm run db:map-launch-preflight -- --phase=launch --ping --pin-audit-report=artifacts/map-pin-audit-launch.json` returns `GO` against the intended staging/production database and configured providers.
2. OpenCage backfill coverage and `/admin/map-readiness` gates are green.
3. Admin Source Health and `db:map-launch-preflight` explain the imported-inventory waterfall: active imported, quality pass, fresh pass, buyer visible, stale-source held, and policy held. This is a hard launch gate. Do not launch the map over a missing waterfall, an empty buyer-visible inventory, or a collapsed visible-inventory rate below 20%.
4. Public-pin invariants are clean: zero invalid public coordinates, zero public pins missing provider/score/geocoded-at metadata, zero stale public coordinates, and zero low-score public pins.
5. A fresh zero-rejection `npm run db:map-pin-audit -- --limit=25 --seed=launch-review --attest --reviewed-by=<operator> --accepted=25 --rejected=0 --emit-report=artifacts/map-pin-audit-launch.json` sample has been reviewed.
6. MapTiler key is referrer-restricted to staging and production domains.
7. MapTiler budget/session cap is configured.
8. `MAP_STYLE_PING_REFERER` returns `200` from MapTiler while the same style URL without a referrer returns `403`, proving the key is restricted and preflight is checking the browser path.
9. Staging env has `PUBLIC_MAP_ENABLED=true` and `NEXT_PUBLIC_MAP_ENABLED=true`.
10. Staging CSP includes every required style, tile, glyph, sprite, and image origin without using `*`.
11. Browser tests pass with map off, map happy path, 429 response, and broken style response.
12. Manual smoke: search a market, switch to Map, click a marker, open the listing, then switch back to grid/rows.

## Launch Sequence

1. Confirm deploy health is on the intended build.
2. Run `npm run db:map-launch-preflight -- --phase=launch --ping --pin-audit-report=artifacts/map-pin-audit-launch.json` in production and confirm it returns `GO`.
3. Set `PUBLIC_MAP_ENABLED=true`.
4. Set `NEXT_PUBLIC_MAP_ENABLED=true`.
5. Redeploy.
6. Run production smoke tests.
7. Manually verify `/boats?location=puerto-rico`, `/boats?location=florida`, and one non-US market.
8. Watch map request volume, tile-provider usage, API 429s, and CSP reports.

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
- Use `npm run db:location-backlog -- --top=30 --stamp=YYYY-MM-DD-roundN --write` before major cleanup or gazetteer rounds. The backlog report ranks actionable clusters; it is not a launch gate and must not override public-pin invariants.
- During initial map-pin backfill, use `npm run db:geocode-locations -- --limit=25 --public-pin-candidates --fetch-missing` before any apply. The opt-in lane keeps the map rollout focused on marina, yacht club, boatyard, shipyard, dock, quay, darsena, `port de plaisance`, and similar marine-specific rows while the default lane remains available for broader search coverage. Only `exact`, `street`, and `marina` results can promote to public-pin coordinates; city, region, country, and unknown results are cached/audited but held back. Do not apply a public-pin batch below `publicPinEligibleRate=0.6`.
- Marine POI results must not promote to `marina` precision from substring matches alone. Round 14 preview kept `yacht harbour` out of the public-pin lane and hardened classifier behavior so `Suffolk Yacht Harbour` resolving to `Harbourside Kitchen` is held in review, while `Burnham Yacht Harbour` still classifies as a marina when the provider result names the harbour directly.
- Verified public-pin aliases live in `documents/public-pin-aliases.md`; use them only for individually reviewed marine facilities with live provider evidence, nearby negative checks, unit tests, and the normal public-pin apply gate. Current aliases are `burnham yacht harbour`, `conwy marina`, `chichester marina`, `palm cay marina`, `medway yacht club`, `lagoon marina`, and `marina frapa`. Do not add global `yacht harbour`, `yacht harbor`, or broad `marina` matching from this evidence.
- Use `--verified-public-pin-aliases` with `--include-review` for reviewed alias retries. It selects only rows whose current geocode query contains a documented alias and avoids the broader `--public-pin-candidates` review lane, which can pull weak marina-name rows that should stay held back. Alias precision promotion also requires the provider result to match the documented country/coordinate anchor.
- For reviewed rows, use `--retry-changed-review` only with `--include-review`; it excludes pending rows and retries only review/failed rows whose normalized query key changed. Broad `--include-review` retries remain unsafe.
- Current approved cleanup scope is narrow: recurring `Nanny Cay`/`Nanny Cay Boatyard`, `Marina Bas-Du-Fort`, `Hodge's Creek Marina Hotel`, `Camper & Nicholsons Port Louis Marina`, `Zea Marina`, `La Paz, Costa Baja Marina, Americas`, `La Cruz Marina Near Puerto Vallarta`, dirty `Shelter Bay Marina` variants, `Linton Bay Marina Garrote Coln`, `Verkoophaven Delta Marina` and `Schepenkring Delta Marina` variants, `Marina Vaiare`, `Chiapas Marina`, `Puerto Escondido Loreto Marina, BCS`, `Bluffers Park Yacht Club`, `Foxs Marina, Ipswich`, `Penarth Marina Cardiff`, `Greystones Harbour Marina`, `Northern Ireland, Carrickfergus Marina`, `Clarke's Court Boatyard & Marina`, `British Virgin Islands, Hodge's Creek Marina, Caribbean`, `Dubrovnik, Komolac, ACI Marina Dubrovnik`, `Šibenik, Marina Zaton, Mediterranean`, `Kos, Kos Marina, Mediterranean`, `Marsh Harbour, Conch Inn Marina, Bahamas`, `Port Tino Rossi`, `Port Pin Rolland`, `Marmaris Yacht Marine`, `Le Marin Martiniqe`, and `Marina De L'Anse Marcel` source artifacts may canonicalize before geocoding; one-off production text fixes are backed by `boat_location_text_cleanup_backup_20260421014841`, `boat_location_text_cleanup_backup_20260421020349`, and `boat_location_text_cleanup_backup_20260421022049`. Green Cay, St. Thomas Yacht Club, Puerto Bahia, broad Clarke's Court rows, Riva Di Traiano, Villanova, BVI Yacht Charter Docks, Marina Di Ragusa, Sune Carlsson Boatyard, Red Frog Marina, Pankor/Pangkor Marina, Ocean Marina Pattaya, Wiarton/Wiatron Marina, Marina Del Ray Orillia, Marina Riviera Nayarit, Marina Guaymas, Rio Dulce Marina, Swanwick Marina, Yachtclub Seget Marina Baotic, D-Marin Lefkas, Dover Marina, Chatham Marina, Port Solent Marina, Shotley Marina, Carlyle West Access Marina, Shores Of Leech Lake Marina, Tollesbury Marina, Deko Marina, Carrickfergus Harbour Marina, Roses/Empuriabrava Marina, Northshore Shipyard Chichester, and Pembroke Dock remain review items, not public-pin normalization rules. Verified aliases such as Conwy Marina, Chichester Marina, Palm Cay Marina, Medway Yacht Club, Lagoon Marina, and Marina Frapa must stay in the alias lane rather than this cleanup-normalization lane.
- Latest verified public-pin alias checkpoint: `boat_geocode_backup_20260421112827` wrote 23 cached marina-grade alias pins with `PUBLIC_MAP_ENABLED=false`; 0 rows were held back, 0 failed, 0 geography mismatches were found, the backup-scoped pin audit returned 23/23 eligible pins, the verified-alias lane selected 0 rows afterward, public pins increased to 248, and active-visible public coverage increased to 1.97%.
- Latest backlog planning checkpoint: `reports/location-backlog/2026-04-21-round17.{json,md}` ranked the next data work as cleanup-first, with `Aan Verkoopsteiger In` Dutch sales-dock boilerplate, Saint Martin/Sint Maarten variants, misspelled place tokens, lake-context text, and directional fragments as the highest-volume deterministic cleanup candidates. It also identified gazetteer seed candidates such as Yachtclub Seget / Marina Baotic, Marina Anse Marcel, Marina Del Rey, Chatham Marina, Dover Marina, and Green Cay Marina.
- Prior verified public-pin alias checkpoint: `boat_geocode_backup_20260421111221` wrote 13 marina-grade Burnham Yacht Harbour pins with `PUBLIC_MAP_ENABLED=false`; 0 rows were held back, 0 failed, 0 geography mismatches were found, the backup-scoped pin audit returned 13/13 eligible pins, the public-pin candidate lane selected 0 rows afterward, public pins increased to 225, and active-visible public coverage increased to 1.79%.
- Latest verified public-pin apply checkpoint: `boat_geocode_backup_20260421103145` used the cache-only public-pin candidate lane with `PUBLIC_MAP_ENABLED=false`; 10 marina-grade pins were promoted from already cached Nanny Cay and Port Pin Rolland results, one Dover Marina city-level result was held back in review with null coordinates, 0 provider calls were made, 0 failed rows and 0 geography mismatches were found, the follow-up candidate lane selected 0 rows, and `/api/boats/map` still returned 404 while disabled. Readiness remains `NO_GO_KEEP_PUBLIC_MAP_DISABLED`; public pins increased to 212 and public coverage is 1.68%.
- Latest verified changed-review checkpoint: `boat_geocode_backup_20260421101809` wrote 12 marina-grade public pins, 28 city search coordinates, and one region/city/country search-only set while holding 21 review rows with null coordinates; invariant preview/apply found 0 failed rows, 0 geography mismatches, and public map flags stayed false. Follow-up alias cleanup `boat_geocode_backup_20260421102124` released 2 additional Nanny Cay marina pins from cache with 0 provider calls. Readiness remains `NO_GO_KEEP_PUBLIC_MAP_DISABLED`; public pins increased to 202 and the changed-review retry lane selected 0 rows afterward.
- Prior verified public-pin apply checkpoint: `boat_geocode_backup_20260421034834` wrote 26 marina-grade pins and held back 17 broad/review results with null coordinates; invariant audit found 0 failed rows and 0 broad public coordinates, map-pin audit sampled 25/25 marina pins, the targeted retry lane selected 0 rows afterward, and the backfill preflight returned GO with public map flags still false. Readiness remains `NO_GO_KEEP_PUBLIC_MAP_DISABLED` with 185 public pins.
- Latest verified search-coverage checkpoint: `boat_geocode_backup_20260421104607` wrote 13 city search-only coordinates and held 12 review rows with null coordinates; 0 failed rows, 0 public pins, 0 geography mismatches, and public map flags stayed false. New geocode-quality guards route directional-fragment POI false positives such as `West, Greece` resolving to `Nefeli Hotel` to `directional_fragment_poi` review and ambiguous coastal-name false positives such as `Argentario, Italy` resolving to inland `Argentario, Trento` to `ambiguous_coastal_name` review. Readiness remains `NO_GO_KEEP_PUBLIC_MAP_DISABLED`; public pins stayed at 212, raw coordinates increased to 725, held-back coordinates increased to 513, and country-hint mismatches stayed at 0.
- Latest verified search-coverage checkpoint: `boat_geocode_backup_20260421035740` wrote 63 city/region/country search-only coordinates and held 37 review rows with null coordinates; invariant audit found 0 failed rows, 0 public-grade pins, 0 invalid coordinates, and public map flags still false. This improves location search/readiness but does not move the public map launch gate.
- Latest verified search-coverage checkpoint: `boat_geocode_backup_20260421085953` wrote 59 city/region/country search-only coordinates and one explicitly logged Ventura Harbor marina-grade coordinate, then held 40 review rows with null coordinates; invariant audit found 0 failed rows, 0 geography mismatches, 0 invalid coordinates, and public map flags still false. Follow-up USVI metadata cleanup used `boat_location_market_backup_usvi_20260421090257` and restored country-hint mismatches to 0.
- Latest verified search-coverage checkpoint: `boat_geocode_backup_20260421090823` wrote 75 city/region/country search-only coordinates and one explicitly logged Spice Island Marine street-grade coordinate, then held 24 review rows with null coordinates; invariant audit found 0 failed rows, 0 geography mismatches, 0 invalid coordinates, and public map flags still false. Readiness remains `NO_GO_KEEP_PUBLIC_MAP_DISABLED` with 187 public pins and country-hint mismatches at 0.
- Latest verified search-coverage checkpoint: `boat_geocode_backup_20260421093615` wrote 44 city/region search-only coordinates and one verified duplicate Spice Island Marine street-grade coordinate, then held 55 review rows with null coordinates; invariant audit found 0 failed rows, 0 geography mismatches, 0 invalid coordinates, and public map flags still false. New geocode-quality guards route degenerate one-letter fragments such as `S, France` to `degenerate_query` review and broad waterbody-to-business false positives such as `Ionian Sea Hotel` to `waterbody_poi_mismatch` review. Follow-up quality sweep used `boat_geocode_quality_backup_20260421094111` to downgrade 2 older `S, France` geocodes and clear their stale coordinates. Readiness remains `NO_GO_KEEP_PUBLIC_MAP_DISABLED` with 188 public pins and country-hint mismatches at 0.
- OpenCage remains the persisted coordinate source of record. Do not mix provider geocoding results without lineage fields and a migration plan.
- The launch audit proves the reviewed deterministic sample still matches current data. Keep its freshness window short because newly added public pins outside that sample still rely on readiness thresholds and follow-up audits.
