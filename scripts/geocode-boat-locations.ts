import { pool, query } from "../src/lib/db/index";
import { buildVisibleImportQualitySql } from "../src/lib/import-quality";
import {
  buildGeocodeQuery,
  geocodeWithNominatim,
  getGeocodeCandidateReason,
  getGeocodingConfig,
  type GeocodePrecision,
  type GeocodeResult,
  type GeocodeStatus,
} from "../src/lib/locations/geocoding";
import { inferLocationMarketSignals } from "../src/lib/locations/top-markets";

type BoatGeocodeCandidate = {
  id: string;
  location_text: string | null;
  location_country: string | null;
  location_region: string | null;
  location_market_slugs: string[];
  location_confidence: string | null;
  location_lat: number | null;
  location_lng: number | null;
};

type GeocodeCacheRow = {
  status: GeocodeStatus;
  latitude: number | null;
  longitude: number | null;
  precision: GeocodePrecision | null;
  score: number | null;
  place_name: string | null;
  provider: string;
  payload: unknown;
  error: string | null;
};

function getArgValue(name: string) {
  const prefix = `${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : null;
}

function getLimit() {
  const parsed = Number(getArgValue("--limit") || process.env.LOCATION_GEOCODING_LIMIT || 25);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 250) : 25;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isProviderBackoffResult(result: GeocodeResult) {
  return result.error === "http_429" || result.error === "http_503";
}

function shouldApplyResult(result: GeocodeResult) {
  return (
    result.status === "geocoded" &&
    typeof result.latitude === "number" &&
    typeof result.longitude === "number"
  );
}

function coordinatesAreApproximate(precision: GeocodePrecision) {
  return !["exact", "street", "marina"].includes(precision);
}

function fromCache(row: GeocodeCacheRow): GeocodeResult {
  return {
    status: row.status,
    latitude: row.latitude,
    longitude: row.longitude,
    precision: row.precision || "unknown",
    score: row.score,
    placeName: row.place_name,
    provider: row.provider === "nominatim" ? "nominatim" : "disabled",
    payload: row.payload,
    error: row.error,
  };
}

async function getCachedResult(queryKey: string) {
  const rows = await query<GeocodeCacheRow>(
    `SELECT status, latitude, longitude, precision, score, place_name, provider, payload, error
     FROM location_geocode_cache
     WHERE query_key = $1`,
    [queryKey]
  );

  return rows[0] ? fromCache(rows[0]) : null;
}

async function cacheResult(queryKey: string, queryText: string, result: GeocodeResult) {
  await query(
    `INSERT INTO location_geocode_cache (
       query_key, query_text, provider, status, latitude, longitude, precision,
       score, place_name, payload, error, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
     ON CONFLICT (query_key)
     DO UPDATE SET query_text = EXCLUDED.query_text,
                   provider = EXCLUDED.provider,
                   status = EXCLUDED.status,
                   latitude = EXCLUDED.latitude,
                   longitude = EXCLUDED.longitude,
                   precision = EXCLUDED.precision,
                   score = EXCLUDED.score,
                   place_name = EXCLUDED.place_name,
                   payload = EXCLUDED.payload,
                   error = EXCLUDED.error,
                   updated_at = NOW()`,
    [
      queryKey,
      queryText,
      result.provider,
      result.status === "skipped" ? "review" : result.status,
      result.latitude,
      result.longitude,
      result.precision,
      result.score,
      result.placeName,
      JSON.stringify(result.payload || null),
      result.error || null,
    ]
  );
}

async function applyResult(boat: BoatGeocodeCandidate, queryText: string, result: GeocodeResult) {
  const hasMappableCoordinates = shouldApplyResult(result);
  const signals = hasMappableCoordinates
    ? inferLocationMarketSignals({
        locationText: boat.location_text,
        latitude: result.latitude,
        longitude: result.longitude,
        coordinatesApproximate: coordinatesAreApproximate(result.precision),
      })
    : null;

  await query(
    `UPDATE boats
     SET location_lat = CASE WHEN $2::boolean THEN $3 ELSE location_lat END,
         location_lng = CASE WHEN $2::boolean THEN $4 ELSE location_lng END,
         location_country = COALESCE($5, location_country),
         location_region = COALESCE($6, location_region),
         location_market_slugs = COALESCE($7::text[], location_market_slugs),
         location_confidence = COALESCE($8, location_confidence),
         location_approximate = COALESCE($9, location_approximate),
         location_geocoded_at = CASE WHEN $2::boolean THEN NOW() ELSE location_geocoded_at END,
         location_geocode_status = $10,
         location_geocode_provider = $11,
         location_geocode_query = $12,
         location_geocode_place_name = $13,
         location_geocode_precision = $14,
         location_geocode_score = $15,
         location_geocode_error = $16,
         location_geocode_attempted_at = NOW(),
         location_geocode_payload = $17,
         updated_at = NOW()
     WHERE id = $1`,
    [
      boat.id,
      hasMappableCoordinates,
      result.latitude,
      result.longitude,
      signals?.country || null,
      signals?.region || null,
      signals?.marketSlugs || null,
      signals?.confidence || null,
      signals?.approximate ?? null,
      result.status,
      result.provider,
      queryText,
      result.placeName,
      result.precision,
      result.score,
      result.error || null,
      JSON.stringify(result.payload || null),
    ]
  );
}

async function main() {
  const limit = getLimit();
  const apply = process.argv.includes("--apply");
  const config = getGeocodingConfig();
  const visibleSql = buildVisibleImportQualitySql("b");
  const rows = await query<BoatGeocodeCandidate>(
    `SELECT b.id, b.location_text, b.location_country, b.location_region,
            COALESCE(b.location_market_slugs, '{}') AS location_market_slugs,
            b.location_confidence, b.location_lat, b.location_lng
     FROM boats b
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE b.status = 'active'
       AND ${visibleSql}
       AND COALESCE(NULLIF(TRIM(b.location_text), ''), '') <> ''
       AND NOT (
         b.location_lat BETWEEN -90 AND 90
         AND b.location_lng BETWEEN -180 AND 180
       )
       AND b.location_geocode_status NOT IN ('geocoded', 'skipped')
     ORDER BY CASE b.location_confidence
                WHEN 'city' THEN 0
                WHEN 'region' THEN 1
                ELSE 2
              END,
              CARDINALITY(COALESCE(b.location_market_slugs, '{}'::text[])) DESC,
              b.updated_at DESC,
              b.id
     LIMIT $1`,
    [limit]
  );
  const summary = {
    provider: config.provider,
    enabled: config.enabled,
    mode: apply ? "apply" : "dry-run",
    scanned: rows.length,
    ready: 0,
    cached: 0,
    geocoded: 0,
    review: 0,
    failed: 0,
    skipped: 0,
    stoppedReason: null as string | null,
  };

  for (const boat of rows) {
    const geocodeQuery = buildGeocodeQuery({
      locationText: boat.location_text,
      country: boat.location_country,
      region: boat.location_region,
      marketSlugs: boat.location_market_slugs,
      confidence: boat.location_confidence,
    });

    if (!geocodeQuery) {
      summary.skipped += 1;
      if (apply && getGeocodeCandidateReason({
        locationText: boat.location_text,
        country: boat.location_country,
        region: boat.location_region,
        marketSlugs: boat.location_market_slugs,
        confidence: boat.location_confidence,
      }) !== "needs_more_specific_location") {
        await query(
          `UPDATE boats
           SET location_geocode_status = 'skipped',
               location_geocode_error = $2,
               location_geocode_attempted_at = NOW()
           WHERE id = $1`,
          [boat.id, "not_geocodable"]
        );
      }
      continue;
    }

    summary.ready += 1;
    const cached = await getCachedResult(geocodeQuery.queryKey);
    if (cached) {
      summary.cached += 1;
      if (cached.status === "geocoded") summary.geocoded += 1;
      if (cached.status === "review") summary.review += 1;
      if (cached.status === "failed") summary.failed += 1;
      if (apply) await applyResult(boat, geocodeQuery.queryText, cached);
      continue;
    }

    if (!apply || !config.enabled || config.provider !== "nominatim") continue;

    const result = await geocodeWithNominatim(geocodeQuery, config);
    if (result.status === "geocoded") summary.geocoded += 1;
    if (result.status === "review") summary.review += 1;
    if (result.status === "failed") summary.failed += 1;
    if (result.status === "skipped") summary.skipped += 1;

    if (apply) {
      if (result.status !== "skipped") await cacheResult(geocodeQuery.queryKey, geocodeQuery.queryText, result);
      await applyResult(boat, geocodeQuery.queryText, result);
    }

    if (isProviderBackoffResult(result)) {
      summary.stoppedReason = result.error || "provider_backoff";
      break;
    }

    if (config.delayMs > 0) await sleep(config.delayMs);
  }

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
