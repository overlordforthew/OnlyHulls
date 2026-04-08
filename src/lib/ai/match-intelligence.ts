import { createHash } from "crypto";
import { query, queryOne } from "@/lib/db";
import { generateText, getMatchIntelligenceProvider, matchIntelligenceEnabled } from "@/lib/ai/provider";
import { buildVisibleImportQualitySql } from "@/lib/import-quality";
import { logLLMResponse } from "@/lib/ai/logging";
import type { ScoreBreakdown } from "@/lib/matching/rules";
import { logger } from "@/lib/logger";

type MatchVerdict = "strong_fit" | "workable_fit" | "weak_fit" | "reject";

interface BuyerContext {
  id: string;
  use_case: string[];
  budget_range: Record<string, unknown>;
  boat_type_prefs: Record<string, unknown>;
  spec_preferences: Record<string, unknown>;
  location_prefs: Record<string, unknown>;
  refit_tolerance: string | null;
}

interface CandidateContext {
  match_id: string;
  boat_id: string;
  score: number;
  score_breakdown: ScoreBreakdown;
  make: string;
  model: string;
  year: number;
  asking_price: number;
  currency: string;
  location_text: string | null;
  specs: Record<string, unknown>;
  character_tags: string[];
  ai_summary: string | null;
}

interface RankedCandidate {
  boatId: string;
  fitScore: number;
  verdict: MatchVerdict;
  summary: string;
  strengths: string[];
  risks: string[];
  confidence: number;
}

interface RankedCandidateWithMeta {
  ranked: RankedCandidate;
  provider: string;
  model: string;
}

const MAX_RERANKED_MATCHES = 12;
const RERANK_BATCH_SIZE = 3;
const VERDICT_BIAS: Record<MatchVerdict, number> = {
  strong_fit: 0.04,
  workable_fit: 0.0,
  weak_fit: -0.06,
  reject: -0.16,
};

function clampScore(value: number, min = 0, max = 0.98): number {
  return Math.min(max, Math.max(min, value));
}

function chunk<T>(items: T[], size: number): T[][];
function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function extractJsonPayload(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [
    fencedMatch?.[1]?.trim(),
    trimmed,
    raw.match(/\{[\s\S]*\}/)?.[0],
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as Record<string, unknown>;
    } catch {
      continue;
    }
  }

  return null;
}

function normalizeVerdict(value: unknown): MatchVerdict {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  if (
    normalized === "strong_fit" ||
    normalized === "workable_fit" ||
    normalized === "weak_fit" ||
    normalized === "reject"
  ) {
    return normalized;
  }

  return "workable_fit";
}

function normalizeStringArray(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeSummary(value: unknown, fallback: string): string {
  const summary = String(value || "").trim();
  return summary || fallback;
}

function combineMatchScore(baseScore: number, aiScore: number, verdict: MatchVerdict): number {
  return clampScore(baseScore * 0.72 + aiScore * 0.28 + VERDICT_BIAS[verdict]);
}

function buildFallbackSummary(candidate: CandidateContext): string {
  return `${candidate.year} ${candidate.make} ${candidate.model} looks like a plausible fit, but it still needs human review against the buyer's real priorities.`;
}

function buildSystemPrompt(): string {
  return [
    "You are ranking sailboat listings for a buyer profile.",
    "Use practical brokerage judgment, not marketing copy.",
    "Be strict about budget mismatch, use-case mismatch, poor spec fit, location friction, and likely refit burden.",
    "Return strict JSON only.",
    'JSON shape: {"rankings":[{"boatId":"uuid","fitScore":0.1-0.95,"verdict":"strong_fit|workable_fit|weak_fit|reject","summary":"short paragraph","strengths":["..."],"risks":["..."],"confidence":0.1-0.95}]}',
    "Only include boatIds from the supplied candidate list.",
    "strengths must have 1 to 3 items. risks must have 0 to 2 items.",
    "Keep each string concise and concrete.",
  ].join(" ");
}

function buildSingleSystemPrompt(): string {
  return [
    "You are evaluating one sailboat listing for one buyer profile.",
    "Use practical brokerage judgment, not marketing copy.",
    "Return strict JSON only.",
    'JSON shape: {"fitScore":0.1-0.95,"verdict":"strong_fit|workable_fit|weak_fit|reject","summary":"short paragraph","strengths":["..."],"risks":["..."],"confidence":0.1-0.95}',
    "strengths must have 1 to 3 items. risks must have 0 to 2 items.",
    "Be strict about budget mismatch, type mismatch, condition/refit mismatch, and location friction.",
  ].join(" ");
}

function buildUserPrompt(buyer: BuyerContext, candidates: CandidateContext[]): string {
  return JSON.stringify(
    {
      buyer: {
        use_case: buyer.use_case,
        budget_range: buyer.budget_range,
        boat_type_prefs: buyer.boat_type_prefs,
        spec_preferences: buyer.spec_preferences,
        location_prefs: buyer.location_prefs,
        refit_tolerance: buyer.refit_tolerance,
      },
      candidates: candidates.map((candidate) => ({
        boatId: candidate.boat_id,
        baseScore: candidate.score,
        scoreBreakdown: candidate.score_breakdown,
        boat: {
          year: candidate.year,
          make: candidate.make,
          model: candidate.model,
          asking_price: candidate.asking_price,
          currency: candidate.currency,
          location_text: candidate.location_text,
          specs: candidate.specs,
          character_tags: candidate.character_tags,
          ai_summary: candidate.ai_summary,
        },
      })),
    },
    null,
    2
  );
}

function buildSingleUserPrompt(buyer: BuyerContext, candidate: CandidateContext): string {
  return JSON.stringify(
    {
      buyer: {
        use_case: buyer.use_case,
        budget_range: buyer.budget_range,
        boat_type_prefs: buyer.boat_type_prefs,
        spec_preferences: buyer.spec_preferences,
        location_prefs: buyer.location_prefs,
        refit_tolerance: buyer.refit_tolerance,
      },
      candidate: {
        boatId: candidate.boat_id,
        baseScore: candidate.score,
        scoreBreakdown: candidate.score_breakdown,
        boat: {
          year: candidate.year,
          make: candidate.make,
          model: candidate.model,
          asking_price: candidate.asking_price,
          currency: candidate.currency,
          location_text: candidate.location_text,
          specs: candidate.specs,
          character_tags: candidate.character_tags,
          ai_summary: candidate.ai_summary,
        },
      },
    },
    null,
    2
  );
}

function normalizeRankings(
  raw: Record<string, unknown>,
  candidates: CandidateContext[]
): RankedCandidate[] {
  const candidateIds = new Set(candidates.map((candidate) => candidate.boat_id));
  const rankings = Array.isArray(raw.rankings) ? raw.rankings : [];

  return rankings
    .map((item) => {
      const record = (item || {}) as Record<string, unknown>;
      const boatId = String(record.boatId || "").trim();
      if (!boatId || !candidateIds.has(boatId)) {
        return null;
      }

      const candidate = candidates.find((entry) => entry.boat_id === boatId);
      if (!candidate) {
        return null;
      }

      const fitScore = clampScore(Number(record.fitScore || 0.55), 0.1, 0.95);
      const verdict = normalizeVerdict(record.verdict);
      const confidence = clampScore(Number(record.confidence || fitScore), 0.1, 0.95);

      return {
        boatId,
        fitScore,
        verdict,
        summary: normalizeSummary(record.summary, buildFallbackSummary(candidate)),
        strengths: normalizeStringArray(record.strengths, 3),
        risks: normalizeStringArray(record.risks, 2),
        confidence,
      } satisfies RankedCandidate;
    })
    .filter((item): item is RankedCandidate => Boolean(item));
}

function normalizeSingleRanking(
  raw: Record<string, unknown>,
  candidate: CandidateContext
): RankedCandidate {
  const fitScore = clampScore(Number(raw.fitScore || 0.55), 0.1, 0.95);
  const verdict = normalizeVerdict(raw.verdict);
  const confidence = clampScore(Number(raw.confidence || fitScore), 0.1, 0.95);

  return {
    boatId: candidate.boat_id,
    fitScore,
    verdict,
    summary: normalizeSummary(raw.summary, buildFallbackSummary(candidate)),
    strengths: normalizeStringArray(raw.strengths, 3),
    risks: normalizeStringArray(raw.risks, 2),
    confidence,
  };
}

async function fetchBuyerContext(buyerProfileId: string): Promise<BuyerContext | null> {
  return queryOne<BuyerContext>(
    `SELECT id, use_case, budget_range, boat_type_prefs, spec_preferences,
            location_prefs, refit_tolerance
     FROM buyer_profiles
     WHERE id = $1`,
    [buyerProfileId]
  );
}

async function fetchCandidateContext(buyerProfileId: string): Promise<CandidateContext[]> {
  return query<CandidateContext>(
    `SELECT m.id as match_id, m.boat_id, m.score, m.score_breakdown,
            b.make, b.model, b.year, b.asking_price, b.currency, b.location_text,
            COALESCE(d.specs, '{}'::jsonb) as specs,
            COALESCE(d.character_tags, ARRAY[]::text[]) as character_tags,
            d.ai_summary
     FROM matches m
     JOIN boats b ON b.id = m.boat_id
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE m.buyer_id = $1
       AND b.status = 'active'
       AND ${buildVisibleImportQualitySql("b")}
       AND m.buyer_action != 'passed'
     ORDER BY m.score DESC
     LIMIT $2`,
    [buyerProfileId, MAX_RERANKED_MATCHES]
  );
}

async function persistRankedCandidate(
  matchId: string,
  breakdown: ScoreBreakdown,
  ranked: RankedCandidate,
  provider: string,
  model: string,
  finalScore: number
) {
  await query(
    `INSERT INTO match_ai_signals (match_id, ai_score, verdict, provider, model)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (match_id)
     DO UPDATE SET
       ai_score = EXCLUDED.ai_score,
       verdict = EXCLUDED.verdict,
       provider = EXCLUDED.provider,
       model = EXCLUDED.model,
       updated_at = NOW()`,
    [matchId, ranked.fitScore, ranked.verdict, provider, model]
  );

  await query(
    `UPDATE matches
     SET score = $2,
         score_breakdown = $3,
         updated_at = NOW()
     WHERE id = $1`,
    [matchId, finalScore, JSON.stringify(breakdown)]
  );

  await query(
    `INSERT INTO match_explanations (
      match_id, summary, strengths, risks, confidence, provider, model
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (match_id)
    DO UPDATE SET
      summary = EXCLUDED.summary,
      strengths = EXCLUDED.strengths,
      risks = EXCLUDED.risks,
      confidence = EXCLUDED.confidence,
      provider = EXCLUDED.provider,
      model = EXCLUDED.model,
      updated_at = NOW()`,
    [
      matchId,
      ranked.summary,
      JSON.stringify(ranked.strengths),
      JSON.stringify(ranked.risks),
      ranked.confidence,
      provider,
      model,
    ]
  );
}

async function rerankSingleCandidate(
  buyer: BuyerContext,
  buyerProfileId: string,
  candidate: CandidateContext
): Promise<RankedCandidateWithMeta | null> {
  const systemPrompt = buildSingleSystemPrompt();
  const userPrompt = buildSingleUserPrompt(buyer, candidate);
  const promptHash = createHash("sha256")
    .update(systemPrompt)
    .update(userPrompt)
    .digest("hex")
    .slice(0, 32);

  try {
    const result = await generateText(systemPrompt, userPrompt);

    await logLLMResponse({
      scopeType: "buyer_profile",
      scopeId: buyerProfileId,
      taskType: "match_rerank",
      provider: result.provider,
      model: result.model,
      promptHash,
      inputSummary: `Fallback rerank for ${candidate.year} ${candidate.make} ${candidate.model}`,
      response: result.output,
      latencyMs: result.latencyMs,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      wasSelected: true,
      selectionReason: "single_candidate_fallback",
    });

    const parsed = extractJsonPayload(result.output);
    if (!parsed) {
      throw new Error("LLM did not return valid single-candidate rerank JSON");
    }

    return {
      ranked: normalizeSingleRanking(parsed, candidate),
      provider: result.provider,
      model: result.model,
    };
  } catch (err) {
    logger.warn(
      { err, buyerProfileId, boatId: candidate.boat_id, provider: getMatchIntelligenceProvider() },
      "Single-candidate rerank failed"
    );
    return null;
  }
}

export async function rerankMatchesForBuyer(buyerProfileId: string): Promise<number> {
  if (!matchIntelligenceEnabled()) {
    return 0;
  }

  const buyer = await fetchBuyerContext(buyerProfileId);
  if (!buyer) {
    return 0;
  }

  const candidates = await fetchCandidateContext(buyerProfileId);
  if (!candidates.length) {
    return 0;
  }

  const systemPrompt = buildSystemPrompt();
  let updatedCount = 0;

  for (const batch of chunk(candidates, RERANK_BATCH_SIZE)) {
    const userPrompt = buildUserPrompt(buyer, batch);
    const promptHash = createHash("sha256")
      .update(systemPrompt)
      .update(userPrompt)
      .digest("hex")
      .slice(0, 32);

    try {
      const result = await generateText(systemPrompt, userPrompt);

      await logLLMResponse({
        scopeType: "buyer_profile",
        scopeId: buyerProfileId,
        taskType: "match_rerank",
        provider: result.provider,
        model: result.model,
        promptHash,
        inputSummary: `Reranked ${batch.length} candidate boats`,
        response: result.output,
        latencyMs: result.latencyMs,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        wasSelected: true,
        selectionReason: "single_provider",
      });

      const parsed = extractJsonPayload(result.output);
      if (!parsed) {
        throw new Error("LLM did not return valid rerank JSON");
      }

      const rankings = normalizeRankings(parsed, batch);
      const rankingMap = new Map(rankings.map((ranking) => [ranking.boatId, ranking]));

      for (const candidate of batch) {
        const ranked = rankingMap.get(candidate.boat_id);
        if (!ranked) {
          continue;
        }

        const finalScore = combineMatchScore(candidate.score, ranked.fitScore, ranked.verdict);
        const nextBreakdown: ScoreBreakdown = {
          ...candidate.score_breakdown,
          base_total: candidate.score,
          ai_fit: ranked.fitScore,
          final_total: finalScore,
          total: finalScore,
        };

        await persistRankedCandidate(
          candidate.match_id,
          nextBreakdown,
          ranked,
          result.provider,
          result.model,
          finalScore
        );
        updatedCount++;
      }
    } catch (err) {
      logger.warn(
        { err, buyerProfileId, provider: getMatchIntelligenceProvider() },
        "Match rerank batch failed"
      );

      for (const candidate of batch) {
        const fallbackResult = await rerankSingleCandidate(buyer, buyerProfileId, candidate);
        if (!fallbackResult) {
          continue;
        }
        const ranked = fallbackResult.ranked;

        const finalScore = combineMatchScore(candidate.score, ranked.fitScore, ranked.verdict);
        const nextBreakdown: ScoreBreakdown = {
          ...candidate.score_breakdown,
          base_total: candidate.score,
          ai_fit: ranked.fitScore,
          final_total: finalScore,
          total: finalScore,
        };

        await persistRankedCandidate(
          candidate.match_id,
          nextBreakdown,
          ranked,
          fallbackResult.provider,
          fallbackResult.model,
          finalScore
        );
        updatedCount++;
      }
    }
  }

  return updatedCount;
}
