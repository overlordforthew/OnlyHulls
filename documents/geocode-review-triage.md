# Geocode Review Triage

Use `npm run db:geocode-review` when the readiness report shows review or failed geocodes.
The script is read-only: it does not update boats, cache rows, or provider data.
For first-time production backfills, follow `documents/location-geocoding-rollout.md` before scaling batches.

## Buckets

| Bucket | Meaning | Operator action |
| --- | --- | --- |
| `cleanup_source_text` | The provider returned no result for the current query. | Improve the imported/source location text with a city, marina, or country before retrying. Do not retry the same query blindly. |
| `manual_enrichment` | The provider found only a broad or low-confidence result. | Add better location detail, or keep the listing searchable by region/city while holding it back from public map pins. |
| `provider_health` | Quota, rate-limit, network, timeout, abort, or provider-side failure. | Fix provider health/configuration, then retry. If cached review/failed rows exist for the same query/provider, inspect cache before retrying. |
| `provider_bug` | Invalid coordinates or provider payload defect. | Manually inspect payload and source data; do not promote automatically. |
| `config_skipped` | Missing API key, user agent, or disabled provider. | Fix environment configuration and rerun the geocode workflow. |
| `manual_review` | Unknown review state. | Inspect provider payload and source listing before retrying or accepting. |
| `already_resolved` | Row is already geocoded. | No triage needed. |

## Useful Commands

```bash
npm run db:geocode-review
npm run db:geocode-review -- --by=row --limit=50
npm run db:geocode-review -- --error=no_result --json
npm run db:geocode-review -- --provider=opencage --status=review
```

Keep `PUBLIC_MAP_ENABLED=false` until readiness gates pass and the launch pin-audit attestation in `documents/public-map-operations.md` is fresh and zero-rejection.
