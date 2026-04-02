import { auth } from "@/auth";
import { query, queryOne } from "@/lib/db";
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
      await query(
        `INSERT INTO buyer_profiles
          (user_id, use_case, budget_range, boat_type_prefs, spec_preferences,
           location_prefs, experience_level, deal_breakers, timeline, refit_tolerance)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [session.user.id, ...fields]
      );
    }
  } catch (err) {
    logger.error({ err }, "POST /api/user/profile error");
    return NextResponse.json(
      { error: "Failed to save profile. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
