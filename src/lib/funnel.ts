import { query, queryOne } from "@/lib/db";
import { logger } from "@/lib/logger";

export type FunnelEventType =
  | "signup_created"
  | "buyer_profile_saved"
  | "seller_role_selected"
  | "saved_search_created"
  | "seller_listing_created"
  | "seller_listing_submitted"
  | "listing_claim_requested"
  | "match_interested"
  | "match_passed"
  | "connect_requested"
  | "contact_gate_opened"
  | "contact_gate_saved"
  | "contact_gate_guest_continue"
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
    seller_roles: string;
    saved_searches: string;
    listings: string;
    listing_submissions: string;
    claim_requests: string;
    interested: string;
    connects: string;
    contact_gate_opens: string;
    contact_gate_saves: string;
    contact_gate_guest_continue: string;
    paid_checkouts: string;
    payment_renewals: string;
    payment_failures: string;
  }>(
    `SELECT
        COUNT(*) FILTER (WHERE event_type = 'signup_created')::text AS signups,
        COUNT(*) FILTER (WHERE event_type = 'buyer_profile_saved')::text AS profiles,
        COUNT(*) FILTER (WHERE event_type = 'seller_role_selected')::text AS seller_roles,
        COUNT(*) FILTER (WHERE event_type = 'saved_search_created')::text AS saved_searches,
        COUNT(*) FILTER (WHERE event_type = 'seller_listing_created')::text AS listings,
        COUNT(*) FILTER (WHERE event_type = 'seller_listing_submitted')::text AS listing_submissions,
        COUNT(*) FILTER (WHERE event_type = 'listing_claim_requested')::text AS claim_requests,
        COUNT(*) FILTER (WHERE event_type = 'match_interested')::text AS interested,
        COUNT(*) FILTER (WHERE event_type = 'connect_requested')::text AS connects,
        COUNT(*) FILTER (WHERE event_type = 'contact_gate_opened')::text AS contact_gate_opens,
        COUNT(*) FILTER (WHERE event_type = 'contact_gate_saved')::text AS contact_gate_saves,
        COUNT(*) FILTER (WHERE event_type = 'contact_gate_guest_continue')::text AS contact_gate_guest_continue,
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
    sellerRoleSelections: parseInt(result?.seller_roles || "0", 10),
    savedSearches: parseInt(result?.saved_searches || "0", 10),
    sellerListings: parseInt(result?.listings || "0", 10),
    sellerListingSubmissions: parseInt(result?.listing_submissions || "0", 10),
    listingClaims: parseInt(result?.claim_requests || "0", 10),
    matchInterested: parseInt(result?.interested || "0", 10),
    connectRequests: parseInt(result?.connects || "0", 10),
    contactGateOpens: parseInt(result?.contact_gate_opens || "0", 10),
    contactGateSaves: parseInt(result?.contact_gate_saves || "0", 10),
    contactGateGuestContinue: parseInt(result?.contact_gate_guest_continue || "0", 10),
    paidCheckouts: parseInt(result?.paid_checkouts || "0", 10),
    paymentRenewals: parseInt(result?.payment_renewals || "0", 10),
    paymentFailures: parseInt(result?.payment_failures || "0", 10),
  };
}
