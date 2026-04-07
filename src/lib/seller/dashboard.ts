import { query, queryOne } from "@/lib/db";

export type SellerDashboardStats = {
  totalListings: number;
  activeListings: number;
  pendingListings: number;
  rejectedListings: number;
  totalViews: number;
  totalLeads: number;
  pendingLeads: number;
  acceptedLeads: number;
};

export type SellerListing = {
  id: string;
  slug: string | null;
  make: string;
  model: string;
  year: number;
  asking_price: number;
  currency: string;
  status: "active" | "pending_review" | "rejected" | "draft";
  location_text: string | null;
  created_at: string;
  view_count: number;
  lead_count: number;
  pending_lead_count: number;
  accepted_lead_count: number;
};

export type SellerLead = {
  id: string;
  status: "pending" | "accepted" | "declined";
  sent_at: string;
  responded_at: string | null;
  intro_sent_at: string | null;
  buyer_message: string | null;
  buyer_name: string | null;
  buyer_email: string;
  boat_id: string;
  boat_slug: string | null;
  boat_title: string;
  match_score: number;
};

export async function getSellerDashboardData(userId: string) {
  const [listingStats, leadStats, listings, leads] = await Promise.all([
    queryOne<{
      total_listings: string;
      active_listings: string;
      pending_listings: string;
      rejected_listings: string;
      total_views: string;
    }>(
      `SELECT COUNT(*)::text as total_listings,
              COUNT(*) FILTER (WHERE status = 'active')::text as active_listings,
              COUNT(*) FILTER (WHERE status = 'pending_review')::text as pending_listings,
              COUNT(*) FILTER (WHERE status = 'rejected')::text as rejected_listings,
              COALESCE(SUM(view_count), 0)::text as total_views
       FROM boats
       WHERE seller_id = $1`,
      [userId]
    ),
    queryOne<{
      total_leads: string;
      pending_leads: string;
      accepted_leads: string;
    }>(
      `SELECT COUNT(*)::text as total_leads,
              COUNT(*) FILTER (WHERE status = 'pending')::text as pending_leads,
              COUNT(*) FILTER (WHERE status = 'accepted')::text as accepted_leads
       FROM introductions
       WHERE seller_id = $1`,
      [userId]
    ),
    query<SellerListing>(
      `SELECT b.id, b.slug, b.make, b.model, b.year, b.asking_price, b.currency, b.status,
              b.location_text, b.created_at, b.view_count,
              COALESCE(lead_counts.total, 0)::int as lead_count,
              COALESCE(lead_counts.pending, 0)::int as pending_lead_count,
              COALESCE(lead_counts.accepted, 0)::int as accepted_lead_count
       FROM boats b
       LEFT JOIN (
         SELECT m.boat_id,
                COUNT(*)::int as total,
                COUNT(*) FILTER (WHERE i.status = 'pending')::int as pending,
                COUNT(*) FILTER (WHERE i.status = 'accepted')::int as accepted
         FROM introductions i
         JOIN matches m ON m.id = i.match_id
         GROUP BY m.boat_id
       ) lead_counts ON lead_counts.boat_id = b.id
       WHERE b.seller_id = $1
       ORDER BY b.created_at DESC`,
      [userId]
    ),
    query<SellerLead>(
      `SELECT i.id, i.status, i.sent_at, i.responded_at, i.intro_sent_at, i.buyer_message,
              buyer.display_name as buyer_name,
              buyer.email as buyer_email,
              b.id as boat_id,
              b.slug as boat_slug,
              CONCAT(b.year, ' ', b.make, ' ', b.model) as boat_title,
              m.score as match_score
       FROM introductions i
       JOIN users buyer ON buyer.id = i.buyer_id
       JOIN matches m ON m.id = i.match_id
       JOIN boats b ON b.id = m.boat_id
       WHERE i.seller_id = $1
       ORDER BY COALESCE(i.responded_at, i.sent_at) DESC, i.sent_at DESC
       LIMIT 25`,
      [userId]
    ),
  ]);

  const stats: SellerDashboardStats = {
    totalListings: parseInt(listingStats?.total_listings || "0", 10),
    activeListings: parseInt(listingStats?.active_listings || "0", 10),
    pendingListings: parseInt(listingStats?.pending_listings || "0", 10),
    rejectedListings: parseInt(listingStats?.rejected_listings || "0", 10),
    totalViews: parseInt(listingStats?.total_views || "0", 10),
    totalLeads: parseInt(leadStats?.total_leads || "0", 10),
    pendingLeads: parseInt(leadStats?.pending_leads || "0", 10),
    acceptedLeads: parseInt(leadStats?.accepted_leads || "0", 10),
  };

  return { stats, listings, leads };
}

export async function respondToSellerIntroduction(
  sellerId: string,
  introductionId: string,
  action: "accept" | "decline"
) {
  const status = action === "accept" ? "accepted" : "declined";

  return queryOne<{ id: string }>(
    `UPDATE introductions
     SET status = $1,
         responded_at = NOW(),
         intro_sent_at = CASE
           WHEN $1 = 'accepted' THEN COALESCE(intro_sent_at, NOW())
           ELSE intro_sent_at
         END
     WHERE id = $2
       AND seller_id = $3
       AND status = 'pending'
     RETURNING id`,
    [status, introductionId, sellerId]
  );
}
