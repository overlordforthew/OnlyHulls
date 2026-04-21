import type { GeocodePrecision } from "@/lib/locations/geocoding";
import { isPublicPinLikelyGeocodeCandidate } from "@/lib/locations/geocode-candidate-lanes";
import { getVerifiedPublicPinAliasInText } from "@/lib/locations/verified-public-pin-aliases";

export type LocationBacklogBucket =
  | "public_pin"
  | "held_back_coordinate"
  | "review_queue"
  | "pending_ready"
  | "needs_more_specific_location"
  | "unknown_location"
  | "other";

export type LocationBacklogIntervention =
  | "already_public_pin"
  | "hand_alias"
  | "gazetteer_poi"
  | "source_cleanup_rule"
  | "manual_pin"
  | "search_coverage_batch"
  | "manual_enrichment"
  | "unfixable";

export type SourceCleanupPattern = {
  id: string;
  label: string;
  pattern: RegExp;
  recommendation: string;
};

export type LocationBacklogAnalysisInput = {
  status?: string | null;
  precision?: GeocodePrecision | string | null;
  hasValidCoordinates: boolean;
  candidateReason: string;
  locationText?: string | null;
  queryText?: string | null;
  error?: string | null;
  triageCategory?: string | null;
};

export type LocationBacklogAnalysisResult = {
  bucket: LocationBacklogBucket;
  intervention: LocationBacklogIntervention;
  interventionProbability: number;
  unfixableReason: string | null;
  clusterLabel: string;
  clusterKey: string;
  marinePoiName: string | null;
  verifiedAlias: string | null;
  cleanupPatternIds: string[];
  rationale: string;
};

export const SOURCE_CLEANUP_PATTERNS: readonly SourceCleanupPattern[] = [
  {
    id: "dutch_sales_dock_prefix",
    label: "Dutch sales-dock boilerplate",
    pattern: /\ba?aan\s+verkoopsteiger\s+in\b/i,
    recommendation: "Drop `Aan Verkoopsteiger In` and geocode the remaining place name.",
  },
  {
    id: "directional_fragment",
    label: "Directional fragment around a real place",
    pattern: /\b(?:just\s+north\s+of|north\s+east\s+of|northeast\s+of|south\s+of|north\s+of)\b/i,
    recommendation: "Remove directional prose and retain the named nearby city/region.",
  },
  {
    id: "saint_martin_variants",
    label: "Saint Martin / Sint Maarten variant text",
    pattern: /\b(?:st\.?\s*maarten|saint\s+martin|sint\s+maarten|marigot)\b.*\b(?:na|mf|dutch\s+part|french|region|caribbean|carribean)\b/i,
    recommendation: "Normalize Saint Martin/Sint Maarten region suffixes to a reviewed city or marina.",
  },
  {
    id: "misspelled_country_or_region",
    label: "Misspelled country or region token",
    pattern: /\b(?:bahmas|gibraltor|horvatia|peloponesse|martiniqe|primoten|santantioco|islan|hiero|grenade)\b/i,
    recommendation: "Correct the misspelled place token before retrying geocoding.",
  },
  {
    id: "lake_context",
    label: "Lake / inland-water context",
    pattern: /\blake\s+(?:huron|erie|ontario|champlain|travis)\b/i,
    recommendation: "Normalize to the named marina/city plus lake only when the listing text has a specific place.",
  },
];

const MARINE_POI_TERMS =
  /\b(?:marina|yacht\s*club|yachtclub|yacht\s+harbou?r|boatyard|boat\s*yard|shipyard|ship\s*yard|dock|quay|darsena|port\s+de\s+plaisance)\b/i;

export function normalizeLocationBacklogText(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getLocationBacklogBucket(input: LocationBacklogAnalysisInput): LocationBacklogBucket {
  const status = input.status || "pending";
  const precision = input.precision || "unknown";

  if (
    status === "geocoded" &&
    input.hasValidCoordinates &&
    ["exact", "street", "marina"].includes(String(precision))
  ) {
    return "public_pin";
  }
  if (status === "geocoded" && input.hasValidCoordinates) return "held_back_coordinate";
  if (status === "review" || status === "failed") return "review_queue";
  if (input.candidateReason === "ready") return "pending_ready";
  if (input.candidateReason === "needs_more_specific_location") return "needs_more_specific_location";
  if (input.candidateReason === "unknown_location") return "unknown_location";

  return "other";
}

export function getSourceCleanupPatternMatches(value?: string | null) {
  const text = value || "";
  return SOURCE_CLEANUP_PATTERNS.filter((pattern) => pattern.pattern.test(text));
}

export function getSourceCleanupPatternMatchesForTexts(...values: Array<string | null | undefined>) {
  const matches = new Map<string, SourceCleanupPattern>();

  for (const value of values) {
    for (const match of getSourceCleanupPatternMatches(value)) {
      matches.set(match.id, match);
    }
  }

  return [...matches.values()];
}

export function getMarinePoiNameCandidate(value?: string | null) {
  const text = String(value || "").trim();
  if (!text) return null;

  const parts = text
    .split(/[,;|/]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const marinePart = parts.find((part) => MARINE_POI_TERMS.test(part));
  if (marinePart) return marinePart.replace(/\s+/g, " ").trim();
  if (MARINE_POI_TERMS.test(text)) return text.replace(/\s+/g, " ").trim();

  return null;
}

function getFallbackClusterLabel(input: LocationBacklogAnalysisInput) {
  return (
    input.queryText?.trim() ||
    input.locationText?.trim() ||
    input.error?.trim() ||
    input.candidateReason ||
    "unknown"
  );
}

function getUnfixableReason(input: LocationBacklogAnalysisInput) {
  const normalized = normalizeLocationBacklogText(input.locationText);
  if (!normalized) return "missing_location_text";
  if (input.candidateReason === "unknown_location") return "unknown_location_text";
  if (input.candidateReason === "needs_more_specific_location") return "broad_region_or_state_only";
  return "not_actionable_without_enrichment";
}

function getCleanupClusterLabel(matches: SourceCleanupPattern[]) {
  return matches.length > 0 ? matches[0].label : null;
}

export function analyzeLocationBacklogRow(
  input: LocationBacklogAnalysisInput
): LocationBacklogAnalysisResult {
  const bucket = getLocationBacklogBucket(input);
  const cleanupMatches = getSourceCleanupPatternMatchesForTexts(input.locationText, input.queryText);
  const verifiedAlias =
    getVerifiedPublicPinAliasInText(input.queryText) || getVerifiedPublicPinAliasInText(input.locationText);
  const marinePoiName =
    getMarinePoiNameCandidate(input.queryText) || getMarinePoiNameCandidate(input.locationText);
  const publicPinLikely = isPublicPinLikelyGeocodeCandidate({
    locationText: input.locationText,
    queryText: input.queryText,
  });

  let intervention: LocationBacklogIntervention = "manual_enrichment";
  let interventionProbability = 0.2;
  let unfixableReason: string | null = null;
  let rationale = "Needs manual review or enrichment before it can safely become a public pin.";
  let clusterLabel = getFallbackClusterLabel(input);

  if (bucket === "public_pin") {
    intervention = "already_public_pin";
    interventionProbability = 1;
    rationale = "Already has a public-map-safe precision.";
  } else if (verifiedAlias) {
    intervention = "hand_alias";
    interventionProbability = 0.8;
    clusterLabel = verifiedAlias;
    rationale = "Contains a documented alias; review as a narrow alias retry or alias anchor candidate.";
  } else if (cleanupMatches.length > 0 && bucket !== "held_back_coordinate") {
    intervention = "source_cleanup_rule";
    interventionProbability = bucket === "unknown_location" || input.error === "no_result" ? 0.55 : 0.4;
    clusterLabel = getCleanupClusterLabel(cleanupMatches) || clusterLabel;
    rationale = cleanupMatches[0].recommendation;
  } else if (publicPinLikely && marinePoiName) {
    intervention = "gazetteer_poi";
    interventionProbability = bucket === "pending_ready" ? 0.5 : 0.65;
    clusterLabel = marinePoiName;
    rationale = "Names a marine facility-like place; best handled by a vetted POI/gazetteer match.";
  } else if (bucket === "review_queue" && input.triageCategory === "manual_review") {
    intervention = "manual_pin";
    interventionProbability = 0.35;
    rationale = "Provider returned a reviewable result that needs human acceptance or rejection.";
  } else if (bucket === "pending_ready") {
    intervention = "search_coverage_batch";
    interventionProbability = 0.12;
    rationale = "Ready for search-coverage geocoding, but not enough evidence for a hard public pin.";
  } else if (bucket === "needs_more_specific_location" || bucket === "unknown_location") {
    intervention = "unfixable";
    interventionProbability = 0.02;
    unfixableReason = getUnfixableReason(input);
    rationale = "Not actionable without better source text or external enrichment.";
  } else if (bucket === "held_back_coordinate") {
    intervention = "manual_enrichment";
    interventionProbability = 0.18;
    rationale = "Has broad coordinates; keep search-only unless source detail identifies a public pin.";
  }

  const clusterKey = `${intervention}:${normalizeLocationBacklogText(clusterLabel) || "unknown"}`;

  return {
    bucket,
    intervention,
    interventionProbability,
    unfixableReason,
    clusterLabel,
    clusterKey,
    marinePoiName,
    verifiedAlias,
    cleanupPatternIds: cleanupMatches.map((match) => match.id),
    rationale,
  };
}
