import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { buildOrderBy, buildWhereClause, filtersFromSearchParams } from "@/lib/search/boat-search";
import { buildVisibleImportQualitySql } from "@/lib/import-quality";
import {
  PUBLIC_MAP_PRECISIONS,
} from "@/lib/locations/map-coordinates";
import {
  parseMapBounds,
  parseMapMarkerLimit,
  type MapBounds,
} from "@/lib/locations/map-bounds";
import { buildPublicMapMarker, type PublicMapBoatRow } from "@/lib/locations/public-map-markers";
import { publicMapEnabled } from "@/lib/capabilities";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

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

export async function GET(req: Request) {
  const startedAt = Date.now();

  try {
    if (!publicMapEnabled()) {
      return NextResponse.json({ error: "Map is not enabled." }, { status: 404 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = await rateLimit(`boats-map:${ip}`, 60, 60, { failClosed: false });
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

    if (!boundsResult.bounds) {
      return NextResponse.json(
        { error: "Map bounds are required." },
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
    queryParams.push(limit + 1);
    // Honor the user's sort selection so the sidebar list matches the rest
    // of the browse surface. Previously we hardcoded updated_at DESC which
    // meant "Price asc" etc. silently fell back to newest — misleading for
    // users who came to the map to sort pins by price or LOA.
    const orderBy = buildOrderBy(filters.sort, filters.dir);
    const rows = await query<PublicMapBoatRow>(
      `SELECT b.id, b.slug, b.make, b.model, b.year, b.asking_price, b.currency,
              b.asking_price_usd, b.location_text,
              b.location_lat, b.location_lng, b.location_geocode_precision,
              b.location_approximate,
              (SELECT url FROM boat_media bm WHERE bm.boat_id = b.id AND bm.type = 'image' ORDER BY sort_order LIMIT 1) as hero_url,
              d.specs->>'loa' AS loa
       FROM boats b
       LEFT JOIN users u ON u.id = b.seller_id
       LEFT JOIN boat_dna d ON d.boat_id = b.id
       WHERE ${whereSql}
         AND ${buildVisibleImportQualitySql("b")}
       ORDER BY ${orderBy}
       LIMIT $${queryParams.length}`,
      queryParams
    );
    const limitedRows = rows.slice(0, limit);
    const hasMore = rows.length > limit;

    const markers = limitedRows.map(buildPublicMapMarker).filter((marker) => marker !== null);

    logger.info(
      {
        durationMs: Date.now() - startedAt,
        resultCount: markers.length,
        hasMore,
        hasBounds: Boolean(boundsResult.bounds),
        hasLocationFilter: Boolean(filters.location),
      },
      "Served /api/boats/map"
    );

    return NextResponse.json(
      {
        boats: markers,
        returned: markers.length,
        hasMore,
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
