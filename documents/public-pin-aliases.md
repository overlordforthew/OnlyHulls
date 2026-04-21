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
