import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { buildVisibleImportQualitySql } from "@/lib/import-quality";
import {
  buildLocationLikePattern,
  getLocationSearchTerms,
  TOP_LOCATION_MARKETS,
} from "@/lib/locations/top-markets";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const params: unknown[] = [];
    const countColumns = TOP_LOCATION_MARKETS.map((market, index) => {
      const clauses: string[] = [];

      params.push(market.slug);
      clauses.push(`b.location_market_slugs @> ARRAY[$${params.length}]::text[]`);

      getLocationSearchTerms(market.slug).forEach((term) => {
        params.push(buildLocationLikePattern(term));
        clauses.push(`LOWER(COALESCE(b.location_text, '')) LIKE $${params.length} ESCAPE '\\'`);
      });

      return `COUNT(*) FILTER (WHERE (${clauses.join(" OR ")}))::int AS market_${index}`;
    });

    const row = await queryOne<Record<string, number | string>>(
      `SELECT ${countColumns.join(", ")}
       FROM boats b
       LEFT JOIN boat_dna d ON d.boat_id = b.id
       WHERE b.status = 'active'
         AND ${buildVisibleImportQualitySql("b")}`,
      params
    );
    const counts = Object.fromEntries(
      TOP_LOCATION_MARKETS.map((market, index) => [
        market.slug,
        Number(row?.[`market_${index}`] || 0),
      ])
    );

    return NextResponse.json(
      { counts },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
        },
      }
    );
  } catch (err) {
    logger.warn({ err }, "Failed to load location market counts");
    return NextResponse.json({ counts: {} }, { status: 200 });
  }
}
