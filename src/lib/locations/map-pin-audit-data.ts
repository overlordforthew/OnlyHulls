import { pool } from "@/lib/db";
import { type PublicMapPrecision } from "@/lib/locations/map-coordinates";
import {
  buildMapPinAuditUrl,
  buildMapPinAuditWhereSql,
  buildMapPinListingUrl,
  normalizePublicBaseUrl,
  parseMapPinAuditPrecision,
  type MapPinAuditReport,
  type MapPinAuditRow,
} from "@/lib/locations/map-pin-audit";

type CountRow = {
  count: string;
};

type PinRow = {
  slug: string | null;
  title: string | null;
  location_text: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  precision: string | null;
  provider: string | null;
  score: string | number | null;
  geocoded_at: string | null;
  place_name: string | null;
};

export type MapPinAuditQueryInput = {
  limit: number;
  seed: string;
  baseUrl?: string | null;
  precision: PublicMapPrecision | null;
  backupTable: string | null;
};

function toNumber(value: string | number | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}


async function runQuery<T extends Record<string, unknown>>(text: string, params?: unknown[]) {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

async function runQueryOne<T extends Record<string, unknown>>(text: string, params?: unknown[]) {
  const rows = await runQuery<T>(text, params);
  return rows[0] ?? null;
}

export async function getMapPinAuditReport(input: MapPinAuditQueryInput): Promise<MapPinAuditReport> {
  const baseUrl = normalizePublicBaseUrl(input.baseUrl);
  const { whereSql, params } = buildMapPinAuditWhereSql({
    backupTable: input.backupTable,
    precision: input.precision,
  });
  const count = await runQueryOne<CountRow>(
    `SELECT COUNT(*)::text AS count
     FROM boats b
     WHERE ${whereSql}`,
    params
  );
  const rows = await runQuery<PinRow>(
    `SELECT b.slug,
            CONCAT_WS(' ', b.year::text, NULLIF(TRIM(b.make), ''), NULLIF(TRIM(b.model), '')) AS title,
            b.location_text,
            b.location_lat AS latitude,
            b.location_lng AS longitude,
            b.location_geocode_precision AS precision,
            b.location_geocode_provider AS provider,
            b.location_geocode_score AS score,
            b.location_geocoded_at::text AS geocoded_at,
            b.location_geocode_place_name AS place_name
     FROM boats b
     WHERE ${whereSql}
     ORDER BY md5(b.slug || $${params.length + 1}), b.slug
     LIMIT $${params.length + 2}`,
    [...params, input.seed, input.limit]
  );
  const pins = rows
    .map((row): MapPinAuditRow | null => {
      const slug = String(row.slug || "").trim();
      const latitude = toNumber(row.latitude);
      const longitude = toNumber(row.longitude);
      const rowPrecision = parseMapPinAuditPrecision(row.precision);
      if (!slug || latitude === null || longitude === null || !rowPrecision) return null;
      const auditUrl = buildMapPinAuditUrl(latitude, longitude);
      if (!auditUrl) return null;

      return {
        slug,
        title: row.title || slug,
        locationText: row.location_text,
        latitude,
        longitude,
        precision: rowPrecision,
        provider: row.provider,
        score: toNumber(row.score),
        geocodedAt: row.geocoded_at,
        placeName: row.place_name,
        auditUrl,
        listingUrl: buildMapPinListingUrl(baseUrl, slug),
      };
    })
    .filter((row): row is MapPinAuditRow => row !== null);

  return {
    generatedAt: new Date().toISOString(),
    seed: input.seed,
    limit: input.limit,
    eligibleCount: Number(count?.count || 0),
    returnedCount: pins.length,
    precision: input.precision || "all",
    backupTable: input.backupTable,
    pins,
  };
}
