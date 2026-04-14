import { auth } from "@/auth";
import { query, queryOne } from "@/lib/db";
import { ensureMatchExplanation } from "@/lib/ai/match-explanations";
import { buildVisibleImportQualitySql } from "@/lib/import-quality";
import { computeMatchesForBuyer } from "@/lib/matching/engine";
import { boatMatchesDesiredTypes } from "@/lib/matching/heuristic";
import {
  buildMatchOrderBy,
  parseMatchDir,
  parseMatchSort,
} from "@/lib/matching/match-sort";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";

type MatchRow = {
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
  source_site: string | null;
  source_name: string | null;
  source_url: string | null;
  seller_subscription_tier: string | null;
  hero_url: string | null;
  specs: Record<string, unknown>;
  character_tags: string[];
};

async function countVisibleMatches(buyerId: string) {
  return queryOne<{ count: string }>(
    `SELECT COUNT(*) FROM matches m
     JOIN boats b ON b.id = m.boat_id
     WHERE m.buyer_id = $1
       AND m.buyer_action != 'passed'
       AND b.status = 'active'
       AND ${buildVisibleImportQualitySql("b")}`,
    [buyerId]
  );
}

async function fetchMatchesPage(
  buyerId: string,
  limit: number,
  offset: number,
  orderBy: string
) {
  return query<MatchRow>(
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
            b.location_text, b.slug, b.is_sample, b.source_site, b.source_name, b.source_url,
            COALESCE(u.subscription_tier::text, 'free') as seller_subscription_tier,
            (SELECT url FROM boat_media bm WHERE bm.boat_id = b.id AND bm.type = 'image' ORDER BY sort_order LIMIT 1) as hero_url,
            COALESCE(d.specs, '{}') as specs,
            COALESCE(d.character_tags, '{}') as character_tags
     FROM matches m
     JOIN boats b ON b.id = m.boat_id
     LEFT JOIN users u ON u.id = b.seller_id
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     LEFT JOIN match_explanations me ON me.match_id = m.id
     LEFT JOIN match_ai_signals mas ON mas.match_id = m.id
     WHERE m.buyer_id = $1
       AND m.buyer_action != 'passed'
       AND b.status = 'active'
       AND ${buildVisibleImportQualitySql("b")}
     ORDER BY ${orderBy}
     LIMIT $2 OFFSET $3`,
    [buyerId, limit, offset]
  );
}

function matchViolatesBoatTypePrefs(
  buyerProfile: { boat_type_prefs: Record<string, unknown> },
  match: MatchRow
) {
  return !boatMatchesDesiredTypes(buyerProfile, {
    id: match.boat_id,
    make: match.make,
    model: match.model,
    asking_price: match.asking_price,
    asking_price_usd: match.asking_price_usd,
    currency: match.currency,
    year: match.year,
    location_text: match.location_text,
    specs: match.specs,
    condition_score: null,
    character_tags: match.character_tags,
  });
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
    const sort = parseMatchSort(url.searchParams.get("sort"));
    const dir = parseMatchDir(url.searchParams.get("dir"), sort);
    const orderBy = buildMatchOrderBy(sort, dir);

    const user = await queryOne<{ id: string }>(
      "SELECT id FROM users WHERE id = $1",
      [session.user.id]
    );
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const buyerProfile = await queryOne<{ id: string; boat_type_prefs: Record<string, unknown> }>(
      "SELECT id, boat_type_prefs FROM buyer_profiles WHERE user_id = $1",
      [user.id]
    );
    if (!buyerProfile) {
      return NextResponse.json({ matches: [], total: 0, needsProfile: true });
    }

    let countResult = await countVisibleMatches(buyerProfile.id);

    if (parseInt(countResult?.count || "0", 10) === 0) {
      await computeMatchesForBuyer(buyerProfile.id);
      countResult = await countVisibleMatches(buyerProfile.id);
    }

    let matches = await fetchMatchesPage(buyerProfile.id, limit, offset, orderBy);
    const pageHasTypeMismatch = matches.some((match) =>
      matchViolatesBoatTypePrefs(buyerProfile, match)
    );

    if (pageHasTypeMismatch) {
      logger.warn({ buyerProfileId: buyerProfile.id }, "Visible matches included stale boat type mismatch; recomputing");
      await computeMatchesForBuyer(buyerProfile.id);
      countResult = await countVisibleMatches(buyerProfile.id);
      matches = await fetchMatchesPage(buyerProfile.id, limit, offset, orderBy);
    }

    await Promise.allSettled(
      matches
        .filter((match, index) => !match.explanation_summary && index < 3)
        .map((match) => ensureMatchExplanation(match.match_id))
    );

    const matchesWithFreshExplanations = await fetchMatchesPage(
      buyerProfile.id,
      limit,
      offset,
      orderBy
    );
    const visibleMatches = matchesWithFreshExplanations.filter(
      (match) => !matchViolatesBoatTypePrefs(buyerProfile, match)
    );
    const filteredCount = matchesWithFreshExplanations.length - visibleMatches.length;
    if (filteredCount > 0) {
      logger.error(
        { buyerProfileId: buyerProfile.id, filteredCount },
        "Filtered invalid boat types from response after recompute"
      );
    }
    const total = Math.max(
      parseInt(countResult?.count || "0", 10) - filteredCount,
      visibleMatches.length
    );

    return NextResponse.json({
      matches: visibleMatches,
      total,
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
