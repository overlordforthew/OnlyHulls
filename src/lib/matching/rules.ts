interface BuyerProfile {
  budget_range: { min: number; max: number; currency: string; refit_budget: number };
  spec_preferences: { loa_min?: number; loa_max?: number; draft_max?: number; year_min?: number };
  location_prefs: { home_port: string; max_travel_km: number; regions: string[] };
  refit_tolerance: string;
  use_case: string[];
}

interface BoatData {
  asking_price: number;
  currency: string;
  year: number;
  location_text: string | null;
  specs: { loa?: number; draft?: number; rig_type?: string; hull_material?: string };
  condition_score: number | null;
  character_tags: string[];
}

export interface ScoreBreakdown {
  vector_sim: number;
  price_fit: number;
  spec_match: number;
  location: number;
  condition: number;
  total: number;
}

// Weights from spec
const WEIGHTS = {
  vector_sim: 0.35,
  price_fit: 0.25,
  spec_match: 0.20,
  location: 0.10,
  condition: 0.10,
};

export function computeMatchScore(
  vectorSimilarity: number,
  buyer: BuyerProfile,
  boat: BoatData
): ScoreBreakdown {
  const priceFit = scorePriceFit(buyer, boat);
  const specMatch = scoreSpecMatch(buyer, boat);
  const location = scoreLocation(buyer, boat);
  const condition = scoreCondition(buyer, boat);

  const total =
    vectorSimilarity * WEIGHTS.vector_sim +
    priceFit * WEIGHTS.price_fit +
    specMatch * WEIGHTS.spec_match +
    location * WEIGHTS.location +
    condition * WEIGHTS.condition;

  return {
    vector_sim: vectorSimilarity,
    price_fit: priceFit,
    spec_match: specMatch,
    location,
    condition,
    total: Math.min(1, Math.max(0, total)),
  };
}

function scorePriceFit(buyer: BuyerProfile, boat: BoatData): number {
  const { min, max } = buyer.budget_range;
  const price = boat.asking_price;
  // TODO: currency conversion
  if (price >= min && price <= max) return 1.0;
  if (price < min) return Math.max(0, 1 - (min - price) / min);
  // Over budget: penalize more
  const overRatio = (price - max) / max;
  return Math.max(0, 1 - overRatio * 2);
}

function scoreSpecMatch(buyer: BuyerProfile, boat: BoatData): number {
  const prefs = buyer.spec_preferences;
  let score = 0.5; // base score
  let factors = 0;

  if (prefs.loa_min && prefs.loa_max && boat.specs.loa) {
    factors++;
    if (boat.specs.loa >= prefs.loa_min && boat.specs.loa <= prefs.loa_max) {
      score += 0.5;
    } else {
      const dist = Math.min(
        Math.abs(boat.specs.loa - prefs.loa_min),
        Math.abs(boat.specs.loa - prefs.loa_max)
      );
      score += Math.max(0, 0.5 - dist / 20);
    }
  }

  if (prefs.draft_max && boat.specs.draft) {
    factors++;
    score += boat.specs.draft <= prefs.draft_max ? 0.5 : 0;
  }

  if (prefs.year_min && boat.year) {
    factors++;
    score += boat.year >= prefs.year_min ? 0.5 : Math.max(0, 0.5 - (prefs.year_min - boat.year) / 30);
  }

  return factors > 0 ? Math.min(1, score / (factors * 0.5 + 0.5)) : 0.5;
}

function scoreLocation(buyer: BuyerProfile, boat: BoatData): number {
  // Simple text-based matching for Phase 1
  if (!boat.location_text || !buyer.location_prefs.regions.length) return 0.5;

  const boatLoc = boat.location_text.toLowerCase();
  for (const region of buyer.location_prefs.regions) {
    if (boatLoc.includes(region.toLowerCase())) return 1.0;
  }

  if (buyer.location_prefs.home_port) {
    const hp = buyer.location_prefs.home_port.toLowerCase();
    if (boatLoc.includes(hp.split(",")[0])) return 0.8;
  }

  return 0.3;
}

function scoreCondition(buyer: BuyerProfile, boat: BoatData): number {
  if (!boat.condition_score) return 0.5;
  const tolerance = buyer.refit_tolerance;
  const score = boat.condition_score / 10;

  switch (tolerance) {
    case "turnkey":
      return score >= 0.7 ? 1.0 : score;
    case "minor":
      return score >= 0.5 ? 1.0 : score;
    case "major":
      return score >= 0.3 ? 0.8 : 0.5;
    case "project":
      return 0.7; // project buyers are flexible
    default:
      return score;
  }
}
