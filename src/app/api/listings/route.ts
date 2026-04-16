import { auth } from "@/auth";
import { query, queryOne } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getPlanByTier } from "@/lib/config/plans";
import { getPublicAppUrl } from "@/lib/config/urls";
import { sendOwnerAlertEmail } from "@/lib/email/resend";
import {
  ensureUniqueListingSlug,
  generateListingSlug,
  getListingReviewReadinessIssues,
  listingSchema,
  updateListingEmbedding,
} from "@/lib/listings/shared";
import { MAX_EXTERNAL_VIDEOS } from "@/lib/media";
import { trackFunnelEvent } from "@/lib/funnel";
import { NextResponse } from "next/server";
import { z } from "zod";

const createListingSchema = listingSchema.extend({
  submitForReview: z.boolean().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await queryOne<{
    id: string;
    role: string;
    subscription_tier: string;
    email: string;
    display_name: string | null;
  }>(
    "SELECT id, role, subscription_tier, email, display_name FROM users WHERE id = $1",
    [session.user.id]
  );
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.role !== "seller" && user.role !== "both" && user.role !== "admin") {
    return NextResponse.json({ error: "Must be a seller" }, { status: 403 });
  }

  const tier = user.subscription_tier || "free-seller";
  const plan = getPlanByTier(tier);
  if (plan.limits.activeListings !== -1) {
    const countResult = await queryOne<{ count: string }>(
      "SELECT COUNT(*) FROM boats WHERE seller_id = $1 AND status IN ('active', 'pending_review', 'draft')",
      [user.id]
    );
    const activeCount = parseInt(countResult?.count || "0", 10);
    if (activeCount >= plan.limits.activeListings) {
      return NextResponse.json(
        {
          error: `Your ${plan.name} plan allows ${plan.limits.activeListings} active listing(s). Upgrade to list more.`,
        },
        { status: 403 }
      );
    }
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createListingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid listing data", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const imageCount = (data.media || []).filter((item) => item.type === "image").length;
  const videoCount = (data.media || []).filter((item) => item.type === "video").length;

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
      generateListingSlug(data.year, data.make, data.model, data.locationText)
    );
    const initialStatus = data.submitForReview ? "pending_review" : "draft";

    const boat = await queryOne<{ id: string }>(
      `INSERT INTO boats (seller_id, slug, hull_id, make, model, year, asking_price, currency,
         status, location_text, location_lat, location_lng)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        user.id,
        slug,
        data.hullId || null,
        data.make,
        data.model,
        data.year,
        data.askingPrice,
        data.currency,
        initialStatus,
        data.locationText || null,
        data.locationLat || null,
        data.locationLng || null,
      ]
    );

    if (!boat) {
      return NextResponse.json({ error: "Failed to create listing" }, { status: 500 });
    }

    await query(
      `INSERT INTO boat_dna (boat_id, specs, character_tags, condition_score, ai_summary)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        boat.id,
        JSON.stringify(data.specs || {}),
        data.characterTags || [],
        data.conditionScore || null,
        data.description || null,
      ]
    );

    if (data.media?.length) {
      for (const media of data.media) {
        await query(
          `INSERT INTO boat_media (boat_id, type, url, thumbnail_url, caption, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            boat.id,
            media.type,
            media.url,
            media.thumbnailUrl || null,
            media.caption || null,
            media.sortOrder,
          ]
        );
      }
    }

    updateListingEmbedding(boat.id, data).catch((err) =>
      logger.error({ err, boatId: boat.id }, "Failed to generate boat embedding")
    );

    await trackFunnelEvent({
      eventType: "seller_listing_created",
      userId: user.id,
      boatId: boat.id,
      payload: { status: initialStatus, via: "manual" },
    });

    if (initialStatus === "pending_review") {
      await trackFunnelEvent({
        eventType: "seller_listing_submitted",
        userId: user.id,
        boatId: boat.id,
        payload: { via: "manual_create" },
      });

      try {
        await sendOwnerAlertEmail({
          subject: `Listing ready for review: ${data.year} ${data.make} ${data.model}`,
          title: "Seller listing submitted for review",
          intro: "A platform listing is ready for moderation and review.",
          metadata: [
            { label: "Listing", value: `${data.year} ${data.make} ${data.model}` },
            {
              label: "Seller",
              value: `${user.display_name || "Unnamed seller"} (${user.email})`,
            },
            { label: "Location", value: data.locationText || "No location" },
            { label: "Photos", value: String(imageCount) },
            { label: "Status", value: initialStatus },
          ],
          ctaUrl: `${getPublicAppUrl()}/admin`,
          ctaLabel: "Open admin review queue",
        });
      } catch (err) {
        logger.warn({ err, boatId: boat.id }, "Failed to send owner listing review alert");
      }
    }

    return NextResponse.json({ id: boat.id, slug, status: initialStatus });
  } catch (err) {
    logger.error({ err }, "POST /api/listings error");
    return NextResponse.json(
      { error: "Failed to create listing. Please try again." },
      { status: 500 }
    );
  }
}
