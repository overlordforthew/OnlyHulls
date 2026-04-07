import { requireRole } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getMeili, BOATS_INDEX } from "@/lib/meilisearch";
import { billingEnabled, emailEnabled, openAIEnabled } from "@/lib/capabilities";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await requireRole(["admin"]);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [users, admins, listings, pending, matches, intros, meiliStats] = await Promise.all([
      queryOne<{ count: string }>("SELECT COUNT(*) FROM users"),
      queryOne<{ count: string }>("SELECT COUNT(*) FROM users WHERE role = 'admin'"),
      queryOne<{ count: string }>("SELECT COUNT(*) FROM boats WHERE status = 'active'"),
      queryOne<{ count: string }>("SELECT COUNT(*) FROM boats WHERE status = 'pending_review'"),
      queryOne<{ count: string }>("SELECT COUNT(*) FROM matches"),
      queryOne<{ count: string }>("SELECT COUNT(*) FROM introductions"),
      getMeili()
        .index(BOATS_INDEX)
        .getStats()
        .catch(() => null),
    ]);

    return NextResponse.json({
      totalUsers: parseInt(users?.count || "0"),
      adminUsers: parseInt(admins?.count || "0"),
      activeListings: parseInt(listings?.count || "0"),
      pendingListings: parseInt(pending?.count || "0"),
      totalMatches: parseInt(matches?.count || "0"),
      totalIntroductions: parseInt(intros?.count || "0"),
      serviceStatus: {
        billingEnabled: billingEnabled(),
        emailEnabled: emailEnabled(),
        openAIEnabled: openAIEnabled(),
        meiliDocuments: meiliStats?.numberOfDocuments || 0,
      },
    });
  } catch (err) {
    logger.error({ err }, "GET /api/admin/stats error");
    return NextResponse.json(
      { error: "Failed to load stats" },
      { status: 500 }
    );
  }
}
