import { auth } from "@/auth";
import { query, queryOne } from "@/lib/db";
import { generateEmbedding, boatToEmbeddingText } from "@/lib/ai/embeddings";
import { getMeili, BOATS_INDEX } from "@/lib/meilisearch";
import { logger } from "@/lib/logger";
import { getPlanByTier } from "@/lib/config/plans";
import { NextResponse } from "next/server";
import { z } from "zod";

const listingSchema = z.object({
  make: z.string().min(1),
  model: z.string().min(1),
  year: z.number().int().min(1900).max(2030),
  askingPrice: z.number().positive(),
  currency: z.string().default("USD"),
  locationText: z.string().optional(),
  locationLat: z.number().optional(),
  locationLng: z.number().optional(),
  hullId: z.string().optional(),
  specs: z
    .object({
      loa: z.number().optional(),
      beam: z.number().optional(),
      draft: z.number().optional(),
      displacement: z.number().optional(),
      rig_type: z.string().optional(),
      hull_material: z.string().optional(),
      engine: z.string().optional(),
      fuel_type: z.string().optional(),
      water_capacity: z.number().optional(),
      fuel_capacity: z.number().optional(),
      berths: z.number().optional(),
      heads: z.number().optional(),
    })
    .optional(),
  characterTags: z.array(z.string()).optional(),
  conditionScore: z.number().int().min(1).max(10).optional(),
  description: z.string().optional(),
  media: z
    .array(
      z.object({
        url: z.string().url().refine(
          (u) => {
            try {
              const { hostname } = new URL(u);
              const allowed = process.env.S3_ENDPOINT
                ? new URL(process.env.S3_ENDPOINT).hostname
                : null;
              return allowed ? hostname.endsWith(allowed) : false;
            } catch {
              return false;
            }
          },
          { message: "Invalid media URL — must be from configured object storage" }
        ),
        caption: z.string().optional(),
        sortOrder: z.number().default(0),
      })
    )
    .optional(),
});

function generateSlug(year: number, make: string, model: string, location?: string): string {
  const parts = [year, make, model, location]
    .filter(Boolean)
    .map((p) =>
      String(p)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
    );
  return parts.join("-");
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await queryOne<{ id: string; role: string; subscription_tier: string }>(
    "SELECT id, role, subscription_tier FROM users WHERE id = $1",
    [session.user.id]
  );
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.role !== "seller" && user.role !== "both" && user.role !== "admin") {
    return NextResponse.json({ error: "Must be a seller" }, { status: 403 });
  }

  // Enforce listing count limit based on subscription tier
  const tier = user.subscription_tier || "free-seller";
  const plan = getPlanByTier(tier);
  if (plan.limits.activeListings !== -1) {
    const countResult = await queryOne<{ count: string }>(
      "SELECT COUNT(*) FROM boats WHERE seller_id = $1 AND status IN ('active', 'pending_review', 'draft')",
      [user.id]
    );
    const activeCount = parseInt(countResult?.count || "0");
    if (activeCount >= plan.limits.activeListings) {
      return NextResponse.json(
        { error: `Your ${plan.name} plan allows ${plan.limits.activeListings} active listing(s). Upgrade to list more.` },
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

  const parsed = listingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid listing data", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Enforce photo limit
  if (data.media && data.media.length > plan.limits.photosPerListing) {
    return NextResponse.json(
      { error: `Your ${plan.name} plan allows ${plan.limits.photosPerListing} photos per listing. You sent ${data.media.length}.` },
      { status: 403 }
    );
  }

  try {
    const slug = generateSlug(data.year, data.make, data.model, data.locationText);

    // Create boat listing
    const boat = await queryOne<{ id: string }>(
      `INSERT INTO boats (seller_id, slug, hull_id, make, model, year, asking_price, currency,
         status, location_text, location_lat, location_lng)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending_review', $9, $10, $11)
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
        data.locationText || null,
        data.locationLat || null,
        data.locationLng || null,
      ]
    );

    if (!boat) {
      return NextResponse.json(
        { error: "Failed to create listing" },
        { status: 500 }
      );
    }

    // Create boat DNA
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

    // Insert media
    if (data.media?.length) {
      for (const m of data.media) {
        await query(
          `INSERT INTO boat_media (boat_id, type, url, caption, sort_order)
           VALUES ($1, 'image', $2, $3, $4)`,
          [boat.id, m.url, m.caption || null, m.sortOrder]
        );
      }
    }

    // Generate embedding (async, don't block response)
    generateBoatEmbedding(boat.id, data).catch((err) =>
      logger.error({ err, boatId: boat.id }, "Failed to generate boat embedding")
    );

    return NextResponse.json({ id: boat.id, slug });
  } catch (err) {
    logger.error({ err }, "POST /api/listings error");
    return NextResponse.json(
      { error: "Failed to create listing. Please try again." },
      { status: 500 }
    );
  }
}

async function generateBoatEmbedding(
  boatId: string,
  data: z.infer<typeof listingSchema>
) {
  const embeddingText = boatToEmbeddingText({
    make: data.make,
    model: data.model,
    year: data.year,
    asking_price: data.askingPrice,
    currency: data.currency,
    location_text: data.locationText,
    specs: data.specs,
    character_tags: data.characterTags,
    ai_summary: data.description,
  });

  const embedding = await generateEmbedding(embeddingText);
  const embeddingStr = `[${embedding.join(",")}]`;

  await query("UPDATE boats SET dna_embedding = $1 WHERE id = $2", [
    embeddingStr,
    boatId,
  ]);

  // Index in Meilisearch
  try {
    await getMeili().index(BOATS_INDEX).addDocuments([
      {
        id: boatId,
        make: data.make,
        model: data.model,
        year: data.year,
        askingPrice: data.askingPrice,
        currency: data.currency,
        locationText: data.locationText,
        specs: data.specs,
        characterTags: data.characterTags,
        description: data.description,
      },
    ]);
  } catch (err) {
    logger.error({ err, boatId }, "Meilisearch indexing failed");
  }
}
