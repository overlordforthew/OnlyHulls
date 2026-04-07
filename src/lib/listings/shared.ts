import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import {
  boatToEmbeddingText,
  embeddingsEnabled,
  generateEmbedding,
} from "@/lib/ai/embeddings";
import { syncBoatSearchDocument } from "@/lib/search/boat-index";

function getAllowedMediaHost(): string | null {
  if (!process.env.S3_ENDPOINT) return null;

  try {
    return new URL(process.env.S3_ENDPOINT).hostname;
  } catch {
    return null;
  }
}

export const listingMediaSchema = z.object({
  url: z.string().url().refine(
    (u) => {
      try {
        const { hostname } = new URL(u);
        const allowed = getAllowedMediaHost();
        return allowed ? hostname.endsWith(allowed) : false;
      } catch {
        return false;
      }
    },
    { message: "Invalid media URL - must be from configured object storage" }
  ),
  caption: z.string().optional(),
  sortOrder: z.number().int().min(0).default(0),
});

export const listingSchema = z.object({
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
  media: z.array(listingMediaSchema).optional(),
});

export type ListingPayload = z.infer<typeof listingSchema>;

export function generateListingSlug(
  year: number,
  make: string,
  model: string,
  location?: string
): string {
  const parts = [year, make, model, location]
    .filter(Boolean)
    .map((part) =>
      String(part)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
    );

  return parts.join("-");
}

export async function ensureUniqueListingSlug(
  baseSlug: string,
  excludeBoatId?: string
) {
  const seed = baseSlug || `boat-${Date.now()}`;
  let candidate = seed;
  let suffix = 2;

  while (true) {
    const existing = excludeBoatId
      ? await queryOne<{ id: string }>(
          "SELECT id FROM boats WHERE slug = $1 AND id <> $2 LIMIT 1",
          [candidate, excludeBoatId]
        )
      : await queryOne<{ id: string }>(
          "SELECT id FROM boats WHERE slug = $1 LIMIT 1",
          [candidate]
        );

    if (!existing) {
      return candidate;
    }

    candidate = `${seed}-${suffix++}`;
  }
}

export async function updateListingEmbedding(
  boatId: string,
  data: ListingPayload
) {
  if (!embeddingsEnabled()) {
    await query("UPDATE boats SET dna_embedding = NULL WHERE id = $1", [boatId]);
    return;
  }

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
}

export async function syncListingSearch(boatId: string) {
  await syncBoatSearchDocument(boatId);
}
