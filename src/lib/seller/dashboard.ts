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
  respondedLeads: number;
  declinedLeads: number;
  responseRate: number;
  acceptanceRate: number;
  avgResponseHours: number | null;
  listingsWithPhotos: number;
  listingsWithVideo: number;
  staleListings: number;
  listingsNeedingAttention: number;
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
  updated_at: string;
  view_count: number;
  lead_count: number;
  pending_lead_count: number;
  accepted_lead_count: number;
  declined_lead_count: number;
  responded_lead_count: number;
  image_count: number;
  video_count: number;
  condition_score: number | null;
  has_description: boolean;
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
      declined_leads: string;
      responded_leads: string;
      avg_response_hours: string | null;
    }>(
      `SELECT COUNT(*)::text as total_leads,
              COUNT(*) FILTER (WHERE status = 'pending')::text as pending_leads,
              COUNT(*) FILTER (WHERE status = 'accepted')::text as accepted_leads,
              COUNT(*) FILTER (WHERE status = 'declined')::text as declined_leads,
              COUNT(*) FILTER (WHERE responded_at IS NOT NULL)::text as responded_leads,
              AVG(EXTRACT(EPOCH FROM (responded_at - sent_at)) / 3600)::text as avg_response_hours
       FROM introductions
       WHERE seller_id = $1`,
      [userId]
    ),
    query<SellerListing>(
      `SELECT b.id, b.slug, b.make, b.model, b.year, b.asking_price, b.currency, b.status,
              b.location_text, b.created_at, b.updated_at, b.view_count,
              COALESCE(lead_counts.total, 0)::int as lead_count,
              COALESCE(lead_counts.pending, 0)::int as pending_lead_count,
              COALESCE(lead_counts.accepted, 0)::int as accepted_lead_count,
              COALESCE(lead_counts.declined, 0)::int as declined_lead_count,
              COALESCE(lead_counts.responded, 0)::int as responded_lead_count,
              COALESCE(media_counts.images, 0)::int as image_count,
              COALESCE(media_counts.videos, 0)::int as video_count,
              d.condition_score,
              (NULLIF(TRIM(COALESCE(d.ai_summary, '')), '') IS NOT NULL) as has_description
       FROM boats b
       LEFT JOIN boat_dna d ON d.boat_id = b.id
       LEFT JOIN (
         SELECT m.boat_id,
                COUNT(*)::int as total,
                COUNT(*) FILTER (WHERE i.status = 'pending')::int as pending,
                COUNT(*) FILTER (WHERE i.status = 'accepted')::int as accepted,
                COUNT(*) FILTER (WHERE i.status = 'declined')::int as declined,
                COUNT(*) FILTER (WHERE i.responded_at IS NOT NULL)::int as responded
         FROM introductions i
         JOIN matches m ON m.id = i.match_id
         GROUP BY m.boat_id
       ) lead_counts ON lead_counts.boat_id = b.id
       LEFT JOIN (
         SELECT boat_id,
                COUNT(*) FILTER (WHERE type = 'image')::int as images,
                COUNT(*) FILTER (WHERE type = 'video')::int as videos
         FROM boat_media
         GROUP BY boat_id
       ) media_counts ON media_counts.boat_id = b.id
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
    respondedLeads: parseInt(leadStats?.responded_leads || "0", 10),
    declinedLeads: parseInt(leadStats?.declined_leads || "0", 10),
    responseRate: 0,
    acceptanceRate: 0,
    avgResponseHours: null,
    listingsWithPhotos: 0,
    listingsWithVideo: 0,
    staleListings: 0,
    listingsNeedingAttention: 0,
  };

  const respondedLeads = stats.respondedLeads;
  stats.responseRate = stats.totalLeads > 0 ? respondedLeads / stats.totalLeads : 0;
  stats.acceptanceRate = respondedLeads > 0 ? stats.acceptedLeads / respondedLeads : 0;
  stats.avgResponseHours =
    leadStats?.avg_response_hours && Number.isFinite(Number(leadStats.avg_response_hours))
      ? Number(leadStats.avg_response_hours)
      : null;
  stats.listingsWithPhotos = listings.filter((listing) => listing.image_count > 0).length;
  stats.listingsWithVideo = listings.filter((listing) => listing.video_count > 0).length;
  stats.staleListings = listings.filter((listing) => getListingFreshness(listing) === "stale").length;
  stats.listingsNeedingAttention = listings.filter(
    (listing) => getListingAttentionReasons(listing).length > 0
  ).length;

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

export type ListingFreshness = "fresh" | "aging" | "stale";

export function getListingAgeDays(listing: Pick<SellerListing, "updated_at">) {
  const updatedAt = new Date(listing.updated_at);
  if (Number.isNaN(updatedAt.getTime())) {
    return 0;
  }

  const diffMs = Date.now() - updatedAt.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export function getListingFreshness(
  listing: Pick<SellerListing, "updated_at">
): ListingFreshness {
  const ageDays = getListingAgeDays(listing);

  if (ageDays >= 21) return "stale";
  if (ageDays >= 8) return "aging";
  return "fresh";
}

export function getListingAttentionReasons(listing: SellerListing) {
  const reasons: string[] = [];

  if (listing.status === "pending_review") {
    reasons.push("Needs approval");
  }
  if (listing.status === "rejected") {
    reasons.push("Needs edits");
  }
  if (listing.image_count === 0) {
    reasons.push("Missing photos");
  } else if (listing.image_count < 3) {
    reasons.push("Add more photos");
  }
  if (!listing.has_description) {
    reasons.push("Add description");
  }
  if (!listing.location_text) {
    reasons.push("Add location");
  }
  if (getListingFreshness(listing) === "stale") {
    reasons.push("Refresh listing");
  }
  if (listing.pending_lead_count > 0) {
    reasons.push("Pending buyer lead");
  }

  return reasons;
}

export function getListingHealthScore(listing: SellerListing) {
  let score = 0;

  if (listing.image_count >= 6) score += 35;
  else if (listing.image_count >= 3) score += 25;
  else if (listing.image_count > 0) score += 10;

  if (listing.has_description) score += 20;
  if (listing.location_text) score += 10;
  if (listing.condition_score) score += 10;
  if (listing.video_count > 0) score += 5;

  if (listing.lead_count > 0) {
    score += listing.responded_lead_count === listing.lead_count ? 10 : 5;
  }

  if (listing.status === "active") score += 10;

  if (getListingFreshness(listing) === "fresh") score += 10;
  else if (getListingFreshness(listing) === "aging") score += 5;

  return Math.min(score, 100);
}
