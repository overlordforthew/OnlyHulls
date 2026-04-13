import { requireRole } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getMeili, BOATS_INDEX } from "@/lib/meilisearch";
import {
  billingEnabled,
  emailEnabled,
  embeddingProvider,
  matchIntelligenceConfigured,
  matchIntelligenceProvider,
  openAIEnabled,
  semanticMatchingEnabled,
  storageEnabled,
} from "@/lib/capabilities";
import { getOwnerAlertRecipients } from "@/lib/email/resend";
import { getFunnelSnapshot } from "@/lib/funnel";
import { buildVisibleImportQualitySql } from "@/lib/import-quality";
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
    type ImportQualitySummaryRow = {
      active_count: string;
      visible_count: string;
      missing_model_count: string;
      missing_location_count: string;
      missing_image_count: string;
      thin_summary_count: string;
      low_price_count: string;
    };
    type SourceHealthRow = {
      source: string;
      active_count: string;
      visible_count: string;
      missing_model_count: string;
      missing_location_count: string;
      missing_image_count: string;
      thin_summary_count: string;
      low_price_count: string;
    };
    type OwnerPulseRow = {
      saved_searches_24h: string;
      shortlists_24h: string;
      connect_requests_24h: string;
      seller_listings_24h: string;
      last_saved_search_at: string | null;
      last_shortlist_at: string | null;
      last_connect_request_at: string | null;
      last_seller_listing_at: string | null;
    };
    type SignupPulseRow = {
      signups_24h: string;
      last_signup_at: string | null;
    };

    const liveUserWhere = `
      email <> 'system@onlyhulls.com'
      AND email NOT LIKE '%@onlyhulls.test'
      AND email NOT LIKE 'browser-%'
    `;

    const [
      users,
      admins,
      listings,
      pending,
      matches,
      intros,
      meiliStats,
      funnel30d,
      recentSignups,
      recentActivity,
      importQualitySummary,
      sourceHealth,
      ownerPulse,
      signupPulse,
    ] = await Promise.all([
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
      queryOne<ImportQualitySummaryRow>(
        `SELECT
           COUNT(*)::text AS active_count,
           COUNT(*) FILTER (WHERE ${buildVisibleImportQualitySql("b")})::text AS visible_count,
           COUNT(*) FILTER (
             WHERE COALESCE(d.documentation_status->'import_quality_flags', '[]'::jsonb) ? 'missing_model'
           )::text AS missing_model_count,
           COUNT(*) FILTER (
             WHERE COALESCE(d.documentation_status->'import_quality_flags', '[]'::jsonb) ? 'missing_location'
           )::text AS missing_location_count,
           COUNT(*) FILTER (
             WHERE COALESCE(d.documentation_status->'import_quality_flags', '[]'::jsonb) ? 'missing_image'
           )::text AS missing_image_count,
           COUNT(*) FILTER (
             WHERE COALESCE(d.documentation_status->'import_quality_flags', '[]'::jsonb) ? 'thin_summary'
           )::text AS thin_summary_count,
           COUNT(*) FILTER (
             WHERE COALESCE(d.documentation_status->'import_quality_flags', '[]'::jsonb) ? 'low_price'
           )::text AS low_price_count
         FROM boats b
         LEFT JOIN boat_dna d ON d.boat_id = b.id
         WHERE b.status = 'active'`
      ),
      query<SourceHealthRow>(
        `SELECT
           COALESCE(b.source_name, 'Platform') AS source,
           COUNT(*)::text AS active_count,
           COUNT(*) FILTER (WHERE ${buildVisibleImportQualitySql("b")})::text AS visible_count,
           COUNT(*) FILTER (
             WHERE COALESCE(d.documentation_status->'import_quality_flags', '[]'::jsonb) ? 'missing_model'
           )::text AS missing_model_count,
           COUNT(*) FILTER (
             WHERE COALESCE(d.documentation_status->'import_quality_flags', '[]'::jsonb) ? 'missing_location'
           )::text AS missing_location_count,
           COUNT(*) FILTER (
             WHERE COALESCE(d.documentation_status->'import_quality_flags', '[]'::jsonb) ? 'missing_image'
           )::text AS missing_image_count,
           COUNT(*) FILTER (
             WHERE COALESCE(d.documentation_status->'import_quality_flags', '[]'::jsonb) ? 'thin_summary'
           )::text AS thin_summary_count,
           COUNT(*) FILTER (
             WHERE COALESCE(d.documentation_status->'import_quality_flags', '[]'::jsonb) ? 'low_price'
           )::text AS low_price_count
         FROM boats b
         LEFT JOIN boat_dna d ON d.boat_id = b.id
         WHERE b.status = 'active'
         GROUP BY COALESCE(b.source_name, 'Platform')
         ORDER BY COUNT(*) FILTER (WHERE ${buildVisibleImportQualitySql("b")}) DESC, COUNT(*) DESC
         LIMIT 8`
      ),
      queryOne<OwnerPulseRow>(
        `SELECT
           COUNT(*) FILTER (WHERE event_type = 'saved_search_created' AND created_at >= NOW() - INTERVAL '24 hours')::text AS saved_searches_24h,
           COUNT(*) FILTER (WHERE event_type = 'match_interested' AND created_at >= NOW() - INTERVAL '24 hours')::text AS shortlists_24h,
           COUNT(*) FILTER (WHERE event_type = 'connect_requested' AND created_at >= NOW() - INTERVAL '24 hours')::text AS connect_requests_24h,
           COUNT(*) FILTER (WHERE event_type = 'seller_listing_created' AND created_at >= NOW() - INTERVAL '24 hours')::text AS seller_listings_24h,
           MAX(created_at) FILTER (WHERE event_type = 'saved_search_created') AS last_saved_search_at,
           MAX(created_at) FILTER (WHERE event_type = 'match_interested') AS last_shortlist_at,
           MAX(created_at) FILTER (WHERE event_type = 'connect_requested') AS last_connect_request_at,
           MAX(created_at) FILTER (WHERE event_type = 'seller_listing_created') AS last_seller_listing_at
         FROM funnel_events`
      ),
      queryOne<SignupPulseRow>(
        `SELECT
           COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::text AS signups_24h,
           MAX(created_at) AS last_signup_at
         FROM users
         WHERE ${liveUserWhere}`
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
      importQualitySummary: {
        activeCount: parseInt(importQualitySummary?.active_count || "0", 10),
        visibleCount: parseInt(importQualitySummary?.visible_count || "0", 10),
        missingModelCount: parseInt(importQualitySummary?.missing_model_count || "0", 10),
        missingLocationCount: parseInt(importQualitySummary?.missing_location_count || "0", 10),
        missingImageCount: parseInt(importQualitySummary?.missing_image_count || "0", 10),
        thinSummaryCount: parseInt(importQualitySummary?.thin_summary_count || "0", 10),
        lowPriceCount: parseInt(importQualitySummary?.low_price_count || "0", 10),
      },
      sourceHealth: sourceHealth.map((row) => ({
        source: row.source,
        activeCount: parseInt(row.active_count || "0", 10),
        visibleCount: parseInt(row.visible_count || "0", 10),
        missingModelCount: parseInt(row.missing_model_count || "0", 10),
        missingLocationCount: parseInt(row.missing_location_count || "0", 10),
        missingImageCount: parseInt(row.missing_image_count || "0", 10),
        thinSummaryCount: parseInt(row.thin_summary_count || "0", 10),
        lowPriceCount: parseInt(row.low_price_count || "0", 10),
      })),
      ownerPulse: {
        signups24h: parseInt(signupPulse?.signups_24h || "0", 10),
        savedSearches24h: parseInt(ownerPulse?.saved_searches_24h || "0", 10),
        shortlists24h: parseInt(ownerPulse?.shortlists_24h || "0", 10),
        connectRequests24h: parseInt(ownerPulse?.connect_requests_24h || "0", 10),
        sellerListings24h: parseInt(ownerPulse?.seller_listings_24h || "0", 10),
        lastSignupAt: signupPulse?.last_signup_at || null,
        lastSavedSearchAt: ownerPulse?.last_saved_search_at || null,
        lastShortlistAt: ownerPulse?.last_shortlist_at || null,
        lastConnectRequestAt: ownerPulse?.last_connect_request_at || null,
        lastSellerListingAt: ownerPulse?.last_seller_listing_at || null,
      },
      serviceStatus: {
        billingEnabled: billingEnabled(),
        emailEnabled: emailEnabled(),
        openAIEnabled: openAIEnabled(),
        matchIntelligenceEnabled: matchIntelligenceConfigured(),
        matchIntelligenceProvider: matchIntelligenceProvider(),
        semanticMatchingEnabled: semanticMatchingEnabled(),
        embeddingProvider: embeddingProvider(),
        storageEnabled: storageEnabled(),
        meiliDocuments: meiliStats?.numberOfDocuments || 0,
        ownerAlertRecipients: getOwnerAlertRecipients(),
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
