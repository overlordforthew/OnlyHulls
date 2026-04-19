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
import { getBuildInfo } from "@/lib/build-info";
import { TOP_LOCATION_MARKETS } from "@/lib/locations/top-markets";
import { getSourceDecisionByName } from "@/lib/source-policy";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await requireRole(["admin"]);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const buildInfo = getBuildInfo();
    const servedAt = new Date().toISOString();

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
      contact_clicks_30d: string;
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
      listing_submissions_24h: string;
      claim_requests_24h: string;
      paid_checkouts_24h: string;
      payment_failures_24h: string;
      last_saved_search_at: string | null;
      last_shortlist_at: string | null;
      last_connect_request_at: string | null;
      last_seller_listing_at: string | null;
      last_listing_submission_at: string | null;
      last_claim_request_at: string | null;
      last_paid_checkout_at: string | null;
      last_payment_failure_at: string | null;
    };
    type SignupPulseRow = {
      signups_24h: string;
      last_signup_at: string | null;
    };
    type LocationReadinessSummaryRow = {
      active_visible_count: string;
      with_location_text_count: string;
      with_market_slugs_count: string;
      city_or_better_count: string;
      exact_coordinates_count: string;
      approximate_count: string;
      missing_location_count: string;
      unclassified_location_count: string;
    };
    type LocationMarketCountRow = {
      slug: string;
      count: string;
    };
    type UnclassifiedLocationRow = {
      location_text: string;
      count: string;
      source_count: string;
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
      locationReadinessSummary,
      locationMarketCounts,
      unclassifiedLocations,
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
         WHERE b.status = 'active'
           AND b.listing_source = 'imported'`
      ),
      query<SourceHealthRow>(
        `SELECT
           COALESCE(b.source_name, 'Platform') AS source,
           COUNT(*)::text AS active_count,
           COUNT(*) FILTER (WHERE ${buildVisibleImportQualitySql("b")})::text AS visible_count,
           COALESCE(SUM(COALESCE(clicks.click_count_30d, 0)), 0)::text AS contact_clicks_30d,
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
         LEFT JOIN (
           SELECT boat_id, COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS click_count_30d
           FROM contact_clicks
           GROUP BY boat_id
         ) clicks ON clicks.boat_id = b.id
         WHERE b.status = 'active'
           AND b.listing_source = 'imported'
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
           COUNT(*) FILTER (WHERE event_type = 'seller_listing_submitted' AND created_at >= NOW() - INTERVAL '24 hours')::text AS listing_submissions_24h,
           COUNT(*) FILTER (WHERE event_type = 'listing_claim_requested' AND created_at >= NOW() - INTERVAL '24 hours')::text AS claim_requests_24h,
           COUNT(*) FILTER (WHERE event_type = 'checkout_completed' AND created_at >= NOW() - INTERVAL '24 hours')::text AS paid_checkouts_24h,
           COUNT(*) FILTER (WHERE event_type = 'invoice_payment_failed' AND created_at >= NOW() - INTERVAL '24 hours')::text AS payment_failures_24h,
           MAX(created_at) FILTER (WHERE event_type = 'saved_search_created') AS last_saved_search_at,
           MAX(created_at) FILTER (WHERE event_type = 'match_interested') AS last_shortlist_at,
           MAX(created_at) FILTER (WHERE event_type = 'connect_requested') AS last_connect_request_at,
           MAX(created_at) FILTER (WHERE event_type = 'seller_listing_created') AS last_seller_listing_at,
           MAX(created_at) FILTER (WHERE event_type = 'seller_listing_submitted') AS last_listing_submission_at,
           MAX(created_at) FILTER (WHERE event_type = 'listing_claim_requested') AS last_claim_request_at,
           MAX(created_at) FILTER (WHERE event_type = 'checkout_completed') AS last_paid_checkout_at,
           MAX(created_at) FILTER (WHERE event_type = 'invoice_payment_failed') AS last_payment_failure_at
         FROM funnel_events`
      ),
      queryOne<SignupPulseRow>(
        `SELECT
           COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::text AS signups_24h,
           MAX(created_at) AS last_signup_at
         FROM users
         WHERE ${liveUserWhere}`
      ),
      queryOne<LocationReadinessSummaryRow>(
        `SELECT
           COUNT(*)::text AS active_visible_count,
           COUNT(*) FILTER (
             WHERE COALESCE(NULLIF(TRIM(b.location_text), ''), '') <> ''
           )::text AS with_location_text_count,
           COUNT(*) FILTER (
             WHERE CARDINALITY(COALESCE(b.location_market_slugs, '{}'::text[])) > 0
           )::text AS with_market_slugs_count,
           COUNT(*) FILTER (
             WHERE b.location_confidence IN ('city', 'exact')
           )::text AS city_or_better_count,
           COUNT(*) FILTER (
             WHERE b.location_lat BETWEEN -90 AND 90
               AND b.location_lng BETWEEN -180 AND 180
           )::text AS exact_coordinates_count,
           COUNT(*) FILTER (
             WHERE b.location_approximate = true
               AND COALESCE(NULLIF(TRIM(b.location_text), ''), '') <> ''
           )::text AS approximate_count,
           COUNT(*) FILTER (
             WHERE COALESCE(NULLIF(TRIM(b.location_text), ''), '') = ''
           )::text AS missing_location_count,
           COUNT(*) FILTER (
             WHERE COALESCE(NULLIF(TRIM(b.location_text), ''), '') <> ''
               AND CARDINALITY(COALESCE(b.location_market_slugs, '{}'::text[])) = 0
           )::text AS unclassified_location_count
         FROM boats b
         LEFT JOIN boat_dna d ON d.boat_id = b.id
         WHERE b.status = 'active'
           AND ${buildVisibleImportQualitySql("b")}`
      ),
      query<LocationMarketCountRow>(
        `SELECT location_market.market_slug AS slug, COUNT(*)::text AS count
         FROM boats b
         CROSS JOIN LATERAL UNNEST(COALESCE(b.location_market_slugs, '{}'::text[])) AS location_market(market_slug)
         LEFT JOIN boat_dna d ON d.boat_id = b.id
         WHERE b.status = 'active'
           AND ${buildVisibleImportQualitySql("b")}
         GROUP BY location_market.market_slug
         ORDER BY COUNT(*) DESC, location_market.market_slug
         LIMIT 12`
      ),
      query<UnclassifiedLocationRow>(
        `SELECT
           MIN(b.location_text) AS location_text,
           COUNT(*)::text AS count,
           COUNT(DISTINCT COALESCE(b.source_name, 'Platform'))::text AS source_count
         FROM boats b
         LEFT JOIN boat_dna d ON d.boat_id = b.id
         WHERE b.status = 'active'
           AND ${buildVisibleImportQualitySql("b")}
           AND COALESCE(NULLIF(TRIM(b.location_text), ''), '') <> ''
           AND CARDINALITY(COALESCE(b.location_market_slugs, '{}'::text[])) = 0
         GROUP BY LOWER(TRIM(b.location_text))
         ORDER BY COUNT(*) DESC, LOWER(TRIM(b.location_text))
         LIMIT 12`
      ),
    ]);
    const locationMarketBySlug = new Map(
      TOP_LOCATION_MARKETS.map((market) => [market.slug, market])
    );

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
        contactClicks30d: parseInt(row.contact_clicks_30d || "0", 10),
        missingModelCount: parseInt(row.missing_model_count || "0", 10),
        missingLocationCount: parseInt(row.missing_location_count || "0", 10),
        missingImageCount: parseInt(row.missing_image_count || "0", 10),
        thinSummaryCount: parseInt(row.thin_summary_count || "0", 10),
        lowPriceCount: parseInt(row.low_price_count || "0", 10),
        decisionStatus: getSourceDecisionByName(row.source)?.status || "undecided",
        decisionReason: getSourceDecisionByName(row.source)?.reason || null,
      })),
      ownerPulse: {
        signups24h: parseInt(signupPulse?.signups_24h || "0", 10),
        savedSearches24h: parseInt(ownerPulse?.saved_searches_24h || "0", 10),
        shortlists24h: parseInt(ownerPulse?.shortlists_24h || "0", 10),
        connectRequests24h: parseInt(ownerPulse?.connect_requests_24h || "0", 10),
        sellerListings24h: parseInt(ownerPulse?.seller_listings_24h || "0", 10),
        listingSubmissions24h: parseInt(ownerPulse?.listing_submissions_24h || "0", 10),
        claimRequests24h: parseInt(ownerPulse?.claim_requests_24h || "0", 10),
        paidCheckouts24h: parseInt(ownerPulse?.paid_checkouts_24h || "0", 10),
        paymentFailures24h: parseInt(ownerPulse?.payment_failures_24h || "0", 10),
        lastSignupAt: signupPulse?.last_signup_at || null,
        lastSavedSearchAt: ownerPulse?.last_saved_search_at || null,
        lastShortlistAt: ownerPulse?.last_shortlist_at || null,
        lastConnectRequestAt: ownerPulse?.last_connect_request_at || null,
        lastSellerListingAt: ownerPulse?.last_seller_listing_at || null,
        lastListingSubmissionAt: ownerPulse?.last_listing_submission_at || null,
        lastClaimRequestAt: ownerPulse?.last_claim_request_at || null,
        lastPaidCheckoutAt: ownerPulse?.last_paid_checkout_at || null,
        lastPaymentFailureAt: ownerPulse?.last_payment_failure_at || null,
      },
      locationReadiness: {
        activeVisibleCount: parseInt(locationReadinessSummary?.active_visible_count || "0", 10),
        withLocationTextCount: parseInt(locationReadinessSummary?.with_location_text_count || "0", 10),
        withMarketSlugsCount: parseInt(locationReadinessSummary?.with_market_slugs_count || "0", 10),
        cityOrBetterCount: parseInt(locationReadinessSummary?.city_or_better_count || "0", 10),
        exactCoordinatesCount: parseInt(locationReadinessSummary?.exact_coordinates_count || "0", 10),
        approximateCount: parseInt(locationReadinessSummary?.approximate_count || "0", 10),
        missingLocationCount: parseInt(locationReadinessSummary?.missing_location_count || "0", 10),
        unclassifiedLocationCount: parseInt(locationReadinessSummary?.unclassified_location_count || "0", 10),
        topMarkets: locationMarketCounts.map((row) => ({
          slug: row.slug,
          label: locationMarketBySlug.get(row.slug)?.label || row.slug.replace(/-/g, " "),
          count: parseInt(row.count || "0", 10),
        })),
        unclassifiedLocations: unclassifiedLocations.map((row) => ({
          locationText: row.location_text,
          count: parseInt(row.count || "0", 10),
          sourceCount: parseInt(row.source_count || "0", 10),
        })),
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
      deployStatus: {
        ...buildInfo,
        servedAt,
        healthPath: "/api/public/deploy-health",
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
