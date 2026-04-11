import { query, queryOne } from "@/lib/db";
import { buildVisibleImportQualitySql } from "@/lib/import-quality";

export interface BoatRow {
  id: string;
  make: string;
  model: string;
  year: number;
  asking_price: number;
  currency: string;
  location_text: string | null;
  slug: string | null;
  is_sample: boolean;
  hero_url: string | null;
  specs: { loa?: number; rig_type?: string };
  character_tags: string[];
  source_site: string | null;
  source_name: string | null;
  source_url: string | null;
  asking_price_usd: number | null;
  seller_subscription_tier: string | null;
}

const BOAT_SELECT = `
  SELECT b.id, b.make, b.model, b.year, b.asking_price, b.currency,
         b.asking_price_usd,
         b.location_text, b.slug, b.is_sample,
         b.source_site, b.source_name, b.source_url,
         COALESCE(u.subscription_tier::text, 'free') as seller_subscription_tier,
         (SELECT url FROM boat_media bm WHERE bm.boat_id = b.id AND bm.type = 'image' ORDER BY sort_order LIMIT 1) as hero_url,
         COALESCE(d.specs, '{}') as specs,
         COALESCE(d.character_tags, '{}') as character_tags,
         d.condition_score
  FROM boats b
  LEFT JOIN users u ON u.id = b.seller_id
  LEFT JOIN boat_dna d ON d.boat_id = b.id
  WHERE b.status = 'active'
    AND ${buildVisibleImportQualitySql("b")}`;

export async function getFeaturedBoats(limit = 6): Promise<BoatRow[]> {
  // Trending = most viewed, but only boats with 2+ images (no empty showcases)
  return query<BoatRow>(
    `${BOAT_SELECT}
       AND (SELECT count(*) FROM boat_media bm WHERE bm.boat_id = b.id AND bm.type = 'image') >= 2
       AND COALESCE(b.asking_price_usd, b.asking_price) >= 3000
     ORDER BY b.view_count DESC, b.created_at DESC LIMIT $1`,
    [limit]
  );
}

export async function getRecentBoats(
  limit = 6,
  excludeIds: string[] = []
): Promise<BoatRow[]> {
  if (excludeIds.length > 0) {
    return query<BoatRow>(
      `${BOAT_SELECT} AND b.id != ALL($1) ORDER BY b.created_at DESC LIMIT $2`,
      [excludeIds, limit]
    );
  }
  return query<BoatRow>(
    `${BOAT_SELECT} ORDER BY b.created_at DESC LIMIT $1`,
    [limit]
  );
}

export async function getBoatCount(): Promise<number> {
  const result = await queryOne<{ count: string }>(
    `SELECT COUNT(*) FROM boats b WHERE b.status = 'active' AND ${buildVisibleImportQualitySql("b")}`
  );
  return parseInt(result?.count || "0");
}

export async function getSeoHubBoats(
  whereSql: string,
  params: unknown[] = [],
  limit = 24
): Promise<BoatRow[]> {
  return query<BoatRow>(
    `${BOAT_SELECT}
       AND (${whereSql})
     ORDER BY b.view_count DESC NULLS LAST, b.created_at DESC
     LIMIT $${params.length + 1}`,
    [...params, limit]
  );
}

export async function getSeoHubBoatCount(
  whereSql: string,
  params: unknown[] = []
): Promise<number> {
  const result = await queryOne<{ count: string }>(
    `SELECT COUNT(*)
     FROM boats b
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE b.status = 'active'
       AND ${buildVisibleImportQualitySql("b")}
       AND (${whereSql})`,
    params
  );

  return parseInt(result?.count || "0", 10);
}

export async function getRelatedBoats(input: {
  boatId: string;
  make: string;
  locationText?: string | null;
  characterTags?: string[];
  priceUsd?: number | null;
  limit?: number;
}): Promise<BoatRow[]> {
  const limit = input.limit ?? 3;
  const locationPattern = input.locationText
    ? `%${String(input.locationText).trim().toLowerCase()}%`
    : "";
  const characterTags = (input.characterTags || []).filter(Boolean);
  const priceUsd = Number(input.priceUsd ?? 0);

  return query<BoatRow>(
    `${BOAT_SELECT}
       AND b.id <> $1
       AND (
         LOWER(b.make) = LOWER($2)
         OR ($3 <> '' AND LOWER(COALESCE(b.location_text, '')) LIKE $3)
         OR (array_length($4::text[], 1) IS NOT NULL AND COALESCE(d.character_tags, '{}'::text[]) && $4::text[])
       )
     ORDER BY
       CASE WHEN LOWER(b.make) = LOWER($2) THEN 0 ELSE 1 END,
       CASE
         WHEN array_length($4::text[], 1) IS NOT NULL AND COALESCE(d.character_tags, '{}'::text[]) && $4::text[] THEN 0
         ELSE 1
       END,
       CASE
         WHEN $5 > 0 AND COALESCE(b.asking_price_usd, b.asking_price) > 0
           THEN ABS(COALESCE(b.asking_price_usd, b.asking_price) - $5)
         ELSE 999999999
       END,
       b.view_count DESC NULLS LAST,
       b.created_at DESC
     LIMIT $6`,
    [input.boatId, input.make, locationPattern, characterTags, priceUsd, limit]
  );
}
