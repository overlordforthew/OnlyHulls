import { query, queryOne } from "@/lib/db";
import { getMeili, BOATS_INDEX } from "@/lib/meilisearch";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";

const BOAT_FIELDS = `b.id, b.make, b.model, b.year, b.asking_price, b.currency,
    b.asking_price_usd, b.location_text, b.slug, b.is_sample,
    b.source_site, b.source_name, b.source_url,
    (SELECT url FROM boat_media bm WHERE bm.boat_id = b.id ORDER BY sort_order LIMIT 1) as hero_url,
    COALESCE(d.specs, '{}') as specs,
    COALESCE(d.character_tags, '{}') as character_tags,
    d.condition_score`;

type BoatSearchParams = {
  search: string;
  page: number;
  limit: number;
  minPrice: string | null;
  maxPrice: string | null;
  minYear: string | null;
  maxYear: string | null;
  rigType: string | null;
  hullType: string | null;
  tag: string | null;
  sort: string;
  dir: string;
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const filters: BoatSearchParams = {
      search: url.searchParams.get("q") || "",
      page: parseInt(url.searchParams.get("page") || "1", 10),
      limit: Math.min(parseInt(url.searchParams.get("limit") || "30", 10), 100),
      minPrice: url.searchParams.get("minPrice"),
      maxPrice: url.searchParams.get("maxPrice"),
      minYear: url.searchParams.get("minYear"),
      maxYear: url.searchParams.get("maxYear"),
      rigType: url.searchParams.get("rigType"),
      hullType: url.searchParams.get("hullType"),
      tag: url.searchParams.get("tag"),
      sort: url.searchParams.get("sort") || "newest",
      dir: url.searchParams.get("dir") || "desc",
    };

    const orderBy = buildOrderBy(filters.sort, filters.dir);
    const shouldUseMeili =
      Boolean(filters.search) &&
      !filters.rigType &&
      !filters.hullType &&
      !filters.tag;

    if (shouldUseMeili) {
      try {
        const meiliResults = await runMeiliSearch(filters);
        if (meiliResults.hits.length) {
          const ids = meiliResults.hits.map((hit) => String(hit.id));
          const boats = await fetchBoats(ids, orderBy);

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

async function runMeiliSearch(filters: BoatSearchParams) {
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

async function runDatabaseSearch(filters: BoatSearchParams, orderBy: string) {
  const { where, params } = buildWhereClause(filters);
  const boats = await query<Record<string, unknown>>(
    `SELECT ${BOAT_FIELDS}
     FROM boats b
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE ${where}
     ORDER BY ${orderBy}
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, filters.limit, (filters.page - 1) * filters.limit]
  );

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*)
     FROM boats b
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

function buildOrderBy(sort: string, dir: string) {
  const SORT_MAP: Record<string, string> = {
    price: "COALESCE(b.asking_price_usd, b.asking_price)",
    size: "CAST(NULLIF(REGEXP_REPLACE(d.specs->>'loa', '[^0-9.]', '', 'g'), '') AS float)",
    year: "b.year",
    newest: "b.created_at",
  };
  const sortCol = SORT_MAP[sort] || SORT_MAP.newest;
  const sortDir = dir === "desc" ? "DESC" : "ASC";

  return `(EXISTS (SELECT 1 FROM boat_media bm WHERE bm.boat_id = b.id)) DESC, ${sortCol} ${sortDir} NULLS LAST`;
}

function buildWhereClause(filters: BoatSearchParams) {
  const conditions: string[] = ["b.status = 'active'"];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (filters.search) {
    conditions.push(
      `LOWER(CONCAT_WS(' ',
        b.make,
        b.model,
        COALESCE(d.ai_summary, ''),
        COALESCE(b.location_text, ''),
        COALESCE(b.source_name, ''),
        COALESCE(b.source_site, ''),
        array_to_string(COALESCE(d.character_tags, '{}'), ' '),
        COALESCE(d.specs->>'rig_type', ''),
        COALESCE(d.specs->>'hull_material', '')
      )) LIKE $${paramIdx++}`
    );
    params.push(`%${filters.search.trim().toLowerCase()}%`);
  }

  if (filters.minPrice) {
    conditions.push(`b.asking_price >= $${paramIdx++}`);
    params.push(parseFloat(filters.minPrice));
  }
  if (filters.maxPrice) {
    conditions.push(`b.asking_price <= $${paramIdx++}`);
    params.push(parseFloat(filters.maxPrice));
  }
  if (filters.minYear) {
    conditions.push(`b.year >= $${paramIdx++}`);
    params.push(parseInt(filters.minYear, 10));
  }
  if (filters.maxYear) {
    conditions.push(`b.year <= $${paramIdx++}`);
    params.push(parseInt(filters.maxYear, 10));
  }
  if (filters.rigType) {
    conditions.push(`LOWER(COALESCE(d.specs->>'rig_type', '')) = LOWER($${paramIdx++})`);
    params.push(filters.rigType);
  }
  if (filters.hullType) {
    conditions.push(`LOWER(COALESCE(d.specs->>'hull_material', '')) = LOWER($${paramIdx++})`);
    params.push(filters.hullType);
  }
  if (filters.tag) {
    conditions.push(`$${paramIdx++} = ANY(COALESCE(d.character_tags, '{}'))`);
    params.push(filters.tag);
  }

  return {
    where: conditions.join(" AND "),
    params,
  };
}

async function fetchBoats(ids: string[], orderBy: string) {
  return query<Record<string, unknown>>(
    `SELECT ${BOAT_FIELDS}
     FROM boats b
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE b.id = ANY($1)
       AND b.status = 'active'
     ORDER BY ${orderBy}`,
    [ids]
  );
}
