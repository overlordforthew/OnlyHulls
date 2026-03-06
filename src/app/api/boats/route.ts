import { query, queryOne } from "@/lib/db";
import { getMeili, BOATS_INDEX } from "@/lib/meilisearch";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const search = url.searchParams.get("q") || "";
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50);
  const minPrice = url.searchParams.get("minPrice");
  const maxPrice = url.searchParams.get("maxPrice");
  const minYear = url.searchParams.get("minYear");
  const maxYear = url.searchParams.get("maxYear");
  const rigType = url.searchParams.get("rigType");
  const hullType = url.searchParams.get("hullType");
  const tag = url.searchParams.get("tag");

  // If search query, use Meilisearch
  if (search) {
    try {
      // Always filter to active listings; coerce numeric params to prevent filter injection
      const filter: string[] = ["status = 'active'"];
      const minPriceNum = minPrice ? parseFloat(minPrice) : NaN;
      const maxPriceNum = maxPrice ? parseFloat(maxPrice) : NaN;
      const minYearNum = minYear ? parseInt(minYear, 10) : NaN;
      const maxYearNum = maxYear ? parseInt(maxYear, 10) : NaN;
      if (!isNaN(minPriceNum)) filter.push(`askingPrice >= ${minPriceNum}`);
      if (!isNaN(maxPriceNum)) filter.push(`askingPrice <= ${maxPriceNum}`);
      if (!isNaN(minYearNum)) filter.push(`year >= ${minYearNum}`);
      if (!isNaN(maxYearNum)) filter.push(`year <= ${maxYearNum}`);

      const results = await getMeili().index(BOATS_INDEX).search(search, {
        limit,
        offset: (page - 1) * limit,
        filter: filter.length ? filter : undefined,
      });

      // Fetch full boat data from DB for Meilisearch results
      if (results.hits.length) {
        const ids = results.hits.map((h) => h.id as string);
        const boats = await fetchBoats(ids);
        return NextResponse.json({
          boats,
          total: results.estimatedTotalHits || 0,
          page,
          limit,
        });
      }
      return NextResponse.json({ boats: [], total: 0, page, limit });
    } catch {
      // Fallback to DB search
    }
  }

  // Database query with filters
  const conditions: string[] = ["b.status = 'active'"];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (minPrice) {
    conditions.push(`b.asking_price >= $${paramIdx++}`);
    params.push(parseFloat(minPrice));
  }
  if (maxPrice) {
    conditions.push(`b.asking_price <= $${paramIdx++}`);
    params.push(parseFloat(maxPrice));
  }
  if (minYear) {
    conditions.push(`b.year >= $${paramIdx++}`);
    params.push(parseInt(minYear));
  }
  if (maxYear) {
    conditions.push(`b.year <= $${paramIdx++}`);
    params.push(parseInt(maxYear));
  }
  if (rigType) {
    conditions.push(`d.specs->>'rig_type' = $${paramIdx++}`);
    params.push(rigType);
  }
  if (hullType) {
    conditions.push(`d.specs->>'hull_material' = $${paramIdx++}`);
    params.push(hullType);
  }
  if (tag) {
    conditions.push(`$${paramIdx++} = ANY(d.character_tags)`);
    params.push(tag);
  }

  const where = conditions.join(" AND ");

  const boats = await query<Record<string, unknown>>(
    `SELECT b.id, b.make, b.model, b.year, b.asking_price, b.currency,
            b.location_text, b.slug, b.is_sample,
            (SELECT url FROM boat_media bm WHERE bm.boat_id = b.id ORDER BY sort_order LIMIT 1) as hero_url,
            COALESCE(d.specs, '{}') as specs,
            COALESCE(d.character_tags, '{}') as character_tags,
            d.condition_score
     FROM boats b
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE ${where}
     ORDER BY b.created_at DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    [...params, limit, (page - 1) * limit]
  );

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) FROM boats b LEFT JOIN boat_dna d ON d.boat_id = b.id WHERE ${where}`,
    params
  );

  return NextResponse.json({
    boats,
    total: parseInt(countResult?.count || "0"),
    page,
    limit,
  });
}

async function fetchBoats(ids: string[]) {
  return query<Record<string, unknown>>(
    `SELECT b.id, b.make, b.model, b.year, b.asking_price, b.currency,
            b.location_text, b.slug, b.is_sample,
            (SELECT url FROM boat_media bm WHERE bm.boat_id = b.id ORDER BY sort_order LIMIT 1) as hero_url,
            COALESCE(d.specs, '{}') as specs,
            COALESCE(d.character_tags, '{}') as character_tags,
            d.condition_score
     FROM boats b
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE b.id = ANY($1)
     ORDER BY b.created_at DESC`,
    [ids]
  );
}
