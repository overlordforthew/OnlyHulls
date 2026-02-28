import { auth } from "@/auth";
import { query, queryOne } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
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

  const matches = await query<{
    match_id: string;
    score: number;
    score_breakdown: Record<string, number>;
    buyer_action: string;
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
            b.id as boat_id, b.make, b.model, b.year, b.asking_price, b.currency,
            b.location_text, b.slug, b.is_sample,
            (SELECT url FROM boat_media bm WHERE bm.boat_id = b.id ORDER BY sort_order LIMIT 1) as hero_url,
            COALESCE(d.specs, '{}') as specs,
            COALESCE(d.character_tags, '{}') as character_tags
     FROM matches m
     JOIN boats b ON b.id = m.boat_id
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE m.buyer_id = $1
       AND m.buyer_action != 'passed'
       AND b.status = 'active'
     ORDER BY m.score DESC
     LIMIT $2 OFFSET $3`,
    [buyerProfile.id, limit, offset]
  );

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) FROM matches m
     JOIN boats b ON b.id = m.boat_id
     WHERE m.buyer_id = $1 AND m.buyer_action != 'passed' AND b.status = 'active'`,
    [buyerProfile.id]
  );

  return NextResponse.json({
    matches,
    total: parseInt(countResult?.count || "0"),
    page,
    limit,
  });
}
