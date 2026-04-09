import { auth } from "@/auth";
import { query, queryOne } from "@/lib/db";
import { ensureMatchExplanation } from "@/lib/ai/match-explanations";
import { buildVisibleImportQualitySql } from "@/lib/import-quality";
import { computeMatchesForBuyer } from "@/lib/matching/engine";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";

type MatchSort = "match" | "price" | "year" | "size" | "newest";
type SortDir = "asc" | "desc";

function parseSort(value: string | null): MatchSort {
  return value === "price" || value === "year" || value === "size" || value === "newest"
    ? value
    : "match";
}

function parseDir(value: string | null, sort: MatchSort): SortDir {
  if (value === "asc" || value === "desc") return value;
  return sort === "price" || sort === "size" ? "asc" : "desc";
}

function buildOrderBy(sort: MatchSort, dir: SortDir) {
  switch (sort) {
    case "price":
      return `COALESCE(b.asking_price_usd, b.asking_price) ${dir.toUpperCase()} NULLS LAST, m.score DESC`;
    case "year":
      return `b.year ${dir.toUpperCase()} NULLS LAST, m.score DESC`;
    case "size":
      return `COALESCE((d.specs->>'loa')::numeric, 0) ${dir.toUpperCase()} NULLS LAST, m.score DESC`;
    case "newest":
      return `COALESCE(b.listing_date, DATE(b.created_at)) ${dir.toUpperCase()} NULLS LAST, m.score DESC`;
    case "match":
    default:
      return `m.score ${dir.toUpperCase()} NULLS LAST`;
  }
}

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50);
    const offset = (page - 1) * limit;
    const sort = parseSort(url.searchParams.get("sort"));
    const dir = parseDir(url.searchParams.get("dir"), sort);
    const orderBy = buildOrderBy(sort, dir);

    const user = await queryOne<{ id: string }>(
      "SELECT id FROM users WHERE id = $1",
      [session.user.id]
    );
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const buyerProfile = await queryOne<{ id: string }>(
      "SELECT id FROM buyer_profiles WHERE user_id = $1",
      [user.id]
    );
    if (!buyerProfile) {
      return NextResponse.json({ matches: [], total: 0, needsProfile: true });
    }

    let countResult = await queryOne<{ count: string }>(
      `SELECT COUNT(*) FROM matches m
       JOIN boats b ON b.id = m.boat_id
       WHERE m.buyer_id = $1
         AND m.buyer_action != 'passed'
         AND b.status = 'active'
         AND ${buildVisibleImportQualitySql("b")}`,
      [buyerProfile.id]
    );

    if (parseInt(countResult?.count || "0", 10) === 0) {
      await computeMatchesForBuyer(buyerProfile.id);
      countResult = await queryOne<{ count: string }>(
        `SELECT COUNT(*) FROM matches m
         JOIN boats b ON b.id = m.boat_id
         WHERE m.buyer_id = $1
           AND m.buyer_action != 'passed'
           AND b.status = 'active'
           AND ${buildVisibleImportQualitySql("b")}`,
        [buyerProfile.id]
      );
    }

    const matches = await query<{
      match_id: string;
      score: number;
      score_breakdown: Record<string, number>;
      buyer_action: string;
      explanation_summary: string | null;
      explanation_strengths: string[] | null;
      explanation_risks: string[] | null;
      explanation_confidence: number | null;
      explanation_provider: string | null;
      explanation_model: string | null;
      ai_score: number | null;
      ai_verdict: string | null;
      ai_provider: string | null;
      boat_id: string;
      make: string;
      model: string;
      year: number;
      asking_price: number;
      asking_price_usd: number | null;
      currency: string;
      location_text: string | null;
      slug: string | null;
      is_sample: boolean;
      hero_url: string | null;
      specs: Record<string, unknown>;
      character_tags: string[];
    }>(
      `SELECT m.id as match_id, m.score, m.score_breakdown, m.buyer_action,
              me.summary as explanation_summary,
              me.strengths as explanation_strengths,
              me.risks as explanation_risks,
              me.confidence as explanation_confidence,
              me.provider as explanation_provider,
              me.model as explanation_model,
              mas.ai_score,
              mas.verdict as ai_verdict,
              mas.provider as ai_provider,
              b.id as boat_id, b.make, b.model, b.year, b.asking_price, b.asking_price_usd, b.currency,
              b.location_text, b.slug, b.is_sample,
              (SELECT url FROM boat_media bm WHERE bm.boat_id = b.id AND bm.type = 'image' ORDER BY sort_order LIMIT 1) as hero_url,
              COALESCE(d.specs, '{}') as specs,
              COALESCE(d.character_tags, '{}') as character_tags
       FROM matches m
       JOIN boats b ON b.id = m.boat_id
       LEFT JOIN boat_dna d ON d.boat_id = b.id
       LEFT JOIN match_explanations me ON me.match_id = m.id
       LEFT JOIN match_ai_signals mas ON mas.match_id = m.id
       WHERE m.buyer_id = $1
         AND m.buyer_action != 'passed'
         AND b.status = 'active'
         AND ${buildVisibleImportQualitySql("b")}
       ORDER BY ${orderBy}
       LIMIT $2 OFFSET $3`,
      [buyerProfile.id, limit, offset]
    );

    await Promise.allSettled(
      matches
        .filter((match, index) => !match.explanation_summary && index < 3)
        .map((match) => ensureMatchExplanation(match.match_id))
    );

    const matchesWithFreshExplanations = await query<{
      match_id: string;
      score: number;
      score_breakdown: Record<string, number>;
      buyer_action: string;
      explanation_summary: string | null;
      explanation_strengths: string[] | null;
      explanation_risks: string[] | null;
      explanation_confidence: number | null;
      explanation_provider: string | null;
      explanation_model: string | null;
      ai_score: number | null;
      ai_verdict: string | null;
      ai_provider: string | null;
      boat_id: string;
      make: string;
      model: string;
      year: number;
      asking_price: number;
      asking_price_usd: number | null;
      currency: string;
      location_text: string | null;
      slug: string | null;
      is_sample: boolean;
      hero_url: string | null;
      specs: Record<string, unknown>;
      character_tags: string[];
    }>(
      `SELECT m.id as match_id, m.score, m.score_breakdown, m.buyer_action,
              me.summary as explanation_summary,
              me.strengths as explanation_strengths,
              me.risks as explanation_risks,
              me.confidence as explanation_confidence,
              me.provider as explanation_provider,
              me.model as explanation_model,
              mas.ai_score,
              mas.verdict as ai_verdict,
              mas.provider as ai_provider,
              b.id as boat_id, b.make, b.model, b.year, b.asking_price, b.asking_price_usd, b.currency,
              b.location_text, b.slug, b.is_sample,
              (SELECT url FROM boat_media bm WHERE bm.boat_id = b.id AND bm.type = 'image' ORDER BY sort_order LIMIT 1) as hero_url,
              COALESCE(d.specs, '{}') as specs,
              COALESCE(d.character_tags, '{}') as character_tags
       FROM matches m
       JOIN boats b ON b.id = m.boat_id
       LEFT JOIN boat_dna d ON d.boat_id = b.id
       LEFT JOIN match_explanations me ON me.match_id = m.id
       LEFT JOIN match_ai_signals mas ON mas.match_id = m.id
       WHERE m.buyer_id = $1
         AND m.buyer_action != 'passed'
         AND b.status = 'active'
         AND ${buildVisibleImportQualitySql("b")}
       ORDER BY ${orderBy}
       LIMIT $2 OFFSET $3`,
      [buyerProfile.id, limit, offset]
    );

    return NextResponse.json({
      matches: matchesWithFreshExplanations,
      total: parseInt(countResult?.count || "0", 10),
      page,
      limit,
      sort,
      dir,
    });
  } catch (err) {
    logger.error({ err }, "GET /api/matches error");
    return NextResponse.json(
      { error: "Failed to load matches. Please try again." },
      { status: 500 }
    );
  }
}
