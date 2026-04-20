import fs from "fs";
import path from "path";

import { pool, query, queryOne } from "../src/lib/db/index";
import { buildVisibleImportQualitySql } from "../src/lib/import-quality";
import { buildGeocodeQuery, getGeocodeCandidateReason, getGeocodingConfig } from "../src/lib/locations/geocoding";
import { compareGeocodeResults, type ComparableGeocodeResult } from "../src/lib/locations/geocode-compare";
import { PUBLIC_MAP_PRECISIONS } from "../src/lib/locations/map-coordinates";
import { classifyGeocodeReviewIssue, isProviderSideGeocodeError } from "../src/lib/locations/geocode-triage";
import { resolveLocationCountryHint } from "../src/lib/locations/top-markets";

type SummaryRow = {
  active_visible_count: string;
  public_pin_count: string;
  raw_coordinate_count: string;
  city_coordinate_count: string;
  regional_coordinate_count: string;
  geocoded_count: string;
  review_count: string;
  failed_count: string;
  invalid_public_coordinate_count: string;
  public_admin_boundary_count: string;
  public_missing_metadata_count: string;
  low_score_public_pin_count: string;
  stale_public_coordinate_count: string;
};

type CandidateRow = {
  slug?: string;
  location_text: string | null;
  location_country: string | null;
  location_region: string | null;
  location_market_slugs: string[];
  location_confidence: string | null;
};

type CountRow = {
  label: string;
  count: string;
};

type CoverageRow = {
  label: string;
  active_visible_count: string;
  public_pin_count: string;
};

type CacheRow = {
  query_key: string;
  provider: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  precision: string | null;
  score: number | null;
  place_name: string | null;
  payload: unknown;
  error: string | null;
};

type ReviewTriageRow = {
  status: string;
  error: string | null;
  precision: string | null;
  score: number | null;
  place_name: string | null;
};

type ReviewQueryCountRow = {
  status: string;
  query_text: string;
  error: string;
  provider: string;
  count: string;
  last_attempted_at: string | null;
  sample_slugs: string[];
};

type CompareArtifact = {
  generatedAt?: string;
  mode?: string;
  goldenAccuracy?: {
    status?: string;
    medianDistanceKm?: number | null;
    precisionMatchRate?: number | null;
  };
};

type PublicPinSampleRow = {
  slug: string;
  location_text: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  precision: string | null;
  provider: string | null;
  place_name: string | null;
};

const ACTIVE_VISIBLE_SQL = `
  b.status = 'active'
  AND ${buildVisibleImportQualitySql("b")}
`;

const PUBLIC_ADMIN_BOUNDARY_TYPES = [
  "state",
  "region",
  "province",
  "county",
  "island",
  "body_of_water",
  "country",
];

const COVERAGE_TARGET = 85;
const PENDING_READY_MAX = 10;
const REVIEW_FAILED_MAX = 5;
const PROVIDER_ERROR_MAX = 5;
const REGIONAL_COVERAGE_TARGET = 60;
const REGIONAL_COVERAGE_MIN_LISTINGS = 50;
const PUBLIC_PIN_SCORE_MIN = 0.7;
const CROSS_PROVIDER_MIN_SAMPLES = 100;
const CROSS_PROVIDER_AGREEMENT_TARGET = 95;
const GOLDEN_ARTIFACT_MAX_AGE_DAYS = 30;
const GOLDEN_MEDIAN_DISTANCE_TARGET_KM = 1;
const GOLDEN_PRECISION_MATCH_TARGET = 80;

function parseCount(value: string | null | undefined) {
  return Number.parseInt(value || "0", 10);
}

function percent(value: number, total: number) {
  if (total <= 0) return 0;
  return Number(((value / total) * 100).toFixed(2));
}

function toCountMap(rows: CountRow[]) {
  return Object.fromEntries(rows.map((row) => [row.label, parseCount(row.count)]));
}

function sortEntries(record: Record<string, number>) {
  return Object.entries(record)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label, count]) => ({ label, count }));
}

function normalizeAuditValue(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function addCount(record: Record<string, number>, key: string) {
  record[key] = (record[key] || 0) + 1;
}

function toComparable(row: CacheRow): ComparableGeocodeResult {
  return {
    provider: row.provider,
    status: row.status,
    latitude: row.latitude,
    longitude: row.longitude,
    precision: row.precision,
    score: row.score,
    placeName: row.place_name,
    payload: row.payload,
    error: row.error,
  };
}

function readCompareArtifact(): CompareArtifact | null {
  const artifactPath =
    process.env.GEOCODE_COMPARE_ARTIFACT ||
    path.join(process.cwd(), "tmp", "geocode-compare-latest.json");
  if (!fs.existsSync(artifactPath)) return null;

  try {
    return JSON.parse(fs.readFileSync(artifactPath, "utf8")) as CompareArtifact;
  } catch {
    return null;
  }
}

function getArtifactAgeDays(artifact: CompareArtifact | null) {
  if (!artifact?.generatedAt) return null;
  const generatedAt = new Date(artifact.generatedAt).getTime();
  if (!Number.isFinite(generatedAt)) return null;

  return (Date.now() - generatedAt) / 86_400_000;
}

async function main() {
  const config = getGeocodingConfig();
  const publicPrecisions = [...PUBLIC_MAP_PRECISIONS];
  const compareArtifact = readCompareArtifact();

  const summary = await queryOne<SummaryRow>(
    `SELECT
       COUNT(*)::text AS active_visible_count,
       COUNT(*) FILTER (
         WHERE b.location_lat BETWEEN -90 AND 90
           AND b.location_lng BETWEEN -180 AND 180
           AND b.location_geocode_precision = ANY($1::text[])
       )::text AS public_pin_count,
       COUNT(*) FILTER (
         WHERE b.location_lat BETWEEN -90 AND 90
           AND b.location_lng BETWEEN -180 AND 180
       )::text AS raw_coordinate_count,
       COUNT(*) FILTER (
         WHERE b.location_lat BETWEEN -90 AND 90
           AND b.location_lng BETWEEN -180 AND 180
           AND b.location_geocode_precision = 'city'
       )::text AS city_coordinate_count,
       COUNT(*) FILTER (
         WHERE b.location_lat BETWEEN -90 AND 90
           AND b.location_lng BETWEEN -180 AND 180
           AND b.location_geocode_precision IN ('region', 'country', 'unknown')
       )::text AS regional_coordinate_count,
       COUNT(*) FILTER (WHERE b.location_geocode_status = 'geocoded')::text AS geocoded_count,
       COUNT(*) FILTER (WHERE b.location_geocode_status = 'review')::text AS review_count,
       COUNT(*) FILTER (WHERE b.location_geocode_status = 'failed')::text AS failed_count,
       COUNT(*) FILTER (
         WHERE b.location_geocode_precision = ANY($1::text[])
           AND NOT (
             b.location_lat IS NOT NULL
             AND b.location_lng IS NOT NULL
             AND b.location_lat BETWEEN -90 AND 90
             AND b.location_lng BETWEEN -180 AND 180
           )
       )::text AS invalid_public_coordinate_count,
       COUNT(*) FILTER (
         WHERE b.location_lat BETWEEN -90 AND 90
           AND b.location_lng BETWEEN -180 AND 180
           AND b.location_geocode_precision = ANY($1::text[])
           AND (
             COALESCE(b.location_geocode_payload->>'addresstype', '') = ANY($2::text[])
             OR COALESCE(b.location_geocode_payload->'components'->>'_type', '') = ANY($2::text[])
           )
       )::text AS public_admin_boundary_count,
       COUNT(*) FILTER (
         WHERE b.location_lat BETWEEN -90 AND 90
           AND b.location_lng BETWEEN -180 AND 180
           AND b.location_geocode_precision = ANY($1::text[])
           AND (
             b.location_geocode_provider IS NULL
             OR b.location_geocode_score IS NULL
             OR b.location_geocoded_at IS NULL
           )
       )::text AS public_missing_metadata_count,
       COUNT(*) FILTER (
         WHERE b.location_lat BETWEEN -90 AND 90
           AND b.location_lng BETWEEN -180 AND 180
           AND b.location_geocode_precision = ANY($1::text[])
           AND COALESCE(b.location_geocode_score, 0) < $3
       )::text AS low_score_public_pin_count,
       COUNT(*) FILTER (
         WHERE b.location_lat BETWEEN -90 AND 90
           AND b.location_lng BETWEEN -180 AND 180
           AND b.location_geocode_precision = ANY($1::text[])
           AND b.location_geocoded_at < NOW() - INTERVAL '90 days'
       )::text AS stale_public_coordinate_count
     FROM boats b
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE ${ACTIVE_VISIBLE_SQL}`,
    [publicPrecisions, PUBLIC_ADMIN_BOUNDARY_TYPES, PUBLIC_PIN_SCORE_MIN]
  );

  const precisionRows = await query<CountRow>(
    `SELECT COALESCE(b.location_geocode_precision, 'none') AS label,
            COUNT(*)::text AS count
     FROM boats b
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE ${ACTIVE_VISIBLE_SQL}
       AND b.location_lat BETWEEN -90 AND 90
       AND b.location_lng BETWEEN -180 AND 180
     GROUP BY COALESCE(b.location_geocode_precision, 'none')
     ORDER BY COUNT(*) DESC, COALESCE(b.location_geocode_precision, 'none')`
  );

  const providerRows = await query<CountRow>(
    `SELECT COALESCE(b.location_geocode_provider, 'none') AS label,
            COUNT(*)::text AS count
     FROM boats b
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE ${ACTIVE_VISIBLE_SQL}
       AND b.location_lat BETWEEN -90 AND 90
       AND b.location_lng BETWEEN -180 AND 180
     GROUP BY COALESCE(b.location_geocode_provider, 'none')
     ORDER BY COUNT(*) DESC, COALESCE(b.location_geocode_provider, 'none')`
  );

  const errorRows = await query<CountRow>(
    `SELECT COALESCE(NULLIF(b.location_geocode_error, ''), 'unknown') AS label,
            COUNT(*)::text AS count
     FROM boats b
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE ${ACTIVE_VISIBLE_SQL}
       AND b.location_geocode_status IN ('review', 'failed')
     GROUP BY COALESCE(NULLIF(b.location_geocode_error, ''), 'unknown')
     ORDER BY COUNT(*) DESC, COALESCE(NULLIF(b.location_geocode_error, ''), 'unknown')
     LIMIT 12`
  );

  const reviewTriageRows = await query<ReviewTriageRow>(
    `SELECT b.location_geocode_status AS status,
            b.location_geocode_error AS error,
            b.location_geocode_precision AS precision,
            b.location_geocode_score AS score,
            b.location_geocode_place_name AS place_name
     FROM boats b
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE ${ACTIVE_VISIBLE_SQL}
       AND b.location_geocode_status IN ('review', 'failed')
     ORDER BY b.location_geocode_attempted_at DESC NULLS LAST
     LIMIT 5000`
  );

  const reviewQueryRows = await query<ReviewQueryCountRow>(
    `SELECT b.location_geocode_status AS status,
            COALESCE(NULLIF(b.location_geocode_query, ''), NULLIF(b.location_text, ''), 'missing_query') AS query_text,
            COALESCE(NULLIF(b.location_geocode_error, ''), 'unknown') AS error,
            COALESCE(NULLIF(b.location_geocode_provider, ''), 'unknown') AS provider,
            COUNT(*)::text AS count,
            MAX(b.location_geocode_attempted_at) AS last_attempted_at,
            (ARRAY_AGG(b.slug ORDER BY b.location_geocode_attempted_at DESC NULLS LAST, b.slug))[1:3] AS sample_slugs
     FROM boats b
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE ${ACTIVE_VISIBLE_SQL}
       AND b.location_geocode_status IN ('review', 'failed')
     GROUP BY b.location_geocode_status,
              COALESCE(NULLIF(b.location_geocode_query, ''), NULLIF(b.location_text, ''), 'missing_query'),
              COALESCE(NULLIF(b.location_geocode_error, ''), 'unknown'),
              COALESCE(NULLIF(b.location_geocode_provider, ''), 'unknown')
     ORDER BY COUNT(*) DESC, MAX(b.location_geocode_attempted_at) DESC NULLS LAST
     LIMIT 20`
  );

  const candidateRows = await query<CandidateRow>(
    `SELECT b.location_text,
            b.location_country,
            b.location_region,
            COALESCE(b.location_market_slugs, '{}') AS location_market_slugs,
            b.location_confidence
     FROM boats b
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE ${ACTIVE_VISIBLE_SQL}
       AND COALESCE(NULLIF(TRIM(b.location_text), ''), '') <> ''
       AND (
         b.location_lat IS NULL
         OR b.location_lng IS NULL
         OR b.location_lat NOT BETWEEN -90 AND 90
         OR b.location_lng NOT BETWEEN -180 AND 180
       )
       AND b.location_geocode_status = 'pending'
     ORDER BY b.updated_at DESC, b.id`
  );

  const activeLocationRows = await query<CandidateRow>(
    `SELECT b.slug,
            b.location_text,
            b.location_country,
            b.location_region,
            COALESCE(b.location_market_slugs, '{}') AS location_market_slugs,
            b.location_confidence
     FROM boats b
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE ${ACTIVE_VISIBLE_SQL}
       AND COALESCE(NULLIF(TRIM(b.location_text), ''), '') <> ''
     ORDER BY b.id`
  );

  const regionalCoverageRows = await query<CoverageRow>(
    `SELECT COALESCE(NULLIF(TRIM(b.location_country), ''), 'Unknown') AS label,
            COUNT(*)::text AS active_visible_count,
            COUNT(*) FILTER (
              WHERE b.location_lat BETWEEN -90 AND 90
                AND b.location_lng BETWEEN -180 AND 180
                AND b.location_geocode_precision = ANY($1::text[])
            )::text AS public_pin_count
     FROM boats b
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE ${ACTIVE_VISIBLE_SQL}
     GROUP BY COALESCE(NULLIF(TRIM(b.location_country), ''), 'Unknown')
     HAVING COUNT(*) >= $2
     ORDER BY (
       COUNT(*) FILTER (
         WHERE b.location_lat BETWEEN -90 AND 90
           AND b.location_lng BETWEEN -180 AND 180
           AND b.location_geocode_precision = ANY($1::text[])
       )::float / NULLIF(COUNT(*), 0)
     ) ASC,
     COUNT(*) DESC,
     COALESCE(NULLIF(TRIM(b.location_country), ''), 'Unknown')
     LIMIT 20`,
    [publicPrecisions, REGIONAL_COVERAGE_MIN_LISTINGS]
  );

  const crossProviderCacheRows = await query<CacheRow>(
    `SELECT query_key,
            provider,
            status,
            latitude,
            longitude,
            precision,
            score,
            place_name,
            payload,
            error
     FROM location_geocode_cache
     WHERE provider IN ('nominatim', 'opencage')
     ORDER BY query_key, provider`
  );

  let geocodableAddressCount = 0;
  const geocodableReasons: Record<string, number> = {};
  const countryHintMismatches = activeLocationRows
    .map((row) => {
      const hint = resolveLocationCountryHint(row.location_text);
      if (!hint) return null;
      const storedCountry = normalizeAuditValue(row.location_country);
      if (storedCountry === normalizeAuditValue(hint.country)) return null;

      return {
        slug: row.slug || null,
        locationText: row.location_text,
        storedCountry: row.location_country || null,
        expectedCountry: hint.country,
        expectedRegion: hint.region,
        matchedTerm: hint.matchedTerm,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
  for (const row of activeLocationRows) {
    const reason = getGeocodeCandidateReason({
      locationText: row.location_text,
      country: row.location_country,
      region: row.location_region,
      marketSlugs: row.location_market_slugs,
      confidence: row.location_confidence,
    });
    addCount(geocodableReasons, reason);
    if (reason === "ready") geocodableAddressCount += 1;
  }

  const pendingReasons: Record<string, number> = {};
  const pendingQueries: Record<string, { count: number; queryText: string }> = {};
  let pendingReadyCount = 0;
  const uniqueReadyQueries = new Set<string>();

  for (const candidate of candidateRows) {
    const geocodeQuery = buildGeocodeQuery({
      locationText: candidate.location_text,
      country: candidate.location_country,
      region: candidate.location_region,
      marketSlugs: candidate.location_market_slugs,
      confidence: candidate.location_confidence,
    });
    const reason = getGeocodeCandidateReason({
      locationText: candidate.location_text,
      country: candidate.location_country,
      region: candidate.location_region,
      marketSlugs: candidate.location_market_slugs,
      confidence: candidate.location_confidence,
    });

    addCount(pendingReasons, reason);
    if (!geocodeQuery) continue;

    pendingReadyCount += 1;
    uniqueReadyQueries.add(geocodeQuery.queryKey);
    pendingQueries[geocodeQuery.queryKey] = {
      count: (pendingQueries[geocodeQuery.queryKey]?.count || 0) + 1,
      queryText: geocodeQuery.queryText,
    };
  }

  const samplePublicPins = await query<PublicPinSampleRow>(
    `SELECT b.slug,
            b.location_text,
            b.location_lat AS latitude,
            b.location_lng AS longitude,
            b.location_geocode_precision AS precision,
            b.location_geocode_provider AS provider,
            b.location_geocode_place_name AS place_name
     FROM boats b
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE ${ACTIVE_VISIBLE_SQL}
       AND b.location_lat BETWEEN -90 AND 90
       AND b.location_lng BETWEEN -180 AND 180
       AND b.location_geocode_precision = ANY($1::text[])
     ORDER BY b.updated_at DESC, b.slug
     LIMIT 20`,
    [publicPrecisions]
  );

  const activeVisibleCount = parseCount(summary?.active_visible_count);
  const publicPinCount = parseCount(summary?.public_pin_count);
  const geocodedCount = parseCount(summary?.geocoded_count);
  const reviewCount = parseCount(summary?.review_count);
  const failedCount = parseCount(summary?.failed_count);
  const attemptedCount = geocodedCount + reviewCount + failedCount;
  const reviewFailedCount = reviewCount + failedCount;
  const reviewFailedRate = percent(reviewFailedCount, attemptedCount);
  const publicCoverageRate = percent(publicPinCount, geocodableAddressCount);
  const activeVisiblePublicCoverageRate = percent(publicPinCount, activeVisibleCount);
  const pendingReadyRate = percent(pendingReadyCount, activeVisibleCount);
  const providerErrorRows = errorRows.filter((row) => isProviderSideGeocodeError(row.label));
  const topProviderError = providerErrorRows[0] || null;
  const topProviderErrorRate = topProviderError
    ? percent(parseCount(topProviderError.count), attemptedCount)
    : 0;
  const cacheByQuery = new Map<string, Map<string, ComparableGeocodeResult>>();
  for (const row of crossProviderCacheRows) {
    const queryCache = cacheByQuery.get(row.query_key) || new Map<string, ComparableGeocodeResult>();
    queryCache.set(row.provider, toComparable(row));
    cacheByQuery.set(row.query_key, queryCache);
  }

  let crossProviderComparableCount = 0;
  let crossProviderWithin10kmCount = 0;
  let crossProviderCountryMismatchCount = 0;
  let crossProviderPrecisionMismatchCount = 0;
  for (const queryCache of cacheByQuery.values()) {
    const comparison = compareGeocodeResults(
      queryCache.get("nominatim") || null,
      queryCache.get("opencage") || null
    );
    if (!comparison.comparable) continue;
    crossProviderComparableCount += 1;
    if (comparison.distanceBucket === "under_1km" || comparison.distanceBucket === "under_10km") {
      crossProviderWithin10kmCount += 1;
    }
    if (comparison.countryAgreement === false) crossProviderCountryMismatchCount += 1;
    if (comparison.precisionAgreement === false) crossProviderPrecisionMismatchCount += 1;
  }
  const crossProviderAgreementRate = percent(crossProviderWithin10kmCount, crossProviderComparableCount);
  const compareArtifactAgeDays = getArtifactAgeDays(compareArtifact);
  const goldenAccuracy = compareArtifact?.goldenAccuracy || null;
  const goldenArtifactFresh =
    typeof compareArtifactAgeDays === "number" &&
    compareArtifactAgeDays >= 0 &&
    compareArtifactAgeDays <= GOLDEN_ARTIFACT_MAX_AGE_DAYS;
  const goldenGatePassed =
    goldenArtifactFresh &&
    goldenAccuracy?.status === "passing" &&
    typeof goldenAccuracy.medianDistanceKm === "number" &&
    goldenAccuracy.medianDistanceKm <= GOLDEN_MEDIAN_DISTANCE_TARGET_KM &&
    typeof goldenAccuracy.precisionMatchRate === "number" &&
    goldenAccuracy.precisionMatchRate >= GOLDEN_PRECISION_MATCH_TARGET;
  const failingRegionalBuckets = regionalCoverageRows
    .map((row) => ({
      label: row.label,
      activeVisibleCount: parseCount(row.active_visible_count),
      publicPinCount: parseCount(row.public_pin_count),
      publicCoverageRate: percent(parseCount(row.public_pin_count), parseCount(row.active_visible_count)),
    }))
    .filter((row) => row.publicCoverageRate < REGIONAL_COVERAGE_TARGET);
  const triageByCategory: Record<string, number> = {};
  const triageByAction: Record<string, number> = {};
  let triageRetryableCount = 0;
  for (const row of reviewTriageRows) {
    const triage = classifyGeocodeReviewIssue({
      status: row.status,
      error: row.error,
      precision: row.precision,
      score: row.score,
      placeName: row.place_name,
    });
    triageByCategory[triage.category] = (triageByCategory[triage.category] || 0) + 1;
    triageByAction[triage.action] = (triageByAction[triage.action] || 0) + 1;
    if (triage.retryable) triageRetryableCount += 1;
  }
  const formatReviewQuery = (row: ReviewQueryCountRow) => ({
    queryText: row.query_text,
    count: parseCount(row.count),
    error: row.error,
    provider: row.provider,
    providerSide: isProviderSideGeocodeError(row.error),
    lastAttemptedAt: row.last_attempted_at,
    sampleSlugs: row.sample_slugs || [],
    triage: classifyGeocodeReviewIssue({
      status: row.status,
      error: row.error,
    }),
  });

  const gates = [
    {
      key: "paid_provider_configured",
      target: "LOCATION_GEOCODING_PROVIDER=opencage with a configured API key",
      actual: `${config.provider}:${config.enabled ? "configured" : "not_configured"}`,
      passed: config.provider === "opencage" && config.enabled,
    },
    {
      key: "golden_set_accuracy",
      target: `fresh <=${GOLDEN_ARTIFACT_MAX_AGE_DAYS}d golden comparison artifact, median <=${GOLDEN_MEDIAN_DISTANCE_TARGET_KM}km, precision match >=${GOLDEN_PRECISION_MATCH_TARGET}%`,
      actual: compareArtifact
        ? `${goldenAccuracy?.status || "not_golden"}, age=${compareArtifactAgeDays === null ? "unknown" : Number(compareArtifactAgeDays.toFixed(1))}d`
        : "missing_artifact",
      passed: goldenGatePassed,
    },
    {
      key: "public_pin_coverage",
      target: `>=${COVERAGE_TARGET}% geocodable-address listings have exact/street/marina pins`,
      actual: `${publicCoverageRate}%`,
      passed: publicCoverageRate >= COVERAGE_TARGET,
    },
    {
      key: "pending_ready_queue",
      target: `<${PENDING_READY_MAX}% active visible listings remain coordinate-ready and pending`,
      actual: `${pendingReadyRate}%`,
      passed: pendingReadyRate < PENDING_READY_MAX,
    },
    {
      key: "country_hint_mismatch_zero",
      target: "0 active visible listings where explicit country/state text conflicts with stored location_country",
      actual: countryHintMismatches.length,
      passed: countryHintMismatches.length === 0,
    },
    {
      key: "review_failed_rate",
      target: `<${REVIEW_FAILED_MAX}% of attempted geocodes are review/failed`,
      actual: attemptedCount > 0 ? `${reviewFailedRate}%` : "no attempts yet",
      passed: attemptedCount > 0 && reviewFailedRate < REVIEW_FAILED_MAX,
    },
    {
      key: "provider_error_rate",
      target: `No provider-side error bucket over ${PROVIDER_ERROR_MAX}% of attempted geocodes`,
      actual: topProviderError ? `${topProviderError.label}:${topProviderErrorRate}%` : "none",
      passed: !topProviderError || topProviderErrorRate <= PROVIDER_ERROR_MAX,
    },
    {
      key: "regional_coverage_floor",
      target: `No country with >=${REGIONAL_COVERAGE_MIN_LISTINGS} visible listings below ${REGIONAL_COVERAGE_TARGET}% public-pin coverage`,
      actual: `${failingRegionalBuckets.length} failing countries`,
      passed: failingRegionalBuckets.length === 0,
    },
    {
      key: "public_admin_boundary_zero",
      target: "0 public pins classified from admin boundaries",
      actual: parseCount(summary?.public_admin_boundary_count),
      passed: parseCount(summary?.public_admin_boundary_count) === 0,
    },
    {
      key: "invalid_public_coordinates_zero",
      target: "0 public precision rows with invalid/missing coordinates",
      actual: parseCount(summary?.invalid_public_coordinate_count),
      passed: parseCount(summary?.invalid_public_coordinate_count) === 0,
    },
    {
      key: "public_pin_metadata_complete",
      target: "0 public pins missing provider, score, or geocoded_at",
      actual: parseCount(summary?.public_missing_metadata_count),
      passed: parseCount(summary?.public_missing_metadata_count) === 0,
    },
    {
      key: "public_pin_score_floor",
      target: `0 public pins below score ${PUBLIC_PIN_SCORE_MIN}`,
      actual: parseCount(summary?.low_score_public_pin_count),
      passed: parseCount(summary?.low_score_public_pin_count) === 0,
    },
    {
      key: "stale_public_coordinates_zero",
      target: "0 public pins older than 90 days before re-verification exists",
      actual: parseCount(summary?.stale_public_coordinate_count),
      passed: parseCount(summary?.stale_public_coordinate_count) === 0,
    },
  ];

  const report = {
    verdict: gates.every((gate) => gate.passed)
      ? "GO_MAP_DATA_READY"
      : "NO_GO_KEEP_PUBLIC_MAP_DISABLED",
    generatedAt: new Date().toISOString(),
    provider: {
      configuredProvider: config.provider,
      enabled: config.enabled,
      publicMapPrecisions: publicPrecisions,
    },
    coverage: {
      activeVisibleCount,
      geocodableAddressCount,
      publicPinCount,
      publicCoverageRate,
      activeVisiblePublicCoverageRate,
      rawCoordinateCount: parseCount(summary?.raw_coordinate_count),
      heldBackCoordinateCount:
        parseCount(summary?.raw_coordinate_count) - publicPinCount,
      cityCoordinateCount: parseCount(summary?.city_coordinate_count),
      regionalCoordinateCount: parseCount(summary?.regional_coordinate_count),
      precisionSplit: toCountMap(precisionRows),
      providerSplit: toCountMap(providerRows),
      geocodableReasons: sortEntries(geocodableReasons),
      countryHintMismatches: {
        count: countryHintMismatches.length,
        sample: countryHintMismatches.slice(0, 20),
      },
      regionalCoverage: regionalCoverageRows.map((row) => ({
        country: row.label,
        activeVisibleCount: parseCount(row.active_visible_count),
        publicPinCount: parseCount(row.public_pin_count),
        publicCoverageRate: percent(parseCount(row.public_pin_count), parseCount(row.active_visible_count)),
      })),
      failingRegionalCoverage: failingRegionalBuckets,
    },
    queue: {
      pendingRows: candidateRows.length,
      pendingReadyCount,
      pendingReadyRate,
      uniqueReadyQueries: uniqueReadyQueries.size,
      pendingReasons: sortEntries(pendingReasons),
      topReadyQueries: Object.values(pendingQueries)
        .sort((a, b) => b.count - a.count || a.queryText.localeCompare(b.queryText))
        .slice(0, 12),
    },
    attempted: {
      attemptedCount,
      geocodedCount,
      reviewCount,
      failedCount,
      reviewFailedRate,
      topErrors: errorRows.map((row) => ({
        error: row.label,
        count: parseCount(row.count),
        rateOfReviewFailed: percent(parseCount(row.count), reviewFailedCount),
        providerSide: isProviderSideGeocodeError(row.label),
        rateOfAttempts: percent(parseCount(row.count), attemptedCount),
      })),
      triage: {
        reviewFailedRowsSampled: reviewTriageRows.length,
        retryableCount: triageRetryableCount,
        byCategory: triageByCategory,
        byAction: triageByAction,
      },
      topReviewQueries: reviewQueryRows
        .filter((row) => row.status === "review")
        .map(formatReviewQuery)
        .slice(0, 10),
      topFailedQueries: reviewQueryRows
        .filter((row) => row.status === "failed")
        .map(formatReviewQuery)
        .slice(0, 10),
    },
    crossProvider: {
      status:
        crossProviderComparableCount >= CROSS_PROVIDER_MIN_SAMPLES &&
        crossProviderAgreementRate >= CROSS_PROVIDER_AGREEMENT_TARGET
          ? "passing_advisory"
          : crossProviderComparableCount > 0
            ? "failing_advisory"
            : "absent_advisory",
      comparableCount: crossProviderComparableCount,
      agreementWithin10kmCount: crossProviderWithin10kmCount,
      agreementWithin10kmRate: crossProviderAgreementRate,
      countryMismatchCount: crossProviderCountryMismatchCount,
      precisionMismatchCount: crossProviderPrecisionMismatchCount,
      minimumSamples: CROSS_PROVIDER_MIN_SAMPLES,
      agreementTarget: CROSS_PROVIDER_AGREEMENT_TARGET,
    },
    goldenAccuracy: {
      status: goldenGatePassed ? "passing" : compareArtifact ? "failing" : "missing_artifact",
      artifactGeneratedAt: compareArtifact?.generatedAt || null,
      artifactAgeDays:
        compareArtifactAgeDays === null ? null : Number(compareArtifactAgeDays.toFixed(2)),
      medianDistanceKm: goldenAccuracy?.medianDistanceKm ?? null,
      precisionMatchRate: goldenAccuracy?.precisionMatchRate ?? null,
      targetMedianDistanceKm: GOLDEN_MEDIAN_DISTANCE_TARGET_KM,
      targetPrecisionMatchRate: GOLDEN_PRECISION_MATCH_TARGET,
    },
    invariants: {
      publicAdminBoundaryCount: parseCount(summary?.public_admin_boundary_count),
      invalidPublicCoordinateCount: parseCount(summary?.invalid_public_coordinate_count),
      publicMissingMetadataCount: parseCount(summary?.public_missing_metadata_count),
      lowScorePublicPinCount: parseCount(summary?.low_score_public_pin_count),
      stalePublicCoordinateCount: parseCount(summary?.stale_public_coordinate_count),
    },
    gates,
    samplePublicPins: samplePublicPins.map((row) => ({
      slug: row.slug,
      locationText: row.location_text,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      precision: row.precision,
      provider: row.provider,
      placeName: row.place_name,
    })),
  };

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
