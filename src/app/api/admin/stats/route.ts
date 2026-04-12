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
    type RecentActivityRow = {
      id: string;
      event_type: string;
      created_at: string;
      email: string | null;
      display_name: string | null;
      boat_title: string | null;
      payload: Record<string, unknown> | null;
    };

    const liveUserWhere = `
      email <> 'system@onlyhulls.com'
      AND email NOT LIKE '%@onlyhulls.test'
      AND email NOT LIKE 'browser-%'
    `;

    const [users, admins, listings, pending, matches, intros, meiliStats, funnel30d, recentSignups, recentActivity] = await Promise.all([
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
      query<RecentActivityRow>(
        `SELECT fe.id,
                fe.event_type,
                fe.created_at,
                u.email,
                u.display_name,
                CASE
                  WHEN b.id IS NOT NULL THEN CONCAT(b.year, ' ', b.make, ' ', b.model)
                  ELSE NULL
                END AS boat_title,
                fe.payload
         FROM funnel_events fe
         LEFT JOIN users u ON u.id = fe.user_id
         LEFT JOIN boats b ON b.id = fe.boat_id
         ORDER BY fe.created_at DESC
         LIMIT 12`
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
      recentActivity: recentActivity.map((activity) => ({
        id: activity.id,
        eventType: activity.event_type,
        createdAt: activity.created_at,
        email: activity.email,
        displayName: activity.display_name,
        boatTitle: activity.boat_title,
        payload: activity.payload || {},
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
