import { computeMatchScore, type ScoreBreakdown } from "./rules";
import { sanitizeHullMaterial } from "@/lib/specs/hull-material";

type JsonObject = Record<string, unknown>;

export interface BuyerProfileForMatching {
  use_case: string[];
  budget_range: JsonObject;
  boat_type_prefs: JsonObject;
  spec_preferences: JsonObject;
  location_prefs: JsonObject;
  refit_tolerance: string;
}

export interface BoatForMatching {
  id: string;
  make: string;
  model: string;
  asking_price: number;
  asking_price_usd?: number | null;
  currency: string;
  year: number;
  location_text: string | null;
  specs: Record<string, unknown>;
  condition_score: number | null;
  character_tags: string[];
  ai_summary?: string | null;
}

const USE_CASE_TAGS: Record<string, string[]> = {
  charter: ["family-friendly", "liveaboard-ready", "turnkey"],
  cruising: ["bluewater", "coastal-cruiser", "family-friendly"],
  fishing: ["sportfisher", "fishing"],
  liveaboard: ["liveaboard-ready", "turnkey", "family-friendly"],
  racing: ["race-ready", "performance"],
  weekender: ["weekender", "coastal-cruiser", "budget-friendly"],
};

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function normalizedHaystack(boat: BoatForMatching): string {
  return [
    boat.make,
    boat.model,
    boat.ai_summary || "",
    boat.location_text || "",
    boat.specs.vessel_type,
    boat.specs.rig_type,
    sanitizeHullMaterial(boat.specs.hull_material),
    ...boat.character_tags,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function explicitBoatTypes(boat: BoatForMatching): string[] {
  const raw = String(boat.specs.vessel_type || "")
    .trim()
    .toLowerCase();
  if (!raw) return [];

  const detected = new Set<string>();
  if (/\btrimaran\b/.test(raw)) detected.add("trimaran");
  if (/\bpower\s*cat\b|\bpowercat\b/.test(raw)) {
    detected.add("powerboat");
    detected.add("catamaran");
  }
  if (/\bpowerboat\b|\bmotor yacht\b|\bmotoryacht\b|\btrawler\b/.test(raw)) {
    detected.add("powerboat");
  }
  if (/\bcatamaran\b|\bcat boat\b|\bcatboat\b|\bmultihull\b/.test(raw)) {
    detected.add("catamaran");
  }
  if (/\bmonohull\b|\bsailboat\b|\bsloop\b|\bcutter\b|\bketch\b|\byawl\b/.test(raw)) {
    detected.add("monohull");
  }

  return Array.from(detected);
}

function normalizeDesiredTypes(value: unknown): string[] {
  return toStringArray(value)
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item && item !== "no-preference");
}

export function inferBoatTypes(boat: BoatForMatching): string[] {
  const explicitTypes = explicitBoatTypes(boat);
  if (explicitTypes.length) {
    return explicitTypes;
  }

  const haystack = normalizedHaystack(boat);
  const detected = new Set<string>();

  if (/\bcatamaran\b|\bcat boat\b|\bcatboat\b/.test(haystack)) {
    detected.add("catamaran");
  }
  if (/\btrimaran\b/.test(haystack)) {
    detected.add("trimaran");
  }
  if (/\bpowerboat\b|\bmotor yacht\b|\bmotoryacht\b|\btrawler\b|\bpower cat\b|\bpowercat\b/.test(haystack)) {
    detected.add("powerboat");
  }

  if (!detected.size) {
    detected.add("monohull");
  }

  return Array.from(detected);
}

export function boatMatchesDesiredTypes(
  buyer: Pick<BuyerProfileForMatching, "boat_type_prefs">,
  boat: BoatForMatching
): boolean {
  const desiredTypes = normalizeDesiredTypes(buyer.boat_type_prefs?.types);
  if (!desiredTypes.length) {
    return true;
  }

  const inferredTypes = inferBoatTypes(boat);
  return desiredTypes.some((type) => inferredTypes.includes(type));
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

export function computeHeuristicVectorSimilarity(
  buyer: BuyerProfileForMatching,
  boat: BoatForMatching
): number {
  const desiredTypes = normalizeDesiredTypes(buyer.boat_type_prefs?.types);
  const rigPrefs = toStringArray(buyer.boat_type_prefs?.rig_prefs).filter(
    (value) => value !== "no-preference"
  );
  const hullPrefs = toStringArray(buyer.boat_type_prefs?.hull_prefs).filter(
    (value) => value !== "no-preference"
  );
  const useCases = toStringArray(buyer.use_case);

  let score = 0.45;
  let signals = 0;

  if (desiredTypes.length) {
    signals++;
    const typeMatch = boatMatchesDesiredTypes(buyer, boat);
    score += typeMatch ? 0.18 : -0.08;
  }

  if (rigPrefs.length && boat.specs.rig_type) {
    signals++;
    score += rigPrefs.includes(String(boat.specs.rig_type).toLowerCase()) ? 0.15 : -0.05;
  }

  const hullMaterial = sanitizeHullMaterial(boat.specs.hull_material);
  if (hullPrefs.length && hullMaterial) {
    signals++;
    score += hullPrefs.includes(hullMaterial.toLowerCase()) ? 0.1 : -0.03;
  }

  if (useCases.length) {
    signals++;
    const desiredTags = useCases.flatMap((useCase) => USE_CASE_TAGS[useCase] || []);
    const overlap = desiredTags.filter((tag) => boat.character_tags.includes(tag)).length;
    if (overlap > 0) {
      score += Math.min(0.22, overlap * 0.08);
    } else {
      score -= 0.04;
    }
  }

  if (!signals) {
    return 0.5;
  }

  return clamp(score, 0.08, 0.95);
}

export function scoreBoatForBuyer(
  buyer: BuyerProfileForMatching,
  boat: BoatForMatching
): { score: number; breakdown: ScoreBreakdown } {
  if (!boatMatchesDesiredTypes(buyer, boat)) {
    return {
      score: 0,
      breakdown: {
        vector_sim: 0,
        price_fit: 0,
        spec_match: 0,
        location: 0,
        condition: 0,
        total: 0,
      },
    };
  }

  const vectorSimilarity = computeHeuristicVectorSimilarity(buyer, boat);
  const breakdown = computeMatchScore(
    vectorSimilarity,
    buyer as unknown as Parameters<typeof computeMatchScore>[1],
    {
      asking_price: boat.asking_price,
      asking_price_usd: boat.asking_price_usd,
      currency: boat.currency,
      year: boat.year,
      location_text: boat.location_text,
      specs: {
        loa: boat.specs.loa as number | undefined,
        draft: boat.specs.draft as number | undefined,
        rig_type: boat.specs.rig_type as string | undefined,
        hull_material: boat.specs.hull_material as string | undefined,
      },
      condition_score: boat.condition_score,
      character_tags: boat.character_tags,
    }
  );

  return {
    score: breakdown.total,
    breakdown,
  };
}
