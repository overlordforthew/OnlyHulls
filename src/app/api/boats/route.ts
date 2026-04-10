import { query, queryOne } from "@/lib/db";
import { getMeili, BOATS_INDEX } from "@/lib/meilisearch";
import { logger } from "@/lib/logger";
import {
  buildOrderBy,
  buildWhereClause,
  filtersFromSearchParams,
  type BoatSearchFilters,
} from "@/lib/search/boat-search";
import { buildVisibleImportQualitySql } from "@/lib/import-quality";
import { NextResponse } from "next/server";

const BOAT_FIELDS = `b.id, b.make, b.model, b.year, b.asking_price, b.currency,
    b.asking_price_usd, b.location_text, b.slug, b.is_sample,
    b.source_site, b.source_name, b.source_url,
    COALESCE(u.subscription_tier::text, 'free') as seller_subscription_tier,
    (SELECT url FROM boat_media bm WHERE bm.boat_id = b.id AND bm.type = 'image' ORDER BY sort_order LIMIT 1) as hero_url,
    COALESCE(d.specs, '{}') as specs,
    COALESCE(d.character_tags, '{}') as character_tags,
    d.condition_score`;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const filters = filtersFromSearchParams(url.searchParams);

    const orderBy = buildOrderBy(filters.sort, filters.dir);
    const hasStructuredFilters =
      Boolean(filters.minPrice) ||
      Boolean(filters.maxPrice) ||
      Boolean(filters.minYear) ||
      Boolean(filters.maxYear) ||
      Boolean(filters.rigType) ||
      Boolean(filters.hullType) ||
      Boolean(filters.tag);
    const isExplicitSort =
      filters.sort !== "newest" || filters.dir !== "desc";
    const shouldUseMeili =
      Boolean(filters.search) &&
      !hasStructuredFilters &&
      !isExplicitSort;

    if (shouldUseMeili) {
      try {
        const meiliResults = await runMeiliSearch(filters);
        if (meiliResults.hits.length) {
          const ids = meiliResults.hits.map((hit) => String(hit.id));
          const boats = await fetchBoats(ids, true, orderBy);

          if (boats.length === ids.length) {
            return NextResponse.json({
              boats,
              total: meiliResults.estimatedTotalHits || boats.length,
              page: filters.page,
              limit: filters.limit,
            });
          }

          logger.warn(
            {
              query: filters.search,
              requestedIds: ids.length,
              returnedBoats: boats.length,
            },
            "Meilisearch returned stale boat ids; falling back to Postgres"
          );
        }
      } catch (err) {
        logger.warn({ err, query: filters.search }, "Meilisearch search failed; falling back to Postgres");
      }
    }

    const databaseResults = await runDatabaseSearch(filters, orderBy);
    return NextResponse.json(databaseResults);
  } catch (err) {
    logger.error({ err }, "GET /api/boats error");
    return NextResponse.json(
      { error: "Failed to load boats. Please try again." },
      { status: 500 }
    );
  }
}

async function runMeiliSearch(filters: BoatSearchFilters) {
  const filter: string[] = ["status = 'active'"];
  const minPriceNum = filters.minPrice ? parseFloat(filters.minPrice) : NaN;
  const maxPriceNum = filters.maxPrice ? parseFloat(filters.maxPrice) : NaN;
  const minYearNum = filters.minYear ? parseInt(filters.minYear, 10) : NaN;
  const maxYearNum = filters.maxYear ? parseInt(filters.maxYear, 10) : NaN;

  if (!Number.isNaN(minPriceNum)) filter.push(`askingPrice >= ${minPriceNum}`);
  if (!Number.isNaN(maxPriceNum)) filter.push(`askingPrice <= ${maxPriceNum}`);
  if (!Number.isNaN(minYearNum)) filter.push(`year >= ${minYearNum}`);
  if (!Number.isNaN(maxYearNum)) filter.push(`year <= ${maxYearNum}`);

  return getMeili().index(BOATS_INDEX).search(filters.search, {
    limit: filters.limit,
    offset: (filters.page - 1) * filters.limit,
    filter,
  });
}

async function runDatabaseSearch(filters: BoatSearchFilters, orderBy: string) {
  const { where, params } = buildWhereClause(filters);
  const boats = await query<Record<string, unknown>>(
    `SELECT ${BOAT_FIELDS}
     FROM boats b
     LEFT JOIN users u ON u.id = b.seller_id
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE ${where}
     ORDER BY ${orderBy}
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, filters.limit, (filters.page - 1) * filters.limit]
  );

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*)
     FROM boats b
     LEFT JOIN users u ON u.id = b.seller_id
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE ${where}`,
    params
  );

  return {
    boats,
    total: parseInt(countResult?.count || "0", 10),
    page: filters.page,
    limit: filters.limit,
  };
}

async function fetchBoats(ids: string[], preserveHitOrder: boolean, orderBy: string) {
  if (preserveHitOrder) {
    return query<Record<string, unknown>>(
      `SELECT ${BOAT_FIELDS}
       FROM boats b
       LEFT JOIN users u ON u.id = b.seller_id
       LEFT JOIN boat_dna d ON d.boat_id = b.id
       WHERE b.id::text = ANY($1)
         AND b.status = 'active'
         AND ${buildVisibleImportQualitySql("b")}
       ORDER BY array_position($1::text[], b.id::text) ASC`,
      [ids]
    );
  }

  return query<Record<string, unknown>>(
    `SELECT ${BOAT_FIELDS}
     FROM boats b
     LEFT JOIN users u ON u.id = b.seller_id
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE b.id = ANY($1)
       AND b.status = 'active'
       AND ${buildVisibleImportQualitySql("b")}
     ORDER BY ${orderBy}`,
    [ids]
  );
}
