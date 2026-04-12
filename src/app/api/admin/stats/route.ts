import { requireRole } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getMeili, BOATS_INDEX } from "@/lib/meilisearch";
import { billingEnabled, emailEnabled, openAIEnabled, storageEnabled } from "@/lib/capabilities";
import { getFunnelSnapshot } from "@/lib/funnel";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await requireRole(["admin"]);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    type RecentSignupRow = {
      id: string;
      email: string;
      display_name: string | null;
      created_at: string;
      email_verified: boolean;
    };

    const liveUserWhere = `
      email <> 'system@onlyhulls.com'
      AND email NOT LIKE '%@onlyhulls.test'
      AND email NOT LIKE 'browser-%'
    `;

    const [users, admins, listings, pending, matches, intros, meiliStats, funnel30d, recentSignups] = await Promise.all([
      queryOne<{ count: string }>(`SELECT COUNT(*) FROM users WHERE ${liveUserWhere}`),
      queryOne<{ count: string }>("SELECT COUNT(*) FROM users WHERE role = 'admin'"),
      queryOne<{ count: string }>("SELECT COUNT(*) FROM boats WHERE status = 'active'"),
      queryOne<{ count: string }>("SELECT COUNT(*) FROM boats WHERE status = 'pending_review'"),
      queryOne<{ count: string }>("SELECT COUNT(*) FROM matches"),
      queryOne<{ count: string }>("SELECT COUNT(*) FROM introductions"),
      getMeili()
        .index(BOATS_INDEX)
        .getStats()
        .catch(() => null),
      getFunnelSnapshot(30),
      query<RecentSignupRow>(
        `SELECT id, email, display_name, created_at, email_verified
         FROM users
         WHERE ${liveUserWhere}
         ORDER BY created_at DESC
         LIMIT 8`
      ),
    ]);

    return NextResponse.json({
      totalUsers: parseInt(users?.count || "0"),
      adminUsers: parseInt(admins?.count || "0"),
      activeListings: parseInt(listings?.count || "0"),
      pendingListings: parseInt(pending?.count || "0"),
      totalMatches: parseInt(matches?.count || "0"),
      totalIntroductions: parseInt(intros?.count || "0"),
      funnel30d,
      recentSignups: recentSignups.map((signup) => ({
        id: signup.id,
        email: signup.email,
        displayName: signup.display_name,
        createdAt: signup.created_at,
        emailVerified: signup.email_verified,
      })),
      serviceStatus: {
        billingEnabled: billingEnabled(),
        emailEnabled: emailEnabled(),
        openAIEnabled: openAIEnabled(),
        storageEnabled: storageEnabled(),
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
