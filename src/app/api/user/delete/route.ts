import { auth } from "@/auth";
import { query, queryOne } from "@/lib/db";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Cascade delete all user data in dependency order
  await query("DELETE FROM ai_conversations WHERE user_id = $1", [userId]);
  await query("DELETE FROM introductions WHERE buyer_id = $1 OR seller_id = $1", [userId]);
  await query("DELETE FROM matches WHERE buyer_id = $1", [userId]);
  await query("DELETE FROM buyer_profiles WHERE user_id = $1", [userId]);
  await query(
    `DELETE FROM boat_media WHERE boat_id IN (SELECT id FROM boats WHERE seller_id = $1)`,
    [userId]
  );
  await query(
    `DELETE FROM boat_dna WHERE boat_id IN (SELECT id FROM boats WHERE seller_id = $1)`,
    [userId]
  );
  await query("DELETE FROM boats WHERE seller_id = $1", [userId]);
  await query("DELETE FROM users WHERE id = $1", [userId]);

  logger.info({ userId }, "GDPR: user account and all associated data deleted");

  return NextResponse.json({ success: true, message: "Account and all data permanently deleted" });
}
