import { pool, query } from "../src/lib/db/index";
import { buildVisibleImportQualitySql } from "../src/lib/import-quality";
import {
  buildGeocodeQuery,
  getGeocodeCandidateReason,
  getGeocodingConfig,
} from "../src/lib/locations/geocoding";

type ReviewRow = {
  id: string;
  slug: string;
  location_text: string | null;
  location_country: string | null;
  location_region: string | null;
  location_market_slugs: string[];
  location_confidence: string | null;
  location_geocode_status: string;
  location_geocode_query: string | null;
  location_geocode_error: string | null;
};

type CacheRow = {
  query_key: string;
  query_text: string;
  provider: string;
  precision: string | null;
  place_name: string | null;
  error: string | null;
  updated_at: string | null;
};

type BoatResetRow = {
  id: string;
  slug: string;
  location_text: string | null;
  location_geocode_query: string | null;
  location_geocode_place_name: string | null;
};

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 2000;
const DEFAULT_CACHE_LIMIT = 100;
const MARINE_CITY_CACHE_PATTERN =
  "(^|[^[:alnum:]])(marina|marine|harbour|harbor|yacht|yachtclub|havn|haven|dock)([^[:alnum:]]|$)";

function getArgValue(name: string) {
  const prefix = `${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : null;
}

function getBoundedInt(name: string, fallback: number) {
  const parsed = Number(getArgValue(name) || fallback);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), MAX_LIMIT) : fallback;
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function formatBackupTableName(prefix: string) {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
  return `${prefix}_${stamp}`;
}

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function increment(record: Record<string, number>, key: string | null | undefined) {
  const normalized = key || "unknown";
  record[normalized] = (record[normalized] || 0) + 1;
}

function buildCurrentGeocodeState(row: ReviewRow) {
  const input = {
    locationText: row.location_text,
    country: row.location_country,
    region: row.location_region,
    marketSlugs: row.location_market_slugs,
    confidence: row.location_confidence,
  };

  return {
    query: buildGeocodeQuery(input),
    reason: getGeocodeCandidateReason(input),
  };
}

async function backupBoats(tableName: string, boatIds: string[]) {
  if (boatIds.length === 0) return;
  await query(
    `CREATE TABLE ${tableName} AS
     SELECT
       b.*,
       NOW() AS backed_up_at
     FROM boats b
     WHERE b.id = ANY($1::uuid[])`,
    [boatIds]
  );
}

async function backupCache(tableName: string, provider: string, queryKeys: string[]) {
  if (queryKeys.length === 0) return;
  await query(
    `CREATE TABLE ${tableName} AS
     SELECT
       c.*,
       NOW() AS backed_up_at
     FROM location_geocode_cache c
     WHERE c.provider = $1
       AND c.query_key = ANY($2::text[])`,
    [provider, queryKeys]
  );
}

async function resetBoatsToPending(boatIds: string[]) {
  if (boatIds.length === 0) return;
  await query(
    `UPDATE boats
     SET location_lat = NULL,
         location_lng = NULL,
         location_geocoded_at = NULL,
         location_approximate = TRUE,
         location_geocode_status = 'pending',
         location_geocode_provider = NULL,
         location_geocode_query = NULL,
         location_geocode_place_name = NULL,
         location_geocode_precision = NULL,
         location_geocode_score = NULL,
         location_geocode_error = NULL,
         location_geocode_attempted_at = NULL,
         location_geocode_payload = NULL,
         updated_at = NOW()
     WHERE id = ANY($1::uuid[])`,
    [boatIds]
  );
}

async function main() {
  const apply = hasFlag("--apply");
  const limit = getBoundedInt("--limit", DEFAULT_LIMIT);
  const cacheLimit = getBoundedInt("--cache-limit", DEFAULT_CACHE_LIMIT);
  const provider = getArgValue("--provider") || getGeocodingConfig().provider;
  const visibleSql = buildVisibleImportQualitySql("b");

  const reviewRows = await query<ReviewRow>(
    `SELECT b.id,
            b.slug,
            b.location_text,
            b.location_country,
            b.location_region,
            COALESCE(b.location_market_slugs, '{}') AS location_market_slugs,
            b.location_confidence,
            b.location_geocode_status,
            b.location_geocode_query,
            b.location_geocode_error
     FROM boats b
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE b.status = 'active'
       AND ${visibleSql}
       AND b.location_geocode_status IN ('review', 'failed')
     ORDER BY b.location_geocode_attempted_at DESC NULLS LAST,
              b.updated_at DESC,
              b.slug
     LIMIT $1`,
    [limit]
  );

  const staleReviewRows = reviewRows
    .map((row) => ({ row, current: buildCurrentGeocodeState(row) }))
    .filter((item) => item.current.query === null);
  const staleReviewByReason: Record<string, number> = {};
  for (const item of staleReviewRows) increment(staleReviewByReason, item.current.reason);

  const marineCityCacheRows = await query<CacheRow>(
    `SELECT c.query_key,
            c.query_text,
            c.provider,
            c.precision,
            c.place_name,
            c.error,
            c.updated_at::text
     FROM location_geocode_cache c
     WHERE c.provider = $1
       AND c.status = 'geocoded'
       AND c.precision = 'city'
       AND (
         c.query_key ~* $2
         OR c.query_text ~* $2
       )
     ORDER BY c.updated_at DESC,
              c.query_key
     LIMIT $3`,
    [provider, MARINE_CITY_CACHE_PATTERN, cacheLimit]
  );
  const cacheQueryTexts = uniqueValues(marineCityCacheRows.map((row) => row.query_text));
  const cacheQueryKeys = uniqueValues(marineCityCacheRows.map((row) => row.query_key));
  const affectedCacheBoats = cacheQueryTexts.length
    ? await query<BoatResetRow>(
        `SELECT b.id,
                b.slug,
                b.location_text,
                b.location_geocode_query,
                b.location_geocode_place_name
         FROM boats b
         LEFT JOIN boat_dna d ON d.boat_id = b.id
         WHERE b.status = 'active'
           AND ${visibleSql}
           AND b.location_geocode_status = 'geocoded'
           AND b.location_geocode_provider = $1
           AND b.location_geocode_precision = 'city'
           AND b.location_geocode_query = ANY($2::text[])
         ORDER BY b.updated_at DESC,
                  b.slug`,
        [provider, cacheQueryTexts]
      )
    : [];

  const staleReviewBoatIds = uniqueValues(staleReviewRows.map((item) => item.row.id));
  const cacheBoatIds = uniqueValues(affectedCacheBoats.map((row) => row.id));
  const resetBoatIds = uniqueValues([...staleReviewBoatIds, ...cacheBoatIds]);
  const boatBackupTable = resetBoatIds.length > 0 ? formatBackupTableName("boat_geocode_hygiene_backup") : null;
  const cacheBackupTable = cacheQueryKeys.length > 0 ? formatBackupTableName("location_geocode_cache_hygiene_backup") : null;

  if (apply) {
    if (boatBackupTable) await backupBoats(boatBackupTable, resetBoatIds);
    if (cacheBackupTable) await backupCache(cacheBackupTable, provider, cacheQueryKeys);
    if (resetBoatIds.length > 0) await resetBoatsToPending(resetBoatIds);
    if (cacheQueryKeys.length > 0) {
      await query(
        `DELETE FROM location_geocode_cache
         WHERE provider = $1
           AND query_key = ANY($2::text[])`,
        [provider, cacheQueryKeys]
      );
    }
  }

  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    provider,
    reviewRowsScanned: reviewRows.length,
    staleReviewRows: staleReviewRows.length,
    staleReviewByReason,
    staleReviewSamples: staleReviewRows.slice(0, 20).map((item) => ({
      slug: item.row.slug,
      locationText: item.row.location_text,
      previousQuery: item.row.location_geocode_query,
      previousStatus: item.row.location_geocode_status,
      previousError: item.row.location_geocode_error,
      currentReason: item.current.reason,
    })),
    marineCityCacheRows: marineCityCacheRows.length,
    marineCityCacheSamples: marineCityCacheRows.slice(0, 25).map((row) => ({
      queryKey: row.query_key,
      queryText: row.query_text,
      placeName: row.place_name,
      updatedAt: row.updated_at,
    })),
    affectedCacheBoatRows: affectedCacheBoats.length,
    affectedCacheBoatSamples: affectedCacheBoats.slice(0, 25).map((row) => ({
      slug: row.slug,
      locationText: row.location_text,
      previousQuery: row.location_geocode_query,
      previousPlaceName: row.location_geocode_place_name,
    })),
    resetBoatRows: resetBoatIds.length,
    deletedCacheRows: cacheQueryKeys.length,
    boatBackupTable: apply ? boatBackupTable : null,
    cacheBackupTable: apply ? cacheBackupTable : null,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
