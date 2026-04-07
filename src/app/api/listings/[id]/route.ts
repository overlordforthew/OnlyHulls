import { auth } from "@/auth";
import { pool, queryOne } from "@/lib/db";
import { getPlanByTier } from "@/lib/config/plans";
import { logger } from "@/lib/logger";
import {
  ensureUniqueListingSlug,
  generateListingSlug,
  listingSchema,
  syncListingSearch,
  updateListingEmbedding,
} from "@/lib/listings/shared";
import { storageEnabled } from "@/lib/capabilities";
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
      url: string;
      caption: string | null;
      sort_order: number;
    }>(
      `SELECT id, url, caption, sort_order
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
        url: item.url,
        caption: item.caption || "",
        sortOrder: item.sort_order,
      })),
      canResubmit: listing.status === "rejected" || listing.status === "draft",
      storageEnabled: storageEnabled(),
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

  const seller = await queryOne<{ subscription_tier: string }>(
    "SELECT subscription_tier FROM users WHERE id = $1",
    [listing.seller_id]
  );
  const plan = getPlanByTier(seller?.subscription_tier || "free-seller");
  const data = parsed.data;
  const normalizedMedia = data.media?.map((item, index) => ({
    ...item,
    sortOrder: index,
  }));

  if (normalizedMedia && normalizedMedia.length > plan.limits.photosPerListing) {
    return NextResponse.json(
      {
        error: `Your ${plan.name} plan allows ${plan.limits.photosPerListing} photos per listing. You sent ${normalizedMedia.length}.`,
      },
      { status: 403 }
    );
  }

  try {
    const slug = await ensureUniqueListingSlug(
      generateListingSlug(data.year, data.make, data.model, data.locationText),
      listing.id
    );
    const nextStatus = getNextStatus(listing.status, Boolean(data.submitForReview));

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
             updated_at = NOW()
         WHERE id = $12`,
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
            `INSERT INTO boat_media (boat_id, type, url, caption, sort_order)
             VALUES ($1, 'image', $2, $3, $4)`,
            [listing.id, media.url, media.caption || null, media.sortOrder]
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
