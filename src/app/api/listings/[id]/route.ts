import { auth } from "@/auth";
import { pool, queryOne } from "@/lib/db";
import { getPlanByTier } from "@/lib/config/plans";
import { getPublicAppUrl } from "@/lib/config/urls";
import { sendOwnerAlertEmail } from "@/lib/email/resend";
import { logger } from "@/lib/logger";
import {
  ensureUniqueListingSlug,
  generateListingSlug,
  getListingReviewReadinessIssues,
  listingSchema,
  syncListingSearch,
  updateListingEmbedding,
} from "@/lib/listings/shared";
import { inferLocationMarketSignals } from "@/lib/locations/top-markets";
import { mediaBackend, storageEnabled } from "@/lib/capabilities";
import { MAX_EXTERNAL_VIDEOS } from "@/lib/media";
import { trackFunnelEvent } from "@/lib/funnel";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateListingSchema = listingSchema.extend({
  submitForReview: z.boolean().optional(),
});

type ListingRecord = {
  id: string;
  seller_id: string;
  listing_source: string;
  source_url: string | null;
  slug: string | null;
  status: string;
  make: string;
  model: string;
  year: number;
  asking_price: number;
  currency: string;
  location_text: string | null;
  location_lat: number | null;
  location_lng: number | null;
  hull_id: string | null;
  specs: Record<string, unknown>;
  character_tags: string[];
  condition_score: number | null;
  ai_summary: string | null;
  subscription_tier: string;
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await queryOne<{ id: string; role: string }>(
      "SELECT id, role FROM users WHERE id = $1",
      [session.user.id]
    );
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id } = await params;
    const listing = await getEditableListing(id);

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }
    if (!canAccessListing(user, listing)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const media = await pool.query<{
      id: string;
      type: "image" | "video";
      url: string;
      thumbnail_url: string | null;
      caption: string | null;
      sort_order: number;
    }>(
      `SELECT id, type, url, thumbnail_url, caption, sort_order
       FROM boat_media
       WHERE boat_id = $1
       ORDER BY sort_order, id`,
      [listing.id]
    );

    return NextResponse.json({
      id: listing.id,
      slug: listing.slug,
      status: listing.status,
      make: listing.make,
      model: listing.model,
      year: listing.year,
      askingPrice: Number(listing.asking_price),
      currency: listing.currency,
      locationText: listing.location_text || "",
      locationLat: listing.location_lat,
      locationLng: listing.location_lng,
      hullId: listing.hull_id || "",
      specs: listing.specs || {},
      characterTags: listing.character_tags || [],
      conditionScore: listing.condition_score || 5,
      description: listing.ai_summary || "",
      media: media.rows.map((item) => ({
        id: item.id,
        type: item.type,
        url: item.url,
        thumbnailUrl: item.thumbnail_url,
        caption: item.caption || "",
        sortOrder: item.sort_order,
      })),
      canResubmit: listing.status === "rejected" || listing.status === "draft",
      storageEnabled: storageEnabled(),
      mediaBackend: mediaBackend(),
    });
  } catch (err) {
    logger.error({ err }, "GET /api/listings/[id] error");
    return NextResponse.json(
      { error: "Failed to load listing. Please try again." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateListingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid listing data", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const user = await queryOne<{ id: string; role: string }>(
    "SELECT id, role FROM users WHERE id = $1",
    [session.user.id]
  );
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { id } = await params;
  const listing = await getEditableListing(id);
  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }
  if (!canAccessListing(user, listing)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const seller = await queryOne<{
    subscription_tier: string;
    email: string;
    display_name: string | null;
  }>(
    "SELECT subscription_tier, email, display_name FROM users WHERE id = $1",
    [listing.seller_id]
  );
  const plan = getPlanByTier(seller?.subscription_tier || "free-seller");
  const data = parsed.data;
  const normalizedMedia = data.media?.map((item, index) => ({
    ...item,
    sortOrder: index,
  }));

  const imageCount = (normalizedMedia || []).filter((item) => item.type === "image").length;
  const videoCount = (normalizedMedia || []).filter((item) => item.type === "video").length;

  if (imageCount > plan.limits.photosPerListing) {
    return NextResponse.json(
      {
        error: `Your ${plan.name} plan allows ${plan.limits.photosPerListing} photos per listing. You sent ${imageCount}.`,
      },
      { status: 403 }
    );
  }
  if (videoCount > MAX_EXTERNAL_VIDEOS) {
    return NextResponse.json(
      { error: `A listing can include up to ${MAX_EXTERNAL_VIDEOS} external videos.` },
      { status: 403 }
    );
  }
  if (data.submitForReview) {
    const reviewIssues = getListingReviewReadinessIssues(data, imageCount);

    if (reviewIssues.length > 0) {
      return NextResponse.json(
        {
          error: `This listing is not ready for review yet. ${reviewIssues.join(" ")}`,
          details: reviewIssues,
        },
        { status: 400 }
      );
    }
  }

  try {
    const slug = await ensureUniqueListingSlug(
      generateListingSlug(data.year, data.make, data.model, data.locationText),
      listing.id
    );
    const nextStatus = getNextStatus(listing.status, Boolean(data.submitForReview));
    const locationSignals = inferLocationMarketSignals({
      locationText: data.locationText,
      latitude: data.locationLat,
      longitude: data.locationLng,
    });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `UPDATE boats
         SET slug = $1,
             hull_id = $2,
             make = $3,
             model = $4,
             year = $5,
             asking_price = $6,
             currency = $7,
             status = $8,
             location_text = $9,
             location_lat = $10,
             location_lng = $11,
             location_country = $12,
             location_region = $13,
             location_market_slugs = $14,
             location_confidence = $15,
             location_approximate = $16,
             updated_at = NOW()
         WHERE id = $17`,
        [
          slug,
          data.hullId || null,
          data.make,
          data.model,
          data.year,
          data.askingPrice,
          data.currency,
          nextStatus,
          data.locationText || null,
          data.locationLat || null,
          data.locationLng || null,
          locationSignals.country,
          locationSignals.region,
          locationSignals.marketSlugs,
          locationSignals.confidence,
          locationSignals.approximate,
          listing.id,
        ]
      );

      await client.query(
        `INSERT INTO boat_dna (boat_id, specs, character_tags, condition_score, ai_summary)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (boat_id)
         DO UPDATE SET specs = EXCLUDED.specs,
                       character_tags = EXCLUDED.character_tags,
                       condition_score = EXCLUDED.condition_score,
                       ai_summary = EXCLUDED.ai_summary`,
        [
          listing.id,
          JSON.stringify(data.specs || {}),
          data.characterTags || [],
          data.conditionScore || null,
          data.description || null,
        ]
      );

      if (normalizedMedia) {
        await client.query("DELETE FROM boat_media WHERE boat_id = $1", [listing.id]);
        for (const media of normalizedMedia) {
          await client.query(
            `INSERT INTO boat_media (boat_id, type, url, thumbnail_url, caption, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              listing.id,
              media.type,
              media.url,
              media.thumbnailUrl || null,
              media.caption || null,
              media.sortOrder,
            ]
          );
        }
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    await syncListingSearch(listing.id);
    updateListingEmbedding(listing.id, {
      ...data,
      media: normalizedMedia,
    }).catch((err) =>
      logger.error({ err, boatId: listing.id }, "Failed to refresh boat embedding")
    );

    if (nextStatus === "pending_review" && listing.status !== "pending_review") {
      await trackFunnelEvent({
        eventType: "seller_listing_submitted",
        userId: listing.seller_id,
        boatId: listing.id,
        payload: { via: "listing_editor", previousStatus: listing.status },
      });

      try {
        await sendOwnerAlertEmail({
          subject: `Listing ready for review: ${data.year} ${data.make} ${data.model}`,
          title: "Seller listing submitted for review",
          intro: "A platform listing is ready for moderation and review.",
          metadata: [
            { label: "Listing", value: `${data.year} ${data.make} ${data.model}` },
            { label: "Seller", value: `${seller?.display_name || "Unnamed seller"} (${seller?.email || "unknown"})` },
            { label: "Location", value: data.locationText || "No location" },
            { label: "Photos", value: String(imageCount) },
            { label: "Status", value: `${listing.status} -> ${nextStatus}` },
          ],
          ctaUrl: `${getPublicAppUrl()}/admin`,
          ctaLabel: "Open admin review queue",
        });
      } catch (err) {
        logger.warn({ err, listingId: listing.id }, "Failed to send owner listing review alert");
      }
    }

    return NextResponse.json({ success: true, id: listing.id, slug, status: nextStatus });
  } catch (err) {
    logger.error({ err, listingId: listing.id }, "PATCH /api/listings/[id] error");
    return NextResponse.json(
      { error: "Failed to update listing. Please try again." },
      { status: 500 }
    );
  }
}

async function getEditableListing(id: string) {
  return queryOne<ListingRecord>(
    `SELECT b.id, b.seller_id, b.listing_source, b.source_url, b.slug, b.status,
            b.make, b.model, b.year, b.asking_price, b.currency,
            b.location_text, b.location_lat, b.location_lng, b.hull_id,
            COALESCE(d.specs, '{}') as specs,
            COALESCE(d.character_tags, '{}') as character_tags,
            d.condition_score,
            d.ai_summary,
            u.subscription_tier
     FROM boats b
     JOIN users u ON u.id = b.seller_id
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE b.id = $1
       AND b.listing_source = 'platform'
       AND b.source_url IS NULL`,
    [id]
  );
}

function canAccessListing(
  user: { id: string; role: string },
  listing: Pick<ListingRecord, "seller_id">
) {
  return user.role === "admin" || listing.seller_id === user.id;
}

function getNextStatus(currentStatus: string, submitForReview: boolean) {
  if (!submitForReview) {
    return currentStatus;
  }

  if (currentStatus === "rejected" || currentStatus === "draft") {
    return "pending_review";
  }

  return currentStatus;
}
