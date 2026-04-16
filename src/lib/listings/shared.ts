import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import {
  boatToEmbeddingText,
  embeddingsEnabled,
  generateEmbedding,
} from "@/lib/ai/embeddings";
import { syncBoatSearchDocument } from "@/lib/search/boat-index";
import {
  getExternalVideoMeta,
  isLocalMediaUrl,
  isSupportedExternalVideoUrl,
  MAX_EXTERNAL_VIDEOS,
  type ListingMediaType,
} from "@/lib/media";

function getAllowedMediaHost(): string | null {
  if (!process.env.S3_ENDPOINT) return null;

  try {
    return new URL(process.env.S3_ENDPOINT).hostname;
  } catch {
    return null;
  }
}

function isAllowedImageUrl(url: string): boolean {
  if (isLocalMediaUrl(url)) {
    return true;
  }

  try {
    const { hostname } = new URL(url);
    const allowed = getAllowedMediaHost();
    return allowed ? hostname.endsWith(allowed) : false;
  } catch {
    return false;
  }
}

export const listingMediaSchema = z
  .object({
    type: z.enum(["image", "video"]).default("image"),
    url: z.string().min(1),
    thumbnailUrl: z.string().url().nullable().optional(),
    caption: z.string().optional(),
    sortOrder: z.number().int().min(0).default(0),
  })
  .superRefine((item, ctx) => {
    if (item.type === "image") {
      if (!isAllowedImageUrl(item.url)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["url"],
          message: "Invalid image URL - must be from local media or configured storage",
        });
      }
      return;
    }

    if (!isSupportedExternalVideoUrl(item.url)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["url"],
        message: "Video links must be YouTube or Vimeo URLs",
      });
    }
  })
  .transform((item) => {
    if (item.type === "video") {
      const video = getExternalVideoMeta(item.url);
      return {
        ...item,
        url: video?.canonicalUrl || item.url,
        thumbnailUrl: item.thumbnailUrl || null,
      };
    }

    return {
      ...item,
      thumbnailUrl: item.thumbnailUrl || null,
    };
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
}).superRefine((listing, ctx) => {
  const media = listing.media || [];
  const videos = media.filter((item) => item.type === "video");
  if (videos.length > MAX_EXTERNAL_VIDEOS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["media"],
      message: `A listing can include up to ${MAX_EXTERNAL_VIDEOS} external videos.`,
    });
  }
});

export type ListingPayload = z.infer<typeof listingSchema>;
export type ListingMediaPayload = {
  type: ListingMediaType;
  url: string;
  thumbnailUrl?: string | null;
  caption?: string;
  sortOrder: number;
};

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

export function getListingReviewReadinessIssues(
  data: ListingPayload & { submitForReview?: boolean },
  imageCount: number
) {
  const issues: string[] = [];
  const specCount = [
    data.specs?.loa,
    data.specs?.beam,
    data.specs?.draft,
    data.specs?.rig_type,
    data.specs?.hull_material,
    data.specs?.engine,
    data.specs?.berths,
    data.specs?.heads,
  ].filter(Boolean).length;

  if (imageCount < 3) {
    issues.push("Add at least 3 photos.");
  }
  if (!data.locationText?.trim()) {
    issues.push("Add a real location.");
  }
  if (!data.description?.trim() || data.description.trim().length < 120) {
    issues.push("Add a stronger description with at least 120 characters.");
  }
  if (specCount < 3) {
    issues.push("Fill in at least 3 core specs.");
  }

  return issues;
}
