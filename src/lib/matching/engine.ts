import { query, queryOne } from "@/lib/db";
import { findTopCandidates } from "./vector";
import { computeMatchScore, type ScoreBreakdown } from "./rules";
import { logger } from "@/lib/logger";

const BATCH_SIZE = 10;

interface MatchResult {
  boatId: string;
  score: number;
  breakdown: ScoreBreakdown;
}

export async function computeMatchesForBuyer(
  buyerProfileId: string
): Promise<MatchResult[]> {
  const buyer = await queryOne<{
    id: string;
    dna_embedding: string;
    budget_range: Record<string, unknown>;
    spec_preferences: Record<string, unknown>;
    location_prefs: Record<string, unknown>;
    refit_tolerance: string;
    use_case: string[];
  }>(
    `SELECT id, dna_embedding::text, budget_range, spec_preferences,
            location_prefs, refit_tolerance, use_case
     FROM buyer_profiles WHERE id = $1`,
    [buyerProfileId]
  );

  if (!buyer?.dna_embedding) return [];

  // Get top vector candidates
  const candidates = await findTopCandidates(buyer.dna_embedding, 100);
  if (!candidates.length) return [];

  // Fetch boat details for candidates
  const boatIds = candidates.map((c) => c.boat_id);
  const boats = await query<{
    id: string;
    asking_price: number;
    currency: string;
    year: number;
    location_text: string | null;
    specs: Record<string, unknown>;
    condition_score: number | null;
    character_tags: string[];
  }>(
    `SELECT b.id, b.asking_price, b.currency, b.year, b.location_text,
            COALESCE(d.specs, '{}') as specs,
            d.condition_score,
            COALESCE(d.character_tags, '{}') as character_tags
     FROM boats b
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE b.id = ANY($1)`,
    [boatIds]
  );

  const boatMap = new Map(boats.map((b) => [b.id, b]));
  const results: MatchResult[] = [];

  for (const candidate of candidates) {
    const boat = boatMap.get(candidate.boat_id);
    if (!boat) continue;

    const breakdown = computeMatchScore(
      candidate.similarity,
      buyer as unknown as Parameters<typeof computeMatchScore>[1],
      {
        asking_price: boat.asking_price,
        currency: boat.currency,
        year: boat.year,
        location_text: boat.location_text,
        specs: boat.specs as { loa?: number; draft?: number; rig_type?: string; hull_material?: string },
        condition_score: boat.condition_score,
        character_tags: boat.character_tags,
      }
    );

    results.push({
      boatId: candidate.boat_id,
      score: breakdown.total,
      breakdown,
    });
  }

  // Sort by total score descending
  results.sort((a, b) => b.score - a.score);

  // Upsert matches to database
  for (const match of results) {
    await query(
      `INSERT INTO matches (buyer_id, boat_id, score, score_breakdown)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (buyer_id, boat_id)
       DO UPDATE SET score = $3, score_breakdown = $4, updated_at = NOW()`,
      [
        buyerProfileId,
        match.boatId,
        match.score,
        JSON.stringify(match.breakdown),
      ]
    );
  }

  return results;
}

export async function computeAllMatches(): Promise<void> {
  // Process buyers in batches to stay under memory limits
  let offset = 0;
  let totalProcessed = 0;
  let totalErrors = 0;

  while (true) {
    const buyers = await query<{ id: string }>(
      `SELECT id FROM buyer_profiles
       WHERE dna_embedding IS NOT NULL
       ORDER BY id
       LIMIT $1 OFFSET $2`,
      [BATCH_SIZE, offset]
    );

    if (!buyers.length) break;

    for (const buyer of buyers) {
      try {
        await computeMatchesForBuyer(buyer.id);
        totalProcessed++;
      } catch (err) {
        totalErrors++;
        logger.error({ err, buyerId: buyer.id }, "Failed to compute matches for buyer");
      }
    }

    offset += BATCH_SIZE;
  }

  logger.info({ totalProcessed, totalErrors }, "Batch match computation complete");
}
