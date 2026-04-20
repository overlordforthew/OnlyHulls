import { pool, query, queryOne } from "../src/lib/db/index";
import { buildVisibleImportQualitySql } from "../src/lib/import-quality";
import { buildGeocodeQuery, getGeocodeCandidateReason, getGeocodingConfig } from "../src/lib/locations/geocoding";
import { PUBLIC_MAP_PRECISIONS } from "../src/lib/locations/map-coordinates";

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
  stale_public_coordinate_count: string;
};

type CandidateRow = {
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
const SINGLE_ERROR_MAX = 20;

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

function addCount(record: Record<string, number>, key: string) {
  record[key] = (record[key] || 0) + 1;
}

async function main() {
  const config = getGeocodingConfig();
  const publicPrecisions = [...PUBLIC_MAP_PRECISIONS];

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
           AND b.location_geocoded_at < NOW() - INTERVAL '90 days'
       )::text AS stale_public_coordinate_count
     FROM boats b
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE ${ACTIVE_VISIBLE_SQL}`,
    [publicPrecisions, PUBLIC_ADMIN_BOUNDARY_TYPES]
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
  const publicCoverageRate = percent(publicPinCount, activeVisibleCount);
  const pendingReadyRate = percent(pendingReadyCount, activeVisibleCount);
  const topError = errorRows[0] || null;
  const topErrorRate = topError ? percent(parseCount(topError.count), reviewFailedCount) : 0;

  const gates = [
    {
      key: "paid_provider_configured",
      target: "LOCATION_GEOCODING_PROVIDER=opencage with a configured API key",
      actual: `${config.provider}:${config.enabled ? "configured" : "not_configured"}`,
      passed: config.provider === "opencage" && config.enabled,
    },
    {
      key: "public_pin_coverage",
      target: `>=${COVERAGE_TARGET}% active visible listings have exact/street/marina pins`,
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
      key: "review_failed_rate",
      target: `<${REVIEW_FAILED_MAX}% of attempted geocodes are review/failed`,
      actual: attemptedCount > 0 ? `${reviewFailedRate}%` : "no attempts yet",
      passed: attemptedCount > 0 && reviewFailedRate < REVIEW_FAILED_MAX,
    },
    {
      key: "single_error_concentration",
      target: `No review/failed error bucket over ${SINGLE_ERROR_MAX}%`,
      actual: topError ? `${topError.label}:${topErrorRate}%` : "none",
      passed: !topError || topErrorRate <= SINGLE_ERROR_MAX,
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
      publicPinCount,
      publicCoverageRate,
      rawCoordinateCount: parseCount(summary?.raw_coordinate_count),
      heldBackCoordinateCount:
        parseCount(summary?.raw_coordinate_count) - publicPinCount,
      cityCoordinateCount: parseCount(summary?.city_coordinate_count),
      regionalCoordinateCount: parseCount(summary?.regional_coordinate_count),
      precisionSplit: toCountMap(precisionRows),
      providerSplit: toCountMap(providerRows),
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
      })),
    },
    invariants: {
      publicAdminBoundaryCount: parseCount(summary?.public_admin_boundary_count),
      invalidPublicCoordinateCount: parseCount(summary?.invalid_public_coordinate_count),
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
