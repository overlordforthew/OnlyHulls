import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { buildWhereClause, filtersFromSearchParams } from "@/lib/search/boat-search";
import { buildVisibleImportQualitySql, sanitizeImportedBoatRecord } from "@/lib/import-quality";
import {
  getPublicMapCoordinate,
  PUBLIC_MAP_PRECISIONS,
} from "@/lib/locations/map-coordinates";
import {
  hasMapScope,
  parseMapBounds,
  parseMapMarkerLimit,
  type MapBounds,
} from "@/lib/locations/map-bounds";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

type BoatMapRow = {
  id: string;
  slug: string | null;
  make: string;
  model: string;
  year: number;
  location_text: string | null;
  location_lat: number | string | null;
  location_lng: number | string | null;
  location_geocode_precision: string | null;
  location_approximate: boolean | null;
};

function appendBoundsFilter(
  conditions: string[],
  params: unknown[],
  bounds: MapBounds | null
) {
  if (!bounds) return;

  params.push(bounds.west, bounds.east, bounds.south, bounds.north);
  const westIndex = params.length - 3;
  const eastIndex = params.length - 2;
  const southIndex = params.length - 1;
  const northIndex = params.length;
  conditions.push(
    `b.location_lng BETWEEN $${westIndex} AND $${eastIndex}`,
    `b.location_lat BETWEEN $${southIndex} AND $${northIndex}`
  );
}

function buildMapMarker(row: BoatMapRow) {
  const publicCoordinate = getPublicMapCoordinate({
    latitude: row.location_lat,
    longitude: row.location_lng,
    precision: row.location_geocode_precision,
    approximate: row.location_approximate,
  });

  if (!publicCoordinate) return null;

  const normalized = sanitizeImportedBoatRecord({
    ...row,
    source_site: null,
    specs: {},
  });

  return {
    id: row.id,
    slug: row.slug,
    title: `${row.year} ${normalized.make} ${normalized.model}`.trim(),
    locationText: normalized.location_text,
    lat: publicCoordinate.latitude,
    lng: publicCoordinate.longitude,
    precision: publicCoordinate.precision,
    approximate: publicCoordinate.approximate,
  };
}

export async function GET(req: Request) {
  const startedAt = Date.now();

  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = await rateLimit(`boats-map:${ip}`, 120, 60, { failClosed: false });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many map requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter || 60) } }
      );
    }

    const url = new URL(req.url);
    const filters = filtersFromSearchParams(url.searchParams);
    const boundsResult = parseMapBounds(url.searchParams);
    if (boundsResult.error) {
      return NextResponse.json({ error: boundsResult.error }, { status: 400 });
    }

    if (!hasMapScope(filters, boundsResult.bounds)) {
      return NextResponse.json(
        { error: "Provide map bounds or at least one search filter." },
        { status: 400 }
      );
    }

    const limit = parseMapMarkerLimit(url.searchParams);
    const { where, params } = buildWhereClause(filters);
    const queryParams = [...params];
    const conditions = [
      where,
      "b.location_lat BETWEEN -90 AND 90",
      "b.location_lng BETWEEN -180 AND 180",
    ];

    queryParams.push([...PUBLIC_MAP_PRECISIONS]);
    conditions.push(`b.location_geocode_precision = ANY($${queryParams.length}::text[])`);
    appendBoundsFilter(conditions, queryParams, boundsResult.bounds);

    const whereSql = conditions.join(" AND ");
    const total = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM boats b
       LEFT JOIN users u ON u.id = b.seller_id
       LEFT JOIN boat_dna d ON d.boat_id = b.id
       WHERE ${whereSql}`,
      queryParams
    );

    queryParams.push(limit);
    const rows = await query<BoatMapRow>(
      `SELECT b.id, b.slug, b.make, b.model, b.year, b.location_text,
              b.location_lat, b.location_lng, b.location_geocode_precision,
              b.location_approximate
       FROM boats b
       LEFT JOIN users u ON u.id = b.seller_id
       LEFT JOIN boat_dna d ON d.boat_id = b.id
       WHERE ${whereSql}
         AND ${buildVisibleImportQualitySql("b")}
       ORDER BY b.updated_at DESC, b.id DESC
       LIMIT $${queryParams.length}`,
      queryParams
    );

    const markers = rows.map(buildMapMarker).filter((marker) => marker !== null);

    logger.info(
      {
        durationMs: Date.now() - startedAt,
        resultCount: markers.length,
        total: parseInt(total?.count || "0", 10),
        hasBounds: Boolean(boundsResult.bounds),
        hasLocationFilter: Boolean(filters.location),
      },
      "Served /api/boats/map"
    );

    return NextResponse.json(
      {
        boats: markers,
        total: parseInt(total?.count || "0", 10),
        limit,
        bounds: boundsResult.bounds,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (err) {
    logger.error({ err, durationMs: Date.now() - startedAt }, "GET /api/boats/map error");
    return NextResponse.json(
      { error: "Failed to load map markers. Please try again." },
      { status: 500 }
    );
  }
}
