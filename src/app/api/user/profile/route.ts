import { auth } from "@/auth";
import { query, queryOne } from "@/lib/db";
import {
  embeddingsEnabled,
  generateEmbedding,
  profileToEmbeddingText,
} from "@/lib/ai/embeddings";
import { computeMatchesForBuyer } from "@/lib/matching/engine";
import { trackFunnelEvent } from "@/lib/funnel";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let profile;
  try {
    profile = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const existing = await queryOne<{ id: string }>(
    "SELECT id FROM buyer_profiles WHERE user_id = $1",
    [session.user.id]
  );

  const toPgArray = (v: unknown): string => {
    const arr = Array.isArray(v) ? v.map(String) : v ? [String(v)] : [];
    return `{${arr.map(s => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(',')}}`;
  };

  const fields = [
    toPgArray(profile.use_case),
    JSON.stringify(profile.budget_range || {}),
    JSON.stringify(profile.boat_type_prefs || {}),
    JSON.stringify(profile.spec_preferences || {}),
    JSON.stringify(profile.location_prefs || {}),
    profile.experience_level || "novice",
    toPgArray(profile.deal_breakers),
    profile.timeline || "browsing",
    profile.refit_tolerance || "minor",
  ];

  let buyerProfileId = existing?.id ?? null;

  try {
    if (existing) {
      await query(
        `UPDATE buyer_profiles SET
          use_case = $1, budget_range = $2, boat_type_prefs = $3,
          spec_preferences = $4, location_prefs = $5, experience_level = $6,
          deal_breakers = $7, timeline = $8, refit_tolerance = $9,
          updated_at = NOW()
        WHERE user_id = $10`,
        [...fields, session.user.id]
      );
    } else {
      const inserted = await queryOne<{ id: string }>(
        `INSERT INTO buyer_profiles
          (user_id, use_case, budget_range, boat_type_prefs, spec_preferences,
            location_prefs, experience_level, deal_breakers, timeline, refit_tolerance)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id`,
        [session.user.id, ...fields]
      );
      buyerProfileId = inserted?.id ?? null;
    }
  } catch (err) {
    logger.error({ err }, "POST /api/user/profile error");
    return NextResponse.json(
      { error: "Failed to save profile. Please try again." },
      { status: 500 }
    );
  }

  if (!buyerProfileId) {
    return NextResponse.json(
      { error: "Profile was saved but could not be finalized." },
      { status: 500 }
    );
  }

  try {
    if (embeddingsEnabled()) {
      const embedding = await generateEmbedding(profileToEmbeddingText(profile));
      await query("UPDATE buyer_profiles SET dna_embedding = $1 WHERE id = $2", [
        `[${embedding.join(",")}]`,
        buyerProfileId,
      ]);
    } else {
      await query("UPDATE buyer_profiles SET dna_embedding = NULL WHERE id = $1", [
        buyerProfileId,
      ]);
    }
  } catch (err) {
    logger.warn({ err, buyerProfileId }, "Failed to refresh buyer embedding");
    await query("UPDATE buyer_profiles SET dna_embedding = NULL WHERE id = $1", [
      buyerProfileId,
    ]);
  }

  try {
    const matches = await computeMatchesForBuyer(buyerProfileId);
    await trackFunnelEvent({
      eventType: "buyer_profile_saved",
      userId: session.user.id,
      payload: { matches: matches.length },
    });
    return NextResponse.json({ ok: true, matches: matches.length });
  } catch (err) {
    logger.error({ err, buyerProfileId }, "Failed to compute matches after profile save");
    return NextResponse.json({ ok: true, matches: 0 });
  }
}
