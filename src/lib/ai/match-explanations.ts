import { createHash } from "crypto";
import { query, queryOne } from "@/lib/db";
import { generateText, matchIntelligenceEnabled } from "@/lib/ai/provider";
import { logLLMResponse } from "@/lib/ai/logging";
import { logger } from "@/lib/logger";

interface MatchContext {
  match_id: string;
  score: number;
  score_breakdown: Record<string, number>;
  boat_id: string;
  make: string;
  model: string;
  year: number;
  asking_price: number;
  currency: string;
  location_text: string | null;
  specs: Record<string, unknown>;
  character_tags: string[];
  ai_summary: string | null;
  use_case: string[];
  budget_range: Record<string, unknown>;
  boat_type_prefs: Record<string, unknown>;
  spec_preferences: Record<string, unknown>;
  location_prefs: Record<string, unknown>;
  refit_tolerance: string | null;
}

export interface MatchExplanationRecord {
  summary: string;
  strengths: string[];
  risks: string[];
  confidence: number;
  provider: string;
  model: string;
}

function clampConfidence(value: unknown, fallback = 0.55): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(0.95, Math.max(0.1, num));
}

function buildFallbackExplanation(context: MatchContext): MatchExplanationRecord {
  const breakdown = context.score_breakdown || {};
  const strengths: string[] = [];
  const risks: string[] = [];

  if ((breakdown.budget_fit || 0) >= 0.7) {
    strengths.push("Budget alignment looks strong.");
  } else if ((breakdown.budget_fit || 0) <= 0.35) {
    risks.push("Price fit looks weaker than the rest of the profile.");
  }

  if ((breakdown.boat_type_fit || 0) >= 0.7) {
    strengths.push("Boat type preferences line up well.");
  }

  if ((breakdown.spec_fit || 0) >= 0.7) {
    strengths.push("Core size and spec signals are aligned.");
  } else if ((breakdown.spec_fit || 0) <= 0.35) {
    risks.push("Some spec preferences are only partially met.");
  }

  if ((breakdown.location_fit || 0) >= 0.7) {
    strengths.push("Location is a good fit for the buyer profile.");
  }

  if (!strengths.length) {
    strengths.push("This boat is one of the stronger overall fits currently available.");
  }
  if (!risks.length) {
    risks.push("A human review is still needed before treating this as a perfect fit.");
  }

  return {
    summary: `${context.year} ${context.make} ${context.model} looks like a credible match based on budget, boat type, specs, and location signals.`,
    strengths: strengths.slice(0, 3),
    risks: risks.slice(0, 2),
    confidence: clampConfidence(context.score, 0.6),
    provider: "rules",
    model: "fallback",
  };
}

async function fetchMatchContext(matchId: string): Promise<MatchContext | null> {
  return queryOne<MatchContext>(
    `SELECT m.id as match_id, m.score, m.score_breakdown,
            b.id as boat_id, b.make, b.model, b.year, b.asking_price, b.currency, b.location_text,
            COALESCE(d.specs, '{}') as specs,
            COALESCE(d.character_tags, '{}') as character_tags,
            d.ai_summary,
            bp.use_case,
            bp.budget_range,
            bp.boat_type_prefs,
            bp.spec_preferences,
            bp.location_prefs,
            bp.refit_tolerance
     FROM matches m
     JOIN boats b ON b.id = m.boat_id
     JOIN buyer_profiles bp ON bp.id = m.buyer_id
     LEFT JOIN boat_dna d ON d.boat_id = b.id
     WHERE m.id = $1`,
    [matchId]
  );
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function generateAIExplanation(context: MatchContext): Promise<MatchExplanationRecord> {
  const systemPrompt = [
    "You explain why a sailboat listing matches a buyer profile.",
    "Be concrete, practical, and skeptical.",
    "Return strict JSON only with keys: summary, strengths, risks, confidence.",
    "summary must be one short paragraph.",
    "strengths must be an array of 1 to 3 strings.",
    "risks must be an array of 0 to 2 strings.",
    "confidence must be a number between 0.1 and 0.95.",
  ].join(" ");

  const input = JSON.stringify(
    {
      buyer: {
        use_case: context.use_case,
        budget_range: context.budget_range,
        boat_type_prefs: context.boat_type_prefs,
        spec_preferences: context.spec_preferences,
        location_prefs: context.location_prefs,
        refit_tolerance: context.refit_tolerance,
      },
      boat: {
        year: context.year,
        make: context.make,
        model: context.model,
        asking_price: context.asking_price,
        currency: context.currency,
        location_text: context.location_text,
        specs: context.specs,
        character_tags: context.character_tags,
        ai_summary: context.ai_summary,
      },
      score: context.score,
      score_breakdown: context.score_breakdown,
    },
    null,
    2
  );

  const result = await generateText(systemPrompt, input);
  const parsed = extractJsonObject(result.output);
  if (!parsed) {
    throw new Error("LLM did not return valid JSON");
  }

  const promptHash = createHash("sha256")
    .update(systemPrompt)
    .update(input)
    .digest("hex")
    .slice(0, 32);

  await logLLMResponse({
    scopeType: "match",
    scopeId: context.match_id,
    taskType: "match_explanation",
    provider: result.provider,
    model: result.model,
    promptHash,
    inputSummary: `${context.year} ${context.make} ${context.model} vs buyer profile`,
    response: result.output,
    latencyMs: result.latencyMs,
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut,
    wasSelected: true,
    selectionReason: "single_provider",
  });

  return {
    summary: String(parsed.summary || "").trim(),
    strengths: Array.isArray(parsed.strengths)
      ? parsed.strengths.map((item) => String(item)).filter(Boolean).slice(0, 3)
      : [],
    risks: Array.isArray(parsed.risks)
      ? parsed.risks.map((item) => String(item)).filter(Boolean).slice(0, 2)
      : [],
    confidence: clampConfidence(parsed.confidence, context.score),
    provider: result.provider,
    model: result.model,
  };
}

export async function ensureMatchExplanation(matchId: string): Promise<MatchExplanationRecord | null> {
  const existing = await queryOne<MatchExplanationRecord>(
    `SELECT summary, strengths, risks, confidence, provider, model
     FROM match_explanations
     WHERE match_id = $1`,
    [matchId]
  );
  if (existing) {
    return existing;
  }

  const context = await fetchMatchContext(matchId);
  if (!context) {
    return null;
  }

  let explanation = buildFallbackExplanation(context);

  if (matchIntelligenceEnabled()) {
    try {
      explanation = await generateAIExplanation(context);
    } catch (err) {
      logger.warn({ err, matchId }, "Falling back to rule-based match explanation");
    }
  }

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
      explanation.summary,
      JSON.stringify(explanation.strengths),
      JSON.stringify(explanation.risks),
      explanation.confidence,
      explanation.provider,
      explanation.model,
    ]
  );

  return explanation;
}
