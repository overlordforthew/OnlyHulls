import { query, queryOne } from "@/lib/db";
import { logger } from "@/lib/logger";

export type FunnelEventType =
  | "signup_created"
  | "buyer_profile_saved"
  | "saved_search_created"
  | "seller_listing_created"
  | "match_interested"
  | "match_passed"
  | "connect_requested"
  | "checkout_completed"
  | "invoice_payment_succeeded"
  | "invoice_payment_failed";

export async function trackFunnelEvent(input: {
  eventType: FunnelEventType;
  userId?: string | null;
  boatId?: string | null;
  introductionId?: string | null;
  payload?: Record<string, unknown>;
}) {
  try {
    await query(
      `INSERT INTO funnel_events (event_type, user_id, boat_id, introduction_id, payload)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        input.eventType,
        input.userId ?? null,
        input.boatId ?? null,
        input.introductionId ?? null,
        JSON.stringify(input.payload ?? {}),
      ]
    );
  } catch (err) {
    logger.warn({ err, eventType: input.eventType }, "Failed to track funnel event");
  }
}

export async function getFunnelSnapshot(days = 30) {
  const result = await queryOne<{
    signups: string;
    profiles: string;
    saved_searches: string;
    listings: string;
    interested: string;
    connects: string;
    paid_checkouts: string;
    payment_renewals: string;
    payment_failures: string;
  }>(
    `SELECT
        COUNT(*) FILTER (WHERE event_type = 'signup_created')::text AS signups,
        COUNT(*) FILTER (WHERE event_type = 'buyer_profile_saved')::text AS profiles,
        COUNT(*) FILTER (WHERE event_type = 'saved_search_created')::text AS saved_searches,
        COUNT(*) FILTER (WHERE event_type = 'seller_listing_created')::text AS listings,
        COUNT(*) FILTER (WHERE event_type = 'match_interested')::text AS interested,
        COUNT(*) FILTER (WHERE event_type = 'connect_requested')::text AS connects,
        COUNT(*) FILTER (WHERE event_type = 'checkout_completed')::text AS paid_checkouts,
        COUNT(*) FILTER (WHERE event_type = 'invoice_payment_succeeded')::text AS payment_renewals,
        COUNT(*) FILTER (WHERE event_type = 'invoice_payment_failed')::text AS payment_failures
     FROM funnel_events
     WHERE created_at >= NOW() - ($1::text || ' days')::interval`,
    [days]
  );

  return {
    signups: parseInt(result?.signups || "0", 10),
    buyerProfiles: parseInt(result?.profiles || "0", 10),
    savedSearches: parseInt(result?.saved_searches || "0", 10),
    sellerListings: parseInt(result?.listings || "0", 10),
    matchInterested: parseInt(result?.interested || "0", 10),
    connectRequests: parseInt(result?.connects || "0", 10),
    paidCheckouts: parseInt(result?.paid_checkouts || "0", 10),
    paymentRenewals: parseInt(result?.payment_renewals || "0", 10),
    paymentFailures: parseInt(result?.payment_failures || "0", 10),
  };
}
