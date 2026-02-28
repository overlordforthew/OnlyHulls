import { auth } from "@/auth";
import { query, queryOne } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const actionSchema = z.object({
  action: z.enum(["interested", "passed", "dreamboard", "none"]),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: matchId } = await params;
  const body = await req.json();
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  // Verify the match belongs to this user
  const user = await queryOne<{ id: string }>(
    "SELECT id FROM users WHERE id = $1",
    [session.user.id]
  );
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const match = await queryOne<{ id: string }>(
    `SELECT m.id FROM matches m
     JOIN buyer_profiles bp ON bp.id = m.buyer_id
     WHERE m.id = $1 AND bp.user_id = $2`,
    [matchId, user.id]
  );

  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  await query(
    "UPDATE matches SET buyer_action = $1, updated_at = NOW() WHERE id = $2",
    [parsed.data.action, matchId]
  );

  return NextResponse.json({ success: true });
}
