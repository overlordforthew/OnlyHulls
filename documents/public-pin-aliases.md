# Public Pin Aliases

Verified public-pin aliases are narrow exceptions for marina-grade names that should enter the public-pin candidate lane even when their generic terms are too risky to match globally.

Admission rules:

- The alias must represent a specific marina, yacht harbour, yacht club, boatyard, shipyard, dock, quay, or equivalent marine facility.
- A live OpenCage preview must return `status=geocoded`, public-map precision (`exact`, `street`, or `marina`), score `>=0.95`, and the expected country.
- Nearby same-pattern names must be checked and documented when available, especially names sharing broad terms like `harbour`, `yacht`, `marine`, `port`, or `dock`.
- The alias must have a unit test proving it matches, plus negative tests for nearby rejected names.
- Public map flags stay disabled during alias backfills, and the normal public-pin apply gate must not be bypassed.

Current aliases:

| Alias | Added | Evidence | Scope |
| --- | --- | --- | --- |
| `burnham yacht harbour` | Round 15 | OpenCage preview returned `Burnham Yacht Harbour, Foundry Lane, Burnham-on-Crouch, CM0 8TA, United Kingdom`, `precision=marina`, `score=1`, `country=GB`; nearby `Suffolk Yacht Harbour` and postcode variants were not eligible. Applied with backup `boat_geocode_backup_20260421111221`; post-apply audit returned 13/13 eligible pins. | 13 active listings in production at add time. |
| `conwy marina` | Round 16 | Cached OpenCage result is `Conwy Marina, Conwy Marina Village, LL32 8GU, United Kingdom`, `score=1`, `country=GB`, with provider component `boatyard=Conwy Marina`. | 10 rows applied in backup `boat_geocode_backup_20260421112827`. |
| `chichester marina` | Round 16 | Cached OpenCage result is `Chichester Marina, Appledram, Birdham, Chichester, West Sussex, England, United Kingdom`, `score=1`, `country=GB`, with provider component `water=Chichester Marina`. | 5 rows applied in backup `boat_geocode_backup_20260421112827`. |
| `palm cay marina` | Round 16 | Cached OpenCage result is `Palm Cay Marina, Palm Cay, Nassau, Bahamas`, `score=1`, `country=BS`, with provider component `basin=Palm Cay Marina`. | 3 rows applied in backup `boat_geocode_backup_20260421112827`. |
| `medway yacht club` | Round 16 | Cached OpenCage result is `Medway Yacht Club Pontoon, Riverside Walk, Gillingham, ME4 3SU, United Kingdom`, `score=1`, `country=GB`, with provider component `pier=Medway Yacht Club Pontoon`. | 3 rows applied in backup `boat_geocode_backup_20260421112827`. |
| `lagoon marina` | Round 16 | Cached OpenCage result is `Lagoon Marina, Wellington Road, Cul-de-Sac, Sint Maarten`, `score=1`, with provider component `pier=Lagoon Marina`; the existing country-equivalence guard handles the provider `nl`/Sint Maarten code nuance. Round 20 confirmed that appending `Sint Maarten` to the query returns broad `Cole Bay` city precision, so keep Lagoon on the verified alias/cache path until a facility-specific provider query is proven. | 1 row applied in backup `boat_geocode_backup_20260421112827`; 2 cache-backed Lagoon rows repaired in `boat_geocode_backup_20260421134416` after the rejected Cole Bay metadata experiment. |
| `marina frapa` | Round 16 | Cached OpenCage result is `Marina Frapa, Uvala Soline 1, 22203 Općina Rogoznica, Croatia`, `score=1`, `country=HR`, with provider component `reception_desk=Marina Frapa`. | 1 row applied in backup `boat_geocode_backup_20260421112827`. |
| `marina baotic` | Round 19 | OpenCage preview for `Marina Baotic, Seget Donji, Croatia` returned `Marina Baotić, Ulica don Petra Špika 2A, 21218 Seget Donji, Croatia`, `precision=marina`, `score=1`, `country=HR`; broader `Yachtclub Seget ... Trogir` and `Marina Baotic, Trogir` queries returned only Trogir city precision. | 12 rows applied in backup `boat_geocode_backup_20260421125714`; post-apply audit returned 12/12 eligible pins. |
| `linton bay marina` | Round 20 | OpenCage preview for `Linton Bay Marina` returned `Linton Bay Marina, Carretera Portobelo - La Guaira, Puerto Lindo, Colón, Panama`, `precision=marina`, `score=1`, `country=PA`; negative checks keep `Linton`, `Linton Bay`, and `Bay Marina, Panama` out of the alias lane. | 2 Linton rows applied in backup `boat_geocode_backup_20260421133028`; the verified-alias queue selected 0 rows afterward. |

Round 16 applied 23 cached reviewed-alias rows with `PUBLIC_MAP_ENABLED=false`; 0 rows were held back, 0 failed, 0 geography mismatches were found, the retry lane selected 0 rows afterward, and the backup-scoped map-pin audit returned 23/23 eligible pins.

Round 19 applied 12 Marina Baotić rows with `PUBLIC_MAP_ENABLED=false`; 8 existing Trogir city coordinates and 4 review rows were promoted to marina-grade pins through the verified-alias changed-geocoded lane, 0 rows were held back, 0 failed, 0 geography mismatches were found, the retry lane selected 0 rows afterward, and the backup-scoped map-pin audit returned 12/12 eligible pins.

Round 20 applied 2 Linton Bay Marina rows with `PUBLIC_MAP_ENABLED=false`, `precision=marina`, `score=1`, 0 held back, 0 failed, 0 geography mismatches, and 0 warnings. A follow-up Cole Bay/Sint Maarten metadata experiment was rolled back because the country-suffixed OpenCage query returned broad `Cole Bay` city precision instead of Lagoon Marina; the affected Lagoon rows were repaired from the existing verified Lagoon Marina cache in `boat_geocode_backup_20260421134416`, and the verified-alias lane selected 0 rows afterward.

Promotion anchors:

- `burnham yacht harbour`: `gb`, `51.627746, 0.803725`, max 5 km.
- `conwy marina`: `gb`, `53.290557, -3.837935`, max 5 km.
- `chichester marina`: `gb`, `50.804083, -0.821084`, max 5 km.
- `palm cay marina`: `bs`, `25.020788, -77.274061`, max 5 km.
- `medway yacht club`: `gb`, `51.413041, 0.536679`, max 5 km.
- `lagoon marina`: `nl`/`sx`, `18.033360, -63.085709`, max 5 km.
- `marina frapa`: `hr`, `43.529953, 15.963572`, max 5 km.
- `marina baotic`: `hr`, `43.516219, 16.233877`, max 5 km.
- `linton bay marina`: `pa`, `9.612811, -79.578944`, max 5 km.

Explicit non-aliases from Round 16:

- `chatham marina`: held back because the reviewed result is `MDL Chatham Maritime Marina Boatyard`; this needs a future pair-alias model rather than a contiguous alias.
- `dover marina`: held back because the reviewed result is `Dover Pier, New Marina Curve Road`; the marina token appears as road text.
- `green cay marina`, `tollesbury marina`, `shotley marina`, `port solent marina`, and `marina del rey`: held back because reviewed results are broad place, postcode, parking, or admin-area matches rather than verified facility pins.
