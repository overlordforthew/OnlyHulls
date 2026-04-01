import { auth } from "@/auth";
import { query, queryOne } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const clickSchema = z.object({
  clickType: z.enum(["guest", "save_and_continue"]),
  sessionId: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: boatId } = await params;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = clickSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { clickType, sessionId } = parsed.data;

  // Optional auth — don't fail for guests
  const session = await auth();
  const userId = session?.user?.id || null;

  // Look up boat source info for denormalization
  const boat = await queryOne<{ source_site: string | null; source_url: string | null }>(
    "SELECT source_site, source_url FROM boats WHERE id = $1",
    [boatId]
  );

  if (!boat) {
    return NextResponse.json({ error: "Boat not found" }, { status: 404 });
  }

  // Log the click (fire-and-forget)
  query(
    `INSERT INTO contact_clicks (boat_id, user_id, click_type, source_site, source_url, session_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [boatId, userId, clickType, boat.source_site, boat.source_url, sessionId || null]
  ).catch(() => {});

  // Save to dreamboard if authenticated + has buyer profile
  if (clickType === "save_and_continue" && userId) {
    const profile = await queryOne<{ id: string }>(
      "SELECT id FROM buyer_profiles WHERE user_id = $1",
      [userId]
    );
    if (profile) {
      query(
        `INSERT INTO dreamboard (buyer_id, boat_id, note)
         VALUES ($1, $2, 'Saved via contact gate')
         ON CONFLICT (buyer_id, boat_id) DO NOTHING`,
        [profile.id, boatId]
      ).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true });
}
