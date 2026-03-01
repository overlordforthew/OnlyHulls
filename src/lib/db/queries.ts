import { query, queryOne } from "@/lib/db";

interface BoatRow {
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
}

const BOAT_SELECT = `
  SELECT b.id, b.make, b.model, b.year, b.asking_price, b.currency,
         b.location_text, b.slug, b.is_sample,
         (SELECT url FROM boat_media bm WHERE bm.boat_id = b.id ORDER BY sort_order LIMIT 1) as hero_url,
         COALESCE(d.specs, '{}') as specs,
         COALESCE(d.character_tags, '{}') as character_tags,
         d.condition_score
  FROM boats b
  LEFT JOIN boat_dna d ON d.boat_id = b.id
  WHERE b.status = 'active'`;

export async function getFeaturedBoats(limit = 6): Promise<BoatRow[]> {
  return query<BoatRow>(
    `${BOAT_SELECT} ORDER BY b.asking_price DESC LIMIT $1`,
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
    `SELECT COUNT(*) FROM boats WHERE status = 'active'`
  );
  return parseInt(result?.count || "0");
}
