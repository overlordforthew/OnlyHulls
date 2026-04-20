import { locationGeocodingEnabled, locationGeocodingProvider, publicMapEnabled } from "@/lib/capabilities";
import { query, queryOne } from "@/lib/db";
import { buildVisibleImportQualitySql } from "@/lib/import-quality";
import { PUBLIC_MAP_PRECISIONS } from "@/lib/locations/map-coordinates";
import {
  buildMapReadinessSnapshot,
  getMapReadinessThresholds,
  type MapReadinessSplitRow,
  type MapReadinessSummaryRow,
} from "@/lib/locations/map-readiness";

const ACTIVE_VISIBLE_SQL = `b.status = 'active' AND ${buildVisibleImportQualitySql("b")}`;

function getSafeConfiguredProviderLabel(provider: string) {
  if (provider === "opencage" || provider === "nominatim" || provider === "disabled") {
    return provider;
  }

  return "other";
}

export async function getMapReadinessSnapshot() {
  const publicPrecisions = [...PUBLIC_MAP_PRECISIONS];
  const thresholds = getMapReadinessThresholds();

  const [
    summary,
    precisionRows,
    statusRows,
    providerRows,
    scoreBandRows,
    ageBandRows,
    sourceKindRows,
    confidenceRows,
  ] = await Promise.all([
    queryOne<MapReadinessSummaryRow>(
      `SELECT
         COUNT(*)::text AS active_visible_count,
         COUNT(*) FILTER (
           WHERE COALESCE(NULLIF(TRIM(b.location_text), ''), '') <> ''
         )::text AS with_location_text_count,
         COUNT(*) FILTER (
           WHERE CARDINALITY(COALESCE(b.location_market_slugs, '{}'::text[])) > 0
         )::text AS with_market_slugs_count,
         COUNT(*) FILTER (
           WHERE b.location_confidence IN ('city', 'exact')
         )::text AS city_or_better_count,
         COUNT(*) FILTER (
           WHERE b.location_lat BETWEEN -90 AND 90
             AND b.location_lng BETWEEN -180 AND 180
             AND b.location_geocode_precision = ANY($1::text[])
         )::text AS public_pin_count,
         COUNT(*) FILTER (
           WHERE b.location_lat BETWEEN -90 AND 90
             AND b.location_lng BETWEEN -180 AND 180
             AND COALESCE(b.location_approximate, false) = false
             AND b.location_geocode_precision = ANY($1::text[])
         )::text AS non_approx_public_pin_count,
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
         COUNT(*) FILTER (
           WHERE b.location_lat BETWEEN -90 AND 90
             AND b.location_lng BETWEEN -180 AND 180
             AND COALESCE(b.location_approximate, false) = true
             AND b.location_geocode_precision = ANY($1::text[])
         )::text AS approximate_public_pin_count,
         COUNT(*) FILTER (WHERE b.location_geocode_status = 'pending')::text AS pending_count,
         COUNT(*) FILTER (WHERE b.location_geocode_status = 'geocoded')::text AS geocoded_count,
         COUNT(*) FILTER (WHERE b.location_geocode_status = 'review')::text AS review_count,
         COUNT(*) FILTER (WHERE b.location_geocode_status = 'failed')::text AS failed_count,
         COUNT(*) FILTER (WHERE b.location_geocode_status = 'skipped')::text AS skipped_count,
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
               b.location_geocode_provider IS NULL
               OR b.location_geocode_score IS NULL
               OR b.location_geocoded_at IS NULL
             )
         )::text AS public_missing_metadata_count,
         COUNT(*) FILTER (
           WHERE b.location_lat BETWEEN -90 AND 90
             AND b.location_lng BETWEEN -180 AND 180
             AND b.location_geocode_precision = ANY($1::text[])
             AND b.location_geocoded_at < NOW() - ($2::int * INTERVAL '1 day')
         )::text AS stale_public_coordinate_count,
         COUNT(*) FILTER (
           WHERE b.location_lat BETWEEN -90 AND 90
             AND b.location_lng BETWEEN -180 AND 180
             AND b.location_geocode_precision = ANY($1::text[])
             AND b.location_geocode_score IS NOT NULL
             AND b.location_geocode_score < $3::float
         )::text AS low_score_public_pin_count
       FROM boats b
       WHERE ${ACTIVE_VISIBLE_SQL}`,
      [publicPrecisions, thresholds.stalePinDays, thresholds.minPinScore]
    ),
    query<MapReadinessSplitRow>(
      `SELECT
              CASE
                WHEN b.location_geocode_precision IN ('exact', 'street', 'marina', 'city', 'region', 'country', 'unknown')
                  THEN b.location_geocode_precision
                ELSE 'none'
              END AS label,
              COUNT(*)::text AS count
       FROM boats b
       WHERE ${ACTIVE_VISIBLE_SQL}
       GROUP BY 1
       ORDER BY COUNT(*) DESC, label`
    ),
    query<MapReadinessSplitRow>(
      `SELECT
              CASE
                WHEN b.location_geocode_status IN ('pending', 'geocoded', 'review', 'failed', 'skipped')
                  THEN b.location_geocode_status
                ELSE 'none'
              END AS label,
              COUNT(*)::text AS count
       FROM boats b
       WHERE ${ACTIVE_VISIBLE_SQL}
       GROUP BY 1
       ORDER BY COUNT(*) DESC, label`
    ),
    query<MapReadinessSplitRow>(
      `SELECT
              CASE
                WHEN b.location_geocode_provider IN ('opencage', 'nominatim') THEN b.location_geocode_provider
                WHEN b.location_geocode_provider IS NULL THEN 'none'
                ELSE 'other'
              END AS label,
              COUNT(*)::text AS count
       FROM boats b
       WHERE ${ACTIVE_VISIBLE_SQL}
       GROUP BY 1
       ORDER BY COUNT(*) DESC, label`
    ),
    query<MapReadinessSplitRow>(
      `SELECT
         CASE
           WHEN b.location_geocode_score IS NULL THEN 'missing_score'
           WHEN b.location_geocode_score < $2::float THEN 'below_min_score'
           ELSE 'meets_score'
         END AS label,
         COUNT(*)::text AS count
       FROM boats b
       WHERE ${ACTIVE_VISIBLE_SQL}
         AND b.location_lat BETWEEN -90 AND 90
         AND b.location_lng BETWEEN -180 AND 180
         AND b.location_geocode_precision = ANY($1::text[])
       GROUP BY 1
       ORDER BY COUNT(*) DESC, label`,
      [publicPrecisions, thresholds.minPinScore]
    ),
    query<MapReadinessSplitRow>(
      `SELECT
         CASE
           WHEN b.location_geocoded_at IS NULL THEN 'missing_geocoded_at'
           WHEN b.location_geocoded_at < NOW() - ($2::int * INTERVAL '1 day') THEN 'stale'
           WHEN b.location_geocoded_at < NOW() - (($2::float / 2) * INTERVAL '1 day') THEN 'aging'
           ELSE 'fresh'
         END AS label,
         COUNT(*)::text AS count
       FROM boats b
       WHERE ${ACTIVE_VISIBLE_SQL}
         AND b.location_lat BETWEEN -90 AND 90
         AND b.location_lng BETWEEN -180 AND 180
         AND b.location_geocode_precision = ANY($1::text[])
       GROUP BY 1
       ORDER BY COUNT(*) DESC, label`,
      [publicPrecisions, thresholds.stalePinDays]
    ),
    query<MapReadinessSplitRow>(
      `SELECT
         CASE
           WHEN b.listing_source = 'imported' THEN 'imported'
           WHEN b.source_url IS NULL THEN 'platform'
           ELSE 'external'
         END AS label,
         COUNT(*)::text AS count
       FROM boats b
       WHERE ${ACTIVE_VISIBLE_SQL}
       GROUP BY 1
       ORDER BY COUNT(*) DESC, label`
    ),
    query<MapReadinessSplitRow>(
      `SELECT
         CASE
           WHEN b.location_confidence IN ('exact', 'city', 'region', 'unknown') THEN b.location_confidence
           ELSE 'missing'
         END AS label,
         COUNT(*)::text AS count
       FROM boats b
       WHERE ${ACTIVE_VISIBLE_SQL}
       GROUP BY 1
       ORDER BY COUNT(*) DESC, label`
    ),
  ]);

  return buildMapReadinessSnapshot({
    summary,
    precisionRows,
    statusRows,
    providerRows,
    scoreBandRows,
    ageBandRows,
    sourceKindRows,
    confidenceRows,
    thresholds,
    geocodingEnabled: locationGeocodingEnabled(),
    geocodingProvider: getSafeConfiguredProviderLabel(locationGeocodingProvider()),
    publicMapEnabled: publicMapEnabled(),
  });
}
