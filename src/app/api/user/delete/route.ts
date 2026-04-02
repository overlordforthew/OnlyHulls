import { auth } from "@/auth";
import { pool } from "@/lib/db";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Cascade delete all user data — null FK refs first, then delete in dependency order
    await client.query("UPDATE buyer_profiles SET ai_conversation_id = NULL WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM introductions WHERE buyer_id = $1 OR seller_id = $1", [userId]);
    await client.query("DELETE FROM matches WHERE buyer_id = $1", [userId]);
    await client.query("DELETE FROM buyer_profiles WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM ai_conversations WHERE user_id = $1", [userId]);
    await client.query(
      `DELETE FROM boat_media WHERE boat_id IN (SELECT id FROM boats WHERE seller_id = $1)`,
      [userId]
    );
    await client.query(
      `DELETE FROM boat_dna WHERE boat_id IN (SELECT id FROM boats WHERE seller_id = $1)`,
      [userId]
    );
    await client.query("DELETE FROM boats WHERE seller_id = $1", [userId]);
    await client.query("DELETE FROM users WHERE id = $1", [userId]);

    await client.query("COMMIT");

    logger.info({ userId }, "GDPR: user account and all associated data deleted");

    return NextResponse.json({ success: true, message: "Account and all data permanently deleted" });
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err }, "DELETE /api/user/delete error");
    return NextResponse.json(
      { error: "Failed to delete account. Please try again or contact support." },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
