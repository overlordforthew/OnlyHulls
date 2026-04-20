import { pool, query } from "../src/lib/db/index";
import { buildVisibleImportQualitySql } from "../src/lib/import-quality";
import {
  buildGeocodeQuery,
  geocodeWithOpenCage,
  geocodeWithNominatim,
  getGeocodeCandidateReason,
  getGeocodingConfig,
  type GeocodingConfig,
  type GeocodePrecision,
  type GeocodeResult,
  type GeocodeStatus,
} from "../src/lib/locations/geocoding";
import { inferLocationMarketSignals } from "../src/lib/locations/top-markets";

// Public Nominatim is for small validation runs only: single process, <= 1 request/sec,
// real User-Agent/contact email, cached results, and immediate backoff on provider quota/rate errors.
// Use OpenCage or another paid provider for the full commercial backfill.
// Keep PUBLIC_MAP_ENABLED=false until precision and random pin audits pass.
// Drop boat_geocode_backup_* tables only after the corresponding batch is verified.

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
  query_key?: string;
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

type PreparedCandidate = BoatGeocodeCandidate & {
  geocodeQuery: ReturnType<typeof buildGeocodeQuery>;
  reason: string;
};

type ReadyCandidate = PreparedCandidate & {
  geocodeQuery: NonNullable<PreparedCandidate["geocodeQuery"]>;
};

type PrecisionSplit = Record<GeocodePrecision, number>;
type StatusSplit = Record<GeocodeStatus, number>;

type GeographyMismatch = {
  boatId: string;
  locationText: string | null;
  type: "country" | "region";
  expected: string;
  actual: string;
  placeName: string | null;
};

type SamplePin = {
  boatId: string;
  locationText: string | null;
  queryText: string;
  latitude: number | null;
  longitude: number | null;
  precision: GeocodePrecision;
  placeName: string | null;
  auditUrl: string | null;
};

const POPULATION_UNIQUE_NOMINATIM_WARNING_THRESHOLD = 1500;
const NOMINATIM_BATCH_UNIQUE_APPLY_THRESHOLD = 200;
const PAID_PROVIDER_BATCH_UNIQUE_APPLY_THRESHOLD = 2000;
const SAMPLE_PIN_LIMIT = 20;
const BROAD_REGION_NAMES = new Set([
  "caribbean",
  "channel islands",
  "chesapeake bay",
  "great lakes",
  "mediterranean",
  "new england",
  "pacific northwest",
]);

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
  return ["http_402", "http_403", "http_429", "http_503"].includes(result.error || "");
}

function hasFlag(name: string) {
  return process.argv.includes(name);
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

function emptyPrecisionSplit(): PrecisionSplit {
  return {
    exact: 0,
    street: 0,
    marina: 0,
    city: 0,
    region: 0,
    country: 0,
    unknown: 0,
  };
}

function emptyStatusSplit(): StatusSplit {
  return {
    skipped: 0,
    geocoded: 0,
    failed: 0,
    review: 0,
  };
}

function incrementCount(record: Record<string, number>, key: string | null | undefined) {
  const normalized = key || "unknown";
  record[normalized] = (record[normalized] || 0) + 1;
}

function normalizeAuditValue(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatBackupTableName() {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
  return `boat_geocode_backup_${stamp}`;
}

function getPayloadCountryCode(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const address = record.address || record.components;
  if (!address || typeof address !== "object") return null;
  const countryCode = (address as Record<string, unknown>).country_code;

  return typeof countryCode === "string" ? countryCode.toLowerCase() : null;
}

function getPayloadAddressStrings(payload: unknown, fields: string[]) {
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  const address = record.address || record.components;
  if (!address || typeof address !== "object") return [];
  const addressRecord = address as Record<string, unknown>;

  return fields
    .map((field) => addressRecord[field])
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}

function getPayloadRegionValues(payload: unknown) {
  return getPayloadAddressStrings(payload, [
    "state",
    "province",
    "region",
    "county",
    "state_district",
    "island",
  ]);
}

function shouldAuditRegionMismatch(boat: BoatGeocodeCandidate) {
  const expectedRegion = normalizeAuditValue(boat.location_region);
  if (!expectedRegion || BROAD_REGION_NAMES.has(expectedRegion)) return false;
  if (expectedRegion === normalizeAuditValue(boat.location_country)) return false;

  return true;
}

function getGeographyMismatch(
  boat: BoatGeocodeCandidate,
  expectedCountryCode: string | null,
  result: GeocodeResult
): GeographyMismatch | null {
  const actualCountryCode = getPayloadCountryCode(result.payload);
  if (expectedCountryCode && actualCountryCode && actualCountryCode !== expectedCountryCode) {
    return {
      boatId: boat.id,
      locationText: boat.location_text,
      type: "country",
      expected: expectedCountryCode,
      actual: actualCountryCode,
      placeName: result.placeName,
    };
  }

  if (!shouldAuditRegionMismatch(boat)) return null;

  const expectedRegion = normalizeAuditValue(boat.location_region);
  const actualRegions = getPayloadRegionValues(result.payload);
  const normalizedActualRegions = actualRegions.map(normalizeAuditValue).filter(Boolean);
  if (normalizedActualRegions.length === 0) return null;

  const hasExpectedRegion = normalizedActualRegions.some(
    (region) => region === expectedRegion || region.includes(expectedRegion) || expectedRegion.includes(region)
  );
  if (hasExpectedRegion) return null;

  return {
    boatId: boat.id,
    locationText: boat.location_text,
    type: "region",
    expected: String(boat.location_region || ""),
    actual: actualRegions.join(", "),
    placeName: result.placeName,
  };
}

function buildPinAuditUrl(latitude: number | null, longitude: number | null) {
  if (typeof latitude !== "number" || typeof longitude !== "number") return null;
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=10/${latitude}/${longitude}`;
}

function appendGeocodeAudit(
  summary: { geographyMismatches: GeographyMismatch[]; samplePins: SamplePin[] },
  boat: BoatGeocodeCandidate,
  geocodeQuery: ReadyCandidate["geocodeQuery"],
  result: GeocodeResult
) {
  if (result.status !== "geocoded") return;

  const mismatch = getGeographyMismatch(boat, geocodeQuery.countryHint, result);
  if (mismatch) summary.geographyMismatches.push(mismatch);

  if (summary.samplePins.length >= SAMPLE_PIN_LIMIT) return;
  summary.samplePins.push({
    boatId: boat.id,
    locationText: boat.location_text,
    queryText: geocodeQuery.queryText,
    latitude: result.latitude,
    longitude: result.longitude,
    precision: result.precision,
    placeName: result.placeName,
    auditUrl: buildPinAuditUrl(result.latitude, result.longitude),
  });
}

function fromCache(row: GeocodeCacheRow): GeocodeResult {
  return {
    status: row.status,
    latitude: row.latitude,
    longitude: row.longitude,
    precision: row.precision || "unknown",
    score: row.score,
    placeName: row.place_name,
    provider: row.provider === "nominatim" || row.provider === "opencage" ? row.provider : "disabled",
    payload: row.payload,
    error: row.error,
  };
}

async function getCachedResults(queryKeys: string[], provider: GeocodingConfig["provider"]) {
  if (queryKeys.length === 0) return new Map<string, GeocodeResult>();
  const rows = await query<GeocodeCacheRow>(
    `SELECT query_key, status, latitude, longitude, precision, score, place_name, provider, payload, error
     FROM location_geocode_cache
     WHERE query_key = ANY($1::text[])
       AND provider = $2`,
    [queryKeys, provider]
  );

  return new Map(
    rows
      .filter((row): row is GeocodeCacheRow & { query_key: string } => Boolean(row.query_key))
      .map((row) => [row.query_key, fromCache(row)])
  );
}

async function getCachedResult(queryKey: string, provider: GeocodingConfig["provider"]) {
  const rows = await query<GeocodeCacheRow>(
    `SELECT status, latitude, longitude, precision, score, place_name, provider, payload, error
     FROM location_geocode_cache
     WHERE query_key = $1
       AND provider = $2`,
    [queryKey, provider]
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
     ON CONFLICT (query_key, provider)
     DO UPDATE SET query_text = EXCLUDED.query_text,
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

async function geocodeWithConfiguredProvider(
  geocodeQuery: ReadyCandidate["geocodeQuery"],
  config: GeocodingConfig
) {
  switch (config.provider) {
    case "nominatim":
      return geocodeWithNominatim(geocodeQuery, config);
    case "opencage":
      return geocodeWithOpenCage(geocodeQuery, config);
    default:
      return {
        status: "skipped",
        latitude: null,
        longitude: null,
        precision: "unknown",
        score: null,
        placeName: null,
        provider: "disabled",
        error: "provider_disabled",
      } satisfies GeocodeResult;
  }
}

function getBatchUniqueApplyThreshold(provider: GeocodingConfig["provider"]) {
  return provider === "nominatim"
    ? NOMINATIM_BATCH_UNIQUE_APPLY_THRESHOLD
    : PAID_PROVIDER_BATCH_UNIQUE_APPLY_THRESHOLD;
}

async function applyResult(boat: BoatGeocodeCandidate, queryText: string, result: GeocodeResult) {
  const hasMappableCoordinates = shouldApplyResult(result);
  const storedPrecision = hasMappableCoordinates ? result.precision : "unknown";
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
      storedPrecision,
      result.score,
      result.error || null,
      JSON.stringify(result.payload || null),
    ]
  );
}

async function createBackupSnapshot(candidateIds: string[]) {
  if (candidateIds.length === 0) return null;
  const tableName = formatBackupTableName();
  await query(
    `CREATE TABLE ${tableName} AS
     SELECT
       id,
       location_lat,
       location_lng,
       location_geocoded_at,
       location_geocode_status,
       location_geocode_provider,
       location_geocode_query,
       location_geocode_place_name,
       location_geocode_precision,
       location_geocode_score,
       location_geocode_error,
       location_geocode_attempted_at,
       location_geocode_payload,
       updated_at,
       NOW() AS backed_up_at
     FROM boats
     WHERE id = ANY($1::uuid[])`,
    [candidateIds]
  );

  return tableName;
}

function prepareCandidate(boat: BoatGeocodeCandidate): PreparedCandidate {
  const geocodeQuery = buildGeocodeQuery({
    locationText: boat.location_text,
    country: boat.location_country,
    region: boat.location_region,
    marketSlugs: boat.location_market_slugs,
    confidence: boat.location_confidence,
  });
  const reason = getGeocodeCandidateReason({
    locationText: boat.location_text,
    country: boat.location_country,
    region: boat.location_region,
    marketSlugs: boat.location_market_slugs,
    confidence: boat.location_confidence,
  });

  return {
    ...boat,
    geocodeQuery,
    reason,
  };
}

async function main() {
  const limit = getLimit();
  const apply = hasFlag("--apply");
  const allowLargeBatch = hasFlag("--allow-large-batch");
  const includeReview = hasFlag("--include-review");
  const config = getGeocodingConfig();
  const visibleSql = buildVisibleImportQualitySql("b");
  const statusSql = includeReview
    ? "b.location_geocode_status IN ('pending', 'review', 'failed')"
    : "b.location_geocode_status = 'pending'";
  const rows = await query<BoatGeocodeCandidate>(
    `SELECT b.id, b.location_text, b.location_country, b.location_region,
            COALESCE(b.location_market_slugs, '{}') AS location_market_slugs,
            b.location_confidence, b.location_lat, b.location_lng
     FROM boats b
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE b.status = 'active'
       AND ${visibleSql}
       AND COALESCE(NULLIF(TRIM(b.location_text), ''), '') <> ''
       AND (
         b.location_lat IS NULL
         OR b.location_lng IS NULL
         OR b.location_lat NOT BETWEEN -90 AND 90
         OR b.location_lng NOT BETWEEN -180 AND 180
       )
       AND ${statusSql}
     ORDER BY CASE b.location_confidence
                WHEN 'city' THEN 0
                WHEN 'region' THEN 1
                ELSE 2
              END,
              CARDINALITY(COALESCE(b.location_market_slugs, '{}'::text[])) DESC,
              b.updated_at DESC,
              b.id`
  );
  const candidates = rows.map(prepareCandidate);
  const geocodableCandidates = candidates.filter(
    (candidate): candidate is ReadyCandidate => candidate.geocodeQuery !== null
  );
  const selectedCandidates = geocodableCandidates.slice(0, limit);
  const nextCandidates = geocodableCandidates.slice(limit, limit * 2);
  const uniqueReadyQueryKeys = Array.from(
    new Set(geocodableCandidates.map((candidate) => candidate.geocodeQuery.queryKey))
  );
  const selectedQueryKeys = Array.from(
    new Set(selectedCandidates.map((candidate) => candidate.geocodeQuery.queryKey))
  );
  const cacheByKey = await getCachedResults(uniqueReadyQueryKeys, config.provider);
  let backupTable: string | null = null;
  const summary = {
    provider: config.provider,
    enabled: config.enabled,
    mode: apply ? "apply" : "dry-run",
    includeReview,
    totalCandidates: candidates.length,
    geocodableCandidates: geocodableCandidates.length,
    uniqueReadyQueries: uniqueReadyQueryKeys.length,
    selectedRows: selectedCandidates.length,
    selectedUniqueQueries: selectedQueryKeys.length,
    cached: 0,
    geocoded: 0,
    review: 0,
    failed: 0,
    skipped: 0,
    precisionSplit: emptyPrecisionSplit(),
    statusSplit: emptyStatusSplit(),
    failureReasons: {} as Record<string, number>,
    nonGeocodableReasons: {} as Record<string, number>,
    geographyMismatches: [] as GeographyMismatch[],
    samplePins: [] as SamplePin[],
    nextBatch: {
      rows: nextCandidates.length,
      cacheHits: 0,
      cacheHitRatio: 0,
    },
    backupTable: backupTable as string | null,
    warnings: [] as string[],
    stoppedReason: null as string | null,
  };

  for (const candidate of candidates) {
    if (!candidate.geocodeQuery) incrementCount(summary.nonGeocodableReasons, candidate.reason);
  }

  if (
    config.provider === "nominatim" &&
    uniqueReadyQueryKeys.length > POPULATION_UNIQUE_NOMINATIM_WARNING_THRESHOLD
  ) {
    summary.warnings.push(
      `population_unique_queries_${uniqueReadyQueryKeys.length}_exceeds_${POPULATION_UNIQUE_NOMINATIM_WARNING_THRESHOLD}_choose_paid_provider_before_full_backfill`
    );
  }

  if (apply && !config.enabled) {
    summary.stoppedReason = `${config.provider}_not_configured`;
    console.error(`Refusing --apply: geocoding provider '${config.provider}' is not configured.`);
    console.log(JSON.stringify(summary, null, 2));
    process.exitCode = 1;
    return;
  }

  const batchUniqueApplyThreshold = getBatchUniqueApplyThreshold(config.provider);
  if (apply && selectedQueryKeys.length > batchUniqueApplyThreshold && !allowLargeBatch) {
    summary.stoppedReason = `selected_unique_queries_${selectedQueryKeys.length}_exceeds_${batchUniqueApplyThreshold}`;
    console.error(
      `Refusing --apply: selected batch has ${selectedQueryKeys.length} unique geocode queries, above ${batchUniqueApplyThreshold}. Reduce --limit or pass --allow-large-batch.`
    );
    console.log(JSON.stringify(summary, null, 2));
    process.exitCode = 1;
    return;
  }

  if (apply && selectedCandidates.length > 0) {
    backupTable = await createBackupSnapshot(selectedCandidates.map((candidate) => candidate.id));
    summary.backupTable = backupTable;
  }

  for (const boat of selectedCandidates) {
    const geocodeQuery = boat.geocodeQuery;

    const cached = cacheByKey.get(geocodeQuery.queryKey) || (await getCachedResult(geocodeQuery.queryKey, config.provider));
    if (cached) {
      summary.cached += 1;
      summary.statusSplit[cached.status] += 1;
      summary.precisionSplit[cached.precision] += 1;
      if (cached.status === "geocoded") summary.geocoded += 1;
      if (cached.status === "review") summary.review += 1;
      if (cached.status === "failed") summary.failed += 1;
      if (cached.error) incrementCount(summary.failureReasons, cached.error);
      appendGeocodeAudit(summary, boat, geocodeQuery, cached);
      if (apply) await applyResult(boat, geocodeQuery.queryText, cached);
      continue;
    }

    if (!apply || !config.enabled || config.provider === "disabled") continue;

    const result = await geocodeWithConfiguredProvider(geocodeQuery, config);
    summary.statusSplit[result.status] += 1;
    summary.precisionSplit[result.precision] += 1;
    if (result.status === "geocoded") summary.geocoded += 1;
    if (result.status === "review") summary.review += 1;
    if (result.status === "failed") summary.failed += 1;
    if (result.status === "skipped") summary.skipped += 1;
    if (result.error) incrementCount(summary.failureReasons, result.error);
    appendGeocodeAudit(summary, boat, geocodeQuery, result);

    if (apply) {
      if (result.status !== "skipped") await cacheResult(geocodeQuery.queryKey, geocodeQuery.queryText, result);
      if (result.status !== "skipped") cacheByKey.set(geocodeQuery.queryKey, result);
      await applyResult(boat, geocodeQuery.queryText, result);
    }

    if (isProviderBackoffResult(result)) {
      summary.stoppedReason = result.error || "provider_backoff";
      break;
    }

    if (config.delayMs > 0) await sleep(config.delayMs);
  }

  summary.nextBatch.cacheHits = nextCandidates.filter((candidate) =>
    cacheByKey.has(candidate.geocodeQuery.queryKey)
  ).length;
  summary.nextBatch.cacheHitRatio =
    summary.nextBatch.rows > 0
      ? Number((summary.nextBatch.cacheHits / summary.nextBatch.rows).toFixed(3))
      : 0;

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
