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

export async function getMapReadinessSnapshot() {
  const publicPrecisions = [...PUBLIC_MAP_PRECISIONS];

  const [summary, precisionRows, statusRows, providerRows] = await Promise.all([
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
             AND b.location_geocoded_at < NOW() - INTERVAL '90 days'
         )::text AS stale_public_coordinate_count,
         COUNT(*) FILTER (
           WHERE b.location_lat BETWEEN -90 AND 90
             AND b.location_lng BETWEEN -180 AND 180
             AND b.location_geocode_precision = ANY($1::text[])
             AND COALESCE(b.location_geocode_score, 0) < 0.6
         )::text AS low_score_public_pin_count
       FROM boats b
       WHERE ${ACTIVE_VISIBLE_SQL}`,
      [publicPrecisions]
    ),
    query<MapReadinessSplitRow>(
      `SELECT COALESCE(b.location_geocode_precision, 'none') AS label,
              COUNT(*)::text AS count
       FROM boats b
       WHERE ${ACTIVE_VISIBLE_SQL}
       GROUP BY COALESCE(b.location_geocode_precision, 'none')
       ORDER BY COUNT(*) DESC, COALESCE(b.location_geocode_precision, 'none')`
    ),
    query<MapReadinessSplitRow>(
      `SELECT COALESCE(b.location_geocode_status, 'none') AS label,
              COUNT(*)::text AS count
       FROM boats b
       WHERE ${ACTIVE_VISIBLE_SQL}
       GROUP BY COALESCE(b.location_geocode_status, 'none')
       ORDER BY COUNT(*) DESC, COALESCE(b.location_geocode_status, 'none')`
    ),
    query<MapReadinessSplitRow>(
      `SELECT COALESCE(b.location_geocode_provider, 'none') AS label,
              COUNT(*)::text AS count
       FROM boats b
       WHERE ${ACTIVE_VISIBLE_SQL}
       GROUP BY COALESCE(b.location_geocode_provider, 'none')
       ORDER BY COUNT(*) DESC, COALESCE(b.location_geocode_provider, 'none')`
    ),
  ]);

  return buildMapReadinessSnapshot({
    summary,
    precisionRows,
    statusRows,
    providerRows,
    thresholds: getMapReadinessThresholds(),
    geocodingEnabled: locationGeocodingEnabled(),
    geocodingProvider: locationGeocodingProvider(),
    publicMapEnabled: publicMapEnabled(),
  });
}
