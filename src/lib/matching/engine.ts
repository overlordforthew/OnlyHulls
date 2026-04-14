import { query, queryOne } from "@/lib/db";
import { findTopCandidates } from "./vector";
import { computeMatchScore, type ScoreBreakdown } from "./rules";
import {
  boatMatchesDesiredTypes,
  scoreBoatForBuyer,
  type BoatForMatching,
  type BuyerProfileForMatching,
} from "./heuristic";
import { rerankMatchesForBuyer } from "@/lib/ai/match-intelligence";
import { buildVisibleImportQualitySql } from "@/lib/import-quality";
import { logger } from "@/lib/logger";
import { getBudgetRangeUsd } from "@/lib/currency";

const BATCH_SIZE = 10;

interface MatchResult {
  boatId: string;
  score: number;
  breakdown: ScoreBreakdown;
}

export interface BatchMatchResult {
  totalProcessed: number;
  totalSkipped: number;
  totalErrors: number;
}

function buyerProfileHasSignals(
  buyer: Pick<
    BuyerProfileForMatching,
    "use_case" | "budget_range" | "boat_type_prefs" | "spec_preferences" | "location_prefs"
  >
): boolean {
  const budget = buyer.budget_range || {};
  const boatTypePrefs = buyer.boat_type_prefs || {};
  const specPreferences = buyer.spec_preferences || {};
  const locationPreferences = buyer.location_prefs || {};

  const hasBudget =
    (typeof budget.min === "number" && Number.isFinite(budget.min)) ||
    (typeof budget.max === "number" && Number.isFinite(budget.max));
  const hasBoatTypeSignals =
    (Array.isArray(boatTypePrefs.types) &&
      boatTypePrefs.types.some((value) => value && value !== "no-preference")) ||
    (Array.isArray(boatTypePrefs.rig_prefs) && boatTypePrefs.rig_prefs.some(Boolean)) ||
    (Array.isArray(boatTypePrefs.hull_prefs) && boatTypePrefs.hull_prefs.some(Boolean));
  const hasSpecSignals = Object.keys(specPreferences).length > 0;
  const hasLocationSignals =
    (Array.isArray(locationPreferences.regions) &&
      locationPreferences.regions.some(Boolean)) ||
    Boolean(locationPreferences.home_port);

  return (
    (Array.isArray(buyer.use_case) && buyer.use_case.some(Boolean)) ||
    hasBudget ||
    hasBoatTypeSignals ||
    hasSpecSignals ||
    hasLocationSignals
  );
}

export async function computeMatchesForBuyer(
  buyerProfileId: string
): Promise<MatchResult[]> {
  const buyer = await queryOne<{
    id: string;
    dna_embedding: string | null;
    budget_range: Record<string, unknown>;
    boat_type_prefs: Record<string, unknown>;
    spec_preferences: Record<string, unknown>;
    location_prefs: Record<string, unknown>;
    refit_tolerance: string;
    use_case: string[];
  }>(
    `SELECT id, dna_embedding::text, budget_range, boat_type_prefs, spec_preferences,
            location_prefs, refit_tolerance, use_case
     FROM buyer_profiles WHERE id = $1`,
    [buyerProfileId]
  );

  if (!buyer) return [];
  if (!buyerProfileHasSignals(buyer)) {
    await query("DELETE FROM matches WHERE buyer_id = $1", [buyerProfileId]);
    return [];
  }

  let results: MatchResult[] = [];

  if (buyer.dna_embedding) {
    results = await computeVectorMatches(
      buyer as unknown as BuyerProfileForMatching & { id: string; dna_embedding: string }
    );
  }

  if (!results.length) {
    results = await computeFallbackMatches(
      buyer as unknown as BuyerProfileForMatching
    );
  }

  // Sort by total score descending
  results.sort((a, b) => b.score - a.score);

  const matchedBoatIds = results.map((match) => match.boatId);
  if (matchedBoatIds.length > 0) {
    await query(
      `DELETE FROM matches
       WHERE buyer_id = $1
         AND boat_id <> ALL($2)`,
      [buyerProfileId, matchedBoatIds]
    );
  } else {
    await query("DELETE FROM matches WHERE buyer_id = $1", [buyerProfileId]);
  }

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

  try {
    await rerankMatchesForBuyer(buyerProfileId);
  } catch (err) {
    logger.warn({ err, buyerProfileId }, "Match intelligence rerank failed");
  }

  return results;
}

async function computeVectorMatches(
  buyer: BuyerProfileForMatching & { id: string; dna_embedding: string }
): Promise<MatchResult[]> {
  const candidates = await findTopCandidates(buyer.dna_embedding, 100);
  if (!candidates.length) return [];

  const boatIds = candidates.map((candidate) => candidate.boat_id);
  const boats = await query<{
    id: string;
    asking_price: number;
    asking_price_usd: number | null;
    currency: string;
    year: number;
    location_text: string | null;
    specs: Record<string, unknown>;
    condition_score: number | null;
    character_tags: string[];
  }>(
    `SELECT b.id, b.asking_price, b.asking_price_usd, b.currency, b.year, b.location_text,
            COALESCE(d.specs, '{}') as specs,
            d.condition_score,
            COALESCE(d.character_tags, '{}') as character_tags
     FROM boats b
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE b.id = ANY($1)
       AND ${buildVisibleImportQualitySql("b")}`,
    [boatIds]
  );

  const boatMap = new Map(boats.map((boat) => [boat.id, boat]));
  const results: MatchResult[] = [];

  for (const candidate of candidates) {
    const boat = boatMap.get(candidate.boat_id);
    if (!boat) continue;
    if (!boatMatchesDesiredTypes(buyer, boat as unknown as BoatForMatching)) continue;

    const breakdown = computeMatchScore(
      candidate.similarity,
      buyer as unknown as Parameters<typeof computeMatchScore>[1],
      {
        asking_price: boat.asking_price,
        asking_price_usd: boat.asking_price_usd,
        currency: boat.currency,
        year: boat.year,
        location_text: boat.location_text,
        specs: boat.specs as {
          loa?: number;
          draft?: number;
          rig_type?: string;
          hull_material?: string;
        },
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

  return results;
}

async function computeFallbackMatches(
  buyer: BuyerProfileForMatching
): Promise<MatchResult[]> {
  const candidateQuery = buildFallbackCandidateQuery(buyer);
  const candidates = await query<BoatForMatching>(candidateQuery.text, candidateQuery.params);

  return candidates
    .map((boat) => {
      const scored = scoreBoatForBuyer(buyer, boat);
      return {
        boatId: boat.id,
        score: scored.score,
        breakdown: scored.breakdown,
      };
    })
    .filter((match) => match.score >= 0.35)
    .sort((a, b) => b.score - a.score)
    .slice(0, 60);
}

function buildFallbackCandidateQuery(buyer: BuyerProfileForMatching): {
  text: string;
  params: unknown[];
} {
  const conditions = ["b.status = 'active'", buildVisibleImportQualitySql("b")];
  const params: unknown[] = [];
  let paramIdx = 1;

  const budget = buyer.budget_range || {};
  const budgetUsd = getBudgetRangeUsd(budget);
  const specPreferences = buyer.spec_preferences || {};
  const boatTypePrefs = buyer.boat_type_prefs || {};
  const locationPrefs = buyer.location_prefs || {};

  const maxBudget = budgetUsd.max;
  if (maxBudget && maxBudget > 0) {
    conditions.push(`COALESCE(b.asking_price_usd, b.asking_price) <= $${paramIdx++}`);
    params.push(maxBudget * 1.5);
  }

  const yearMin =
    typeof specPreferences.year_min === "number" && Number.isFinite(specPreferences.year_min)
      ? specPreferences.year_min
      : null;
  if (yearMin) {
    conditions.push(`b.year >= $${paramIdx++}`);
    params.push(Math.max(1900, yearMin - 15));
  }

  const rigPrefs = Array.isArray(boatTypePrefs.rig_prefs)
    ? boatTypePrefs.rig_prefs.filter(Boolean)
    : [];
  if (rigPrefs.length) {
    conditions.push(`COALESCE(d.specs->>'rig_type', '') = ANY($${paramIdx++})`);
    params.push(rigPrefs);
  }

  const desiredTypes = Array.isArray(boatTypePrefs.types)
    ? boatTypePrefs.types.filter((value) => value && value !== "no-preference")
    : [];
  if (desiredTypes.length) {
    const typeClauses: string[] = [];
    const vesselTypeSql = "LOWER(COALESCE(d.specs->>'vessel_type', ''))";
    const typeHaystackSql =
      "LOWER(CONCAT_WS(' ', b.make, b.model, COALESCE(d.ai_summary, ''), array_to_string(COALESCE(d.character_tags, '{}'), ' ')))";
    for (const desiredType of desiredTypes.slice(0, 2)) {
      const normalizedType = String(desiredType).toLowerCase();
      if (normalizedType === "catamaran") {
        typeClauses.push(
          `(${vesselTypeSql} = 'catamaran' OR (${vesselTypeSql} = '' AND ${typeHaystackSql} LIKE $${paramIdx++}))`
        );
        params.push("%catamaran%");
        continue;
      }
      if (normalizedType === "trimaran") {
        typeClauses.push(
          `(${vesselTypeSql} = 'trimaran' OR (${vesselTypeSql} = '' AND ${typeHaystackSql} LIKE $${paramIdx++}))`
        );
        params.push("%trimaran%");
        continue;
      }
      if (normalizedType === "powerboat") {
        typeClauses.push(
          `(${vesselTypeSql} = 'powerboat'
            OR (${vesselTypeSql} = '' AND (
              ${typeHaystackSql} LIKE $${paramIdx++}
              OR LOWER(COALESCE(d.specs->>'rig_type', '')) IN ('motor', 'power', 'powerboat')
            )))`
        );
        params.push("%powerboat%");
        continue;
      }
      if (normalizedType === "monohull") {
        typeClauses.push(
          `(${vesselTypeSql} = 'monohull'
            OR (${vesselTypeSql} = '' AND
              ${typeHaystackSql} NOT LIKE $${paramIdx++}
              AND ${typeHaystackSql} NOT LIKE $${paramIdx++}
              AND ${typeHaystackSql} NOT LIKE $${paramIdx++}))`
        );
        params.push("%catamaran%", "%trimaran%", "%powerboat%");
      }
    }
    if (typeClauses.length) {
      conditions.push(`(${typeClauses.join(" OR ")})`);
    }
  }

  const regions = Array.isArray(locationPrefs.regions)
    ? locationPrefs.regions.filter(Boolean)
    : [];
  if (regions.length) {
    const regionClauses: string[] = [];
    for (const region of regions.slice(0, 3)) {
      regionClauses.push(`LOWER(COALESCE(b.location_text, '')) LIKE $${paramIdx++}`);
      params.push(`%${String(region).toLowerCase()}%`);
    }
    conditions.push(`(${regionClauses.join(" OR ")})`);
  }

  const budgetMid =
    typeof budgetUsd.min === "number" &&
    Number.isFinite(budgetUsd.min) &&
    typeof maxBudget === "number" &&
    Number.isFinite(maxBudget)
      ? (budgetUsd.min + maxBudget) / 2
      : null;

  const orderByParts = [
    "(EXISTS (SELECT 1 FROM boat_media bm WHERE bm.boat_id = b.id AND bm.type = 'image')) DESC",
  ];
  if (budgetMid) {
    orderByParts.push(`ABS(COALESCE(b.asking_price_usd, b.asking_price) - $${paramIdx++}) ASC NULLS LAST`);
    params.push(budgetMid);
  }
  orderByParts.push("b.created_at DESC");

  return {
    text: `SELECT b.id, b.make, b.model, b.asking_price, b.asking_price_usd, b.currency, b.year, b.location_text,
                  COALESCE(d.specs, '{}') as specs,
                  d.condition_score,
                  COALESCE(d.character_tags, '{}') as character_tags,
                  d.ai_summary
           FROM boats b
           LEFT JOIN boat_dna d ON d.boat_id = b.id
           WHERE ${conditions.join(" AND ")}
           ORDER BY ${orderByParts.join(", ")}
           LIMIT 250`,
    params,
  };
}

export async function computeAllMatches(): Promise<BatchMatchResult> {
  // Process buyers in batches to stay under memory limits
  let offset = 0;
  let totalProcessed = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  while (true) {
    const buyers = await query<{ id: string }>(
      `SELECT id FROM buyer_profiles
       ORDER BY id
       LIMIT $1 OFFSET $2`,
      [BATCH_SIZE, offset]
    );

    if (!buyers.length) break;

    for (const buyer of buyers) {
      try {
        const matches = await computeMatchesForBuyer(buyer.id);
        if (matches.length > 0) {
          totalProcessed++;
        } else {
          totalSkipped++;
        }
      } catch (err) {
        totalErrors++;
        logger.error({ err, buyerId: buyer.id }, "Failed to compute matches for buyer");
      }
    }

    offset += BATCH_SIZE;
  }

  logger.info({ totalProcessed, totalSkipped, totalErrors }, "Batch match computation complete");
  return { totalProcessed, totalSkipped, totalErrors };
}
