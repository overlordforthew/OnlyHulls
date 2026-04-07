import { auth } from "@/auth";
import { query, queryOne } from "@/lib/db";
import { ensureMatchExplanation } from "@/lib/ai/match-explanations";
import { computeMatchesForBuyer } from "@/lib/matching/engine";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";

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
       WHERE m.buyer_id = $1 AND m.buyer_action != 'passed' AND b.status = 'active'`,
      [buyerProfile.id]
    );

    if (parseInt(countResult?.count || "0", 10) === 0) {
      await computeMatchesForBuyer(buyerProfile.id);
      countResult = await queryOne<{ count: string }>(
        `SELECT COUNT(*) FROM matches m
         JOIN boats b ON b.id = m.boat_id
         WHERE m.buyer_id = $1 AND m.buyer_action != 'passed' AND b.status = 'active'`,
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
      boat_id: string;
      make: string;
      model: string;
      year: number;
      asking_price: number;
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
              b.id as boat_id, b.make, b.model, b.year, b.asking_price, b.currency,
              b.location_text, b.slug, b.is_sample,
              (SELECT url FROM boat_media bm WHERE bm.boat_id = b.id AND bm.type = 'image' ORDER BY sort_order LIMIT 1) as hero_url,
              COALESCE(d.specs, '{}') as specs,
              COALESCE(d.character_tags, '{}') as character_tags
       FROM matches m
       JOIN boats b ON b.id = m.boat_id
       LEFT JOIN boat_dna d ON d.boat_id = b.id
       LEFT JOIN match_explanations me ON me.match_id = m.id
       WHERE m.buyer_id = $1
         AND m.buyer_action != 'passed'
         AND b.status = 'active'
       ORDER BY m.score DESC
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
      boat_id: string;
      make: string;
      model: string;
      year: number;
      asking_price: number;
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
              b.id as boat_id, b.make, b.model, b.year, b.asking_price, b.currency,
              b.location_text, b.slug, b.is_sample,
              (SELECT url FROM boat_media bm WHERE bm.boat_id = b.id AND bm.type = 'image' ORDER BY sort_order LIMIT 1) as hero_url,
              COALESCE(d.specs, '{}') as specs,
              COALESCE(d.character_tags, '{}') as character_tags
       FROM matches m
       JOIN boats b ON b.id = m.boat_id
       LEFT JOIN boat_dna d ON d.boat_id = b.id
       LEFT JOIN match_explanations me ON me.match_id = m.id
       WHERE m.buyer_id = $1
         AND m.buyer_action != 'passed'
         AND b.status = 'active'
       ORDER BY m.score DESC
       LIMIT $2 OFFSET $3`,
      [buyerProfile.id, limit, offset]
    );

    return NextResponse.json({
      matches: matchesWithFreshExplanations,
      total: parseInt(countResult?.count || "0", 10),
      page,
      limit,
    });
  } catch (err) {
    logger.error({ err }, "GET /api/matches error");
    return NextResponse.json(
      { error: "Failed to load matches. Please try again." },
      { status: 500 }
    );
  }
}
