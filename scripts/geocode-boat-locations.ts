import { pool, query } from "../src/lib/db/index";
import { buildVisibleImportQualitySql } from "../src/lib/import-quality";
import {
  buildGeocodeQuery,
  geocodeWithOpenCage,
  geocodeWithNominatim,
  getGeocodeCandidateReason,
  getGeocodingConfig,
  promoteVerifiedPublicPinAliasPrecision,
  reviewGeocodeResultQuality,
  type GeocodingConfig,
  type GeocodePrecision,
  type GeocodeResult,
  type GeocodeStatus,
} from "../src/lib/locations/geocoding";
import {
  getGeocodeApplySafetyStop,
  isEnabledEnvValue,
} from "../src/lib/locations/geocode-rollout-safety";
import { shouldRetryChangedReviewGeocode } from "../src/lib/locations/geocode-review-retry";
import {
  getPublicPinApplyGateStop,
  getPublicPinApplyResult,
  getPublicPinEligibleRate,
  isPublicPinEligibleResult,
  isPublicPinLikelyGeocodeCandidate,
  isVerifiedPublicPinAliasGeocodeCandidate,
} from "../src/lib/locations/geocode-candidate-lanes";
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
  location_geocode_status: GeocodeStatus | "pending" | null;
  location_geocode_query: string | null;
};

type GeocodeCacheRow = {
  query_key?: string;
  query_text: string | null;
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

type SelectedQuerySample = {
  boatId: string;
  locationText: string | null;
  country: string | null;
  region: string | null;
  marketSlugs: string[];
  queryText: string;
  countryHint: string | null;
  geocodeStatus?: GeocodeStatus | "pending" | null;
  previousQueryText?: string | null;
};

type GeocodeAuditRow = SelectedQuerySample & {
  source: "cache" | "provider";
  status: GeocodeStatus;
  precision: GeocodePrecision;
  precisionPromotedFrom?: GeocodePrecision | null;
  precisionPromotionAlias?: string | null;
  score: number | null;
  placeName: string | null;
  error: string | null;
  latitude: number | null;
  longitude: number | null;
  auditUrl: string | null;
  geographyMismatch: GeographyMismatch | null;
};

type ProcessedGeocodeResult = {
  boat: ReadyCandidate;
  geocodeQuery: ReadyCandidate["geocodeQuery"];
  result: GeocodeResult;
  source: GeocodeAuditRow["source"];
};

type PrecisionPromotionAuditRow = {
  boatId: string;
  locationText: string | null;
  queryText: string;
  source: GeocodeAuditRow["source"];
  alias: string;
  from: GeocodePrecision;
  to: "marina";
};

const POPULATION_UNIQUE_NOMINATIM_WARNING_THRESHOLD = 1500;
const SAMPLE_PIN_LIMIT = 20;
const BROAD_REGION_NAMES = new Set([
  "caribbean",
  "channel islands",
  "chesapeake bay",
  "great lakes",
  "mediterranean",
  "new england",
  "pacific northwest",
  "south pacific",
]);
const ACCEPTED_COUNTRY_CODE_EQUIVALENTS: Record<string, string[]> = {
  aw: ["nl"],
  gp: ["fr"],
  mf: ["fr"],
  mq: ["fr"],
  pf: ["fr"],
  pr: ["us"],
  sx: ["nl"],
  vi: ["us"],
  vg: ["gb"],
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
  const acceptedActualCountryCodes = expectedCountryCode
    ? new Set([expectedCountryCode, ...(ACCEPTED_COUNTRY_CODE_EQUIVALENTS[expectedCountryCode] || [])])
    : null;
  if (
    expectedCountryCode &&
    actualCountryCode &&
    !acceptedActualCountryCodes?.has(actualCountryCode)
  ) {
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

function buildSelectedQuerySample(
  boat: BoatGeocodeCandidate,
  geocodeQuery: ReadyCandidate["geocodeQuery"]
): SelectedQuerySample {
  return {
    boatId: boat.id,
    locationText: boat.location_text,
    country: boat.location_country,
    region: boat.location_region,
    marketSlugs: boat.location_market_slugs,
    queryText: geocodeQuery.queryText,
    countryHint: geocodeQuery.countryHint,
    geocodeStatus: boat.location_geocode_status,
    previousQueryText: boat.location_geocode_query,
  };
}

function appendGeocodeAudit(
  summary: {
    auditRows: GeocodeAuditRow[];
    geographyMismatches: GeographyMismatch[];
    samplePins: SamplePin[];
  },
  boat: BoatGeocodeCandidate,
  geocodeQuery: ReadyCandidate["geocodeQuery"],
  result: GeocodeResult,
  source: GeocodeAuditRow["source"]
) {
  const mismatch =
    result.status === "geocoded" ? getGeographyMismatch(boat, geocodeQuery.countryHint, result) : null;
  summary.auditRows.push({
    ...buildSelectedQuerySample(boat, geocodeQuery),
    source,
    status: result.status,
    precision: result.precision,
    precisionPromotedFrom: result.precisionPromotedFrom || null,
    precisionPromotionAlias: result.precisionPromotionAlias || null,
    score: result.score,
    placeName: result.placeName,
    error: result.error || null,
    latitude: result.latitude,
    longitude: result.longitude,
    auditUrl: buildPinAuditUrl(result.latitude, result.longitude),
    geographyMismatch: mismatch,
  });
  if (mismatch) summary.geographyMismatches.push(mismatch);
  if (result.status !== "geocoded") return;

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
  const queryText = row.query_text || row.query_key || "";
  const result = promoteVerifiedPublicPinAliasPrecision(queryText, {
    status: row.status,
    latitude: row.latitude,
    longitude: row.longitude,
    precision: row.precision || "unknown",
    score: row.score,
    placeName: row.place_name,
    provider: row.provider === "nominatim" || row.provider === "opencage" ? row.provider : "disabled",
    payload: row.payload,
    error: row.error,
  });

  return reviewGeocodeResultQuality(queryText, result);
}

async function getCachedResults(queryKeys: string[], provider: GeocodingConfig["provider"]) {
  if (queryKeys.length === 0) return new Map<string, GeocodeResult>();
  const rows = await query<GeocodeCacheRow>(
    `SELECT query_key, query_text, status, latitude, longitude, precision, score, place_name, provider, payload, error
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
    `SELECT query_key, query_text, status, latitude, longitude, precision, score, place_name, provider, payload, error
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

async function applyResult(boat: BoatGeocodeCandidate, queryText: string, result: GeocodeResult) {
  const hasMappableCoordinates = shouldApplyResult(result);
  const storedPrecision = result.precision || "unknown";
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
     SET location_lat = CASE WHEN $2::boolean THEN $3 WHEN $10 IN ('review', 'failed') THEN NULL ELSE location_lat END,
         location_lng = CASE WHEN $2::boolean THEN $4 WHEN $10 IN ('review', 'failed') THEN NULL ELSE location_lng END,
         location_country = COALESCE($5, location_country),
         location_region = COALESCE($6, location_region),
         location_market_slugs = COALESCE($7::text[], location_market_slugs),
         location_confidence = COALESCE($8, location_confidence),
         location_approximate = CASE WHEN $2::boolean THEN COALESCE($9, location_approximate) WHEN $10 IN ('review', 'failed') THEN TRUE ELSE location_approximate END,
         location_geocoded_at = CASE WHEN $2::boolean THEN NOW() WHEN $10 IN ('review', 'failed') THEN NULL ELSE location_geocoded_at END,
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
       location_country,
       location_region,
       location_market_slugs,
       location_confidence,
       location_approximate,
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
  const fetchMissing = hasFlag("--fetch-missing");
  const mode = apply ? "apply" : fetchMissing ? "dry-run-fetch-missing" : "dry-run-cache-only";
  const allowLargeBatch = hasFlag("--allow-large-batch");
  const allowPublicMapApply = hasFlag("--allow-public-map-apply");
  const includeReview = hasFlag("--include-review");
  const retryChangedReview = hasFlag("--retry-changed-review");
  const verifiedPublicPinAliases =
    hasFlag("--verified-public-pin-aliases") || hasFlag("--public-pin-aliases");
  const publicPinCandidates =
    hasFlag("--public-pin-candidates") || hasFlag("--public-pin-likely") || verifiedPublicPinAliases;
  const config = getGeocodingConfig();
  const publicMapIsEnabled = isEnabledEnvValue(process.env.PUBLIC_MAP_ENABLED);
  const earlyApplySafetyStop = getGeocodeApplySafetyStop({
    apply,
    provider: config.provider,
    providerEnabled: config.enabled,
    publicMapEnabled: publicMapIsEnabled,
    selectedUniqueQueries: 0,
    allowLargeBatch,
    allowPublicMapApply,
  });
  if (earlyApplySafetyStop) {
    console.error(earlyApplySafetyStop.message);
    console.log(JSON.stringify({
      provider: config.provider,
      enabled: config.enabled,
      mode,
      includeReview,
      retryChangedReview,
      verifiedPublicPinAliases,
      stoppedReason: earlyApplySafetyStop.stoppedReason,
    }, null, 2));
    process.exitCode = 1;
    return;
  }

  const visibleSql = buildVisibleImportQualitySql("b");
  const statusSql = includeReview
    ? "b.location_geocode_status IN ('pending', 'review', 'failed')"
    : "b.location_geocode_status = 'pending'";
  const rows = await query<BoatGeocodeCandidate>(
    `SELECT b.id, b.location_text, b.location_country, b.location_region,
            COALESCE(b.location_market_slugs, '{}') AS location_market_slugs,
            b.location_confidence, b.location_lat, b.location_lng,
            b.location_geocode_status, b.location_geocode_query
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
  const retryScopedCandidates = retryChangedReview
    ? candidates.filter(
        (candidate) =>
          candidate.geocodeQuery !== null &&
          shouldRetryChangedReviewGeocode({
            status: candidate.location_geocode_status,
            previousQueryText: candidate.location_geocode_query,
            currentQueryKey: candidate.geocodeQuery.queryKey,
          })
      )
    : candidates;
  const geocodableCandidates = retryScopedCandidates.filter(
    (candidate): candidate is ReadyCandidate => candidate.geocodeQuery !== null
  );
  const selectionCandidates = verifiedPublicPinAliases
    ? geocodableCandidates.filter((candidate) =>
        isVerifiedPublicPinAliasGeocodeCandidate({
          locationText: candidate.location_text,
          queryText: candidate.geocodeQuery.queryText,
        })
      )
    : publicPinCandidates
      ? geocodableCandidates.filter((candidate) =>
          isPublicPinLikelyGeocodeCandidate({
            locationText: candidate.location_text,
            queryText: candidate.geocodeQuery.queryText,
          })
        )
      : geocodableCandidates;
  const selectedCandidates = selectionCandidates.slice(0, limit);
  const nextCandidates = selectionCandidates.slice(limit, limit * 2);
  const uniqueReadyQueryKeys = Array.from(
    new Set(geocodableCandidates.map((candidate) => candidate.geocodeQuery.queryKey))
  );
  const uniqueSelectionQueryKeys = Array.from(
    new Set(selectionCandidates.map((candidate) => candidate.geocodeQuery.queryKey))
  );
  const selectedQueryKeys = Array.from(
    new Set(selectedCandidates.map((candidate) => candidate.geocodeQuery.queryKey))
  );
  const cacheByKey = await getCachedResults(uniqueSelectionQueryKeys, config.provider);
  let backupTable: string | null = null;
  const summary = {
    provider: config.provider,
    enabled: config.enabled,
    mode,
    includeReview,
    retryChangedReview,
    verifiedPublicPinAliases,
    selectionLane: verifiedPublicPinAliases
      ? "verified-public-pin-aliases"
      : publicPinCandidates
        ? "public-pin-candidates"
        : "default",
    totalCandidates: candidates.length,
    retryScopeCandidates: retryScopedCandidates.length,
    geocodableCandidates: geocodableCandidates.length,
    selectionCandidates: selectionCandidates.length,
    uniqueReadyQueries: uniqueReadyQueryKeys.length,
    uniqueSelectionQueries: uniqueSelectionQueryKeys.length,
    selectedRows: selectedCandidates.length,
    selectedUniqueQueries: selectedQueryKeys.length,
    cached: 0,
    uncachedSelected: 0,
    providerFetches: 0,
    dryRunProviderFetchSkipped: 0,
    publicPinEligible: 0,
    publicPinHeldBack: 0,
    publicPinEligibleRate: 0,
    geocoded: 0,
    review: 0,
    failed: 0,
    skipped: 0,
    precisionSplit: emptyPrecisionSplit(),
    statusSplit: emptyStatusSplit(),
    failureReasons: {} as Record<string, number>,
    nonGeocodableReasons: {} as Record<string, number>,
    selectedQuerySamples: selectedCandidates.slice(0, 50).map((candidate) =>
      buildSelectedQuerySample(candidate, candidate.geocodeQuery)
    ),
    auditRows: [] as GeocodeAuditRow[],
    geographyMismatches: [] as GeographyMismatch[],
    samplePins: [] as SamplePin[],
    precisionPromotions: [] as PrecisionPromotionAuditRow[],
    nextBatch: {
      rows: nextCandidates.length,
      cacheHits: 0,
      cacheHitRatio: 0,
    },
    backupTable: backupTable as string | null,
    warnings: [] as string[],
    stoppedReason: null as string | null,
  };
  const processedResults: ProcessedGeocodeResult[] = [];
  const recordProcessedResult = (
    boat: ReadyCandidate,
    geocodeQuery: ReadyCandidate["geocodeQuery"],
    result: GeocodeResult,
    source: GeocodeAuditRow["source"]
  ) => {
    processedResults.push({ boat, geocodeQuery, result, source });
    summary.statusSplit[result.status] += 1;
    summary.precisionSplit[result.precision] += 1;
    if (result.status === "geocoded") summary.geocoded += 1;
    if (result.status === "review") summary.review += 1;
    if (result.status === "failed") summary.failed += 1;
    if (result.status === "skipped") summary.skipped += 1;
    if (result.error) incrementCount(summary.failureReasons, result.error);
    if (isPublicPinEligibleResult(result)) summary.publicPinEligible += 1;
    else if (publicPinCandidates) summary.publicPinHeldBack += 1;
    if (result.precisionPromotedFrom && result.precisionPromotionAlias) {
      summary.precisionPromotions.push({
        boatId: boat.id,
        locationText: boat.location_text,
        queryText: geocodeQuery.queryText,
        source,
        alias: result.precisionPromotionAlias,
        from: result.precisionPromotedFrom,
        to: "marina",
      });
    }
    appendGeocodeAudit(summary, boat, geocodeQuery, result, source);
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

  const applySafetyStop = getGeocodeApplySafetyStop({
    apply,
    provider: config.provider,
    providerEnabled: config.enabled,
    publicMapEnabled: publicMapIsEnabled,
    selectedUniqueQueries: selectedQueryKeys.length,
    allowLargeBatch,
    allowPublicMapApply,
  });
  if (applySafetyStop) {
    summary.stoppedReason = applySafetyStop.stoppedReason;
    console.error(applySafetyStop.message);
    console.log(JSON.stringify(summary, null, 2));
    process.exitCode = 1;
    return;
  }

  for (const boat of selectedCandidates) {
    const geocodeQuery = boat.geocodeQuery;

    const cached = cacheByKey.get(geocodeQuery.queryKey) || (await getCachedResult(geocodeQuery.queryKey, config.provider));
    if (cached) {
      summary.cached += 1;
      recordProcessedResult(boat, geocodeQuery, cached, "cache");
      continue;
    }

    summary.uncachedSelected += 1;

    if (!apply && !fetchMissing) {
      summary.dryRunProviderFetchSkipped += 1;
      continue;
    }

    if (!config.enabled || config.provider === "disabled") continue;

    const result = await geocodeWithConfiguredProvider(geocodeQuery, config);
    summary.providerFetches += 1;
    recordProcessedResult(boat, geocodeQuery, result, "provider");
    if (apply && result.status !== "skipped") cacheByKey.set(geocodeQuery.queryKey, result);

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

  if (summary.dryRunProviderFetchSkipped > 0) {
    summary.warnings.push(
      `dry_run_cache_only_skipped_${summary.dryRunProviderFetchSkipped}_uncached_provider_fetches_pass_--fetch-missing_for_paid_prediction`
    );
  }

  summary.publicPinEligibleRate = getPublicPinEligibleRate(
    summary.publicPinEligible,
    summary.selectedRows
  );

  const publicPinApplyGateStop = getPublicPinApplyGateStop({
    apply,
    publicPinCandidates,
    selectedRows: summary.selectedRows,
    publicPinEligibleRate: summary.publicPinEligibleRate,
  });
  if (publicPinApplyGateStop) {
    summary.stoppedReason = publicPinApplyGateStop.stoppedReason;
    console.error(publicPinApplyGateStop.message);
    console.log(JSON.stringify(summary, null, 2));
    process.exitCode = 1;
    return;
  }

  if (apply && selectedCandidates.length > 0) {
    backupTable = await createBackupSnapshot(selectedCandidates.map((candidate) => candidate.id));
    summary.backupTable = backupTable;

    for (const processed of processedResults) {
      if (processed.result.status !== "skipped") {
        await cacheResult(
          processed.geocodeQuery.queryKey,
          processed.geocodeQuery.queryText,
          processed.result
        );
        cacheByKey.set(processed.geocodeQuery.queryKey, processed.result);
      }
      await applyResult(
        processed.boat,
        processed.geocodeQuery.queryText,
        publicPinCandidates ? getPublicPinApplyResult(processed.result) : processed.result
      );
    }
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
