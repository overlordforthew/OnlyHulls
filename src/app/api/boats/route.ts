import { query, queryOne } from "@/lib/db";
import { getMeili, BOATS_INDEX } from "@/lib/meilisearch";
import { logger } from "@/lib/logger";
import {
  buildOrderBy,
  buildWhereClause,
  filtersFromSearchParams,
  type BoatSearchFilters,
} from "@/lib/search/boat-search";
import { buildVisibleImportQualitySql, sanitizeImportedBoatRecord } from "@/lib/import-quality";
import { NextResponse } from "next/server";

const BOAT_FIELDS = `b.id, b.make, b.model, b.year, b.asking_price, b.currency,
    b.asking_price_usd, b.location_text, b.slug, b.is_sample,
    b.source_site, b.source_name, b.source_url,
    COALESCE(u.subscription_tier::text, 'free') as seller_subscription_tier,
    (SELECT url FROM boat_media bm WHERE bm.boat_id = b.id AND bm.type = 'image' ORDER BY sort_order LIMIT 1) as hero_url,
    COALESCE(d.specs, '{}') as specs,
    COALESCE(d.character_tags, '{}') as character_tags,
    d.condition_score,
    d.ai_summary`;

function sanitizeBoatResults(rows: Record<string, unknown>[]) {
  return rows.map((row) =>
    sanitizeImportedBoatRecord({
      ...row,
      make: String(row.make || ""),
      model: String(row.model || ""),
      slug: typeof row.slug === "string" ? row.slug : null,
      source_site: typeof row.source_site === "string" ? row.source_site : null,
      location_text: typeof row.location_text === "string" ? row.location_text : null,
      specs:
        row.specs && typeof row.specs === "object"
          ? (row.specs as Record<string, unknown>)
          : {},
    })
  );
}

function getSanitizedLoa(row: Record<string, unknown>) {
  const specs =
    row.specs && typeof row.specs === "object"
      ? (row.specs as Record<string, unknown>)
      : null;
  return typeof specs?.loa === "number" ? specs.loa : null;
}

function sortSanitizedRows(rows: Record<string, unknown>[], filters: BoatSearchFilters) {
  if (filters.sort !== "size") return rows;

  const direction = filters.dir === "asc" ? 1 : -1;
  return [...rows].sort((left, right) => {
    const leftLoa = getSanitizedLoa(left);
    const rightLoa = getSanitizedLoa(right);

    if (leftLoa === null && rightLoa === null) return 0;
    if (leftLoa === null) return 1;
    if (rightLoa === null) return -1;

    return (leftLoa - rightLoa) * direction;
  });
}

function buildServerTimingHeader(metrics: Array<{ name: string; durationMs: number }>) {
  return metrics
    .filter((metric) => Number.isFinite(metric.durationMs))
    .map((metric) => `${metric.name};dur=${metric.durationMs.toFixed(1)}`)
    .join(", ");
}

function jsonWithTiming<T>(
  body: T,
  input: {
    searchMode: string;
    totalDurationMs: number;
    searchDurationMs: number;
  }
) {
  return NextResponse.json(body, {
    headers: {
      "Server-Timing": buildServerTimingHeader([
        { name: "app", durationMs: input.totalDurationMs },
        { name: "search", durationMs: input.searchDurationMs },
      ]),
      "X-OnlyHulls-Search-Mode": input.searchMode,
    },
  });
}

export async function GET(req: Request) {
  const requestStartedAt = Date.now();

  try {
    const url = new URL(req.url);
    const filters = filtersFromSearchParams(url.searchParams);

    const orderBy = buildOrderBy(filters.sort, filters.dir);
    const hasStructuredFilters =
      Boolean(filters.location) ||
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
    let searchMode = "database";
    let searchDurationMs = 0;

    if (shouldUseMeili) {
      try {
        const meiliStartedAt = Date.now();
        const meiliResults = await runMeiliSearch(filters);
        if (meiliResults.hits.length) {
          const ids = meiliResults.hits.map((hit) => String(hit.id));
          const boats = await fetchBoats(ids, true, orderBy);
          searchDurationMs = Date.now() - meiliStartedAt;

          if (boats.length === ids.length) {
            searchMode = "meili";
            const payload = {
              boats,
              total: meiliResults.estimatedTotalHits || boats.length,
              page: filters.page,
              limit: filters.limit,
            };
            const totalDurationMs = Date.now() - requestStartedAt;

            logger.info(
              {
                searchMode,
                totalDurationMs,
                searchDurationMs,
                resultCount: boats.length,
                total: payload.total,
                hasSearchQuery: Boolean(filters.search),
                hasStructuredFilters,
                isExplicitSort,
                page: filters.page,
                limit: filters.limit,
                sort: filters.sort,
                dir: filters.dir,
              },
              "Served /api/boats"
            );

            return jsonWithTiming(payload, {
              searchMode,
              totalDurationMs,
              searchDurationMs,
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
        searchMode = "database_fallback";
      } catch (err) {
        searchMode = "database_fallback";
        logger.warn({ err, query: filters.search }, "Meilisearch search failed; falling back to Postgres");
      }
    }

    const databaseStartedAt = Date.now();
    const databaseResults = await runDatabaseSearch(filters, orderBy);
    searchDurationMs = Date.now() - databaseStartedAt;
    const totalDurationMs = Date.now() - requestStartedAt;

    logger.info(
      {
        searchMode,
        totalDurationMs,
        searchDurationMs,
        resultCount: databaseResults.boats.length,
        total: databaseResults.total,
        hasSearchQuery: Boolean(filters.search),
        hasStructuredFilters,
        isExplicitSort,
        page: filters.page,
        limit: filters.limit,
        sort: filters.sort,
        dir: filters.dir,
      },
      "Served /api/boats"
    );

    return jsonWithTiming(databaseResults, {
      searchMode,
      totalDurationMs,
      searchDurationMs,
    });
  } catch (err) {
    logger.error({ err, totalDurationMs: Date.now() - requestStartedAt }, "GET /api/boats error");
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
  const rows = await query<Record<string, unknown>>(
    `SELECT ${BOAT_FIELDS}
     FROM boats b
     LEFT JOIN users u ON u.id = b.seller_id
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE ${where}
     ORDER BY ${orderBy}
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, filters.limit, (filters.page - 1) * filters.limit]
  );
  const boats = sortSanitizedRows(sanitizeBoatResults(rows), filters);

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
    const rows = await query<Record<string, unknown>>(
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
    return sanitizeBoatResults(rows);
  }

  const rows = await query<Record<string, unknown>>(
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
  return sanitizeBoatResults(rows);
}
