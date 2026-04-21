import type { GeocodePrecision, GeocodeResult } from "@/lib/locations/geocoding";

type PublicPinCandidateInput = {
  locationText?: string | null;
  queryText?: string | null;
};

export const PUBLIC_PIN_MIN_ELIGIBLE_RATE = 0.6;
export const PUBLIC_PIN_ELIGIBLE_PRECISIONS: ReadonlySet<GeocodePrecision> = new Set([
  "exact",
  "street",
  "marina",
]);

const PUBLIC_PIN_MARINE_PATTERNS = [
  /\bmarina\b/i,
  /\byacht\s*club\b/i,
  /\byachtclub\b/i,
  /\bmarmaris\s+yacht\s+marina\b/i,
  /\bmarina\s+du\s+marin\b/i,
  /\bport\s+pin\s+rolland\b/i,
  /\bport\s+tino\s+rossi\b/i,
  /\bboat\s*yards?\b/i,
  /\bboatyards?\b/i,
  /\bship\s*yards?\b/i,
  /\bshipyards?\b/i,
  /\bdock(?:s|yard)?\b/i,
  /\bquay\b/i,
  /\bdarsena\b/i,
  /\bport\s+de\s+plaisance\b/i,
];
const VERIFIED_PUBLIC_PIN_LOCATION_ALIASES = ["burnham yacht harbour"];

function normalizeLaneText(value?: string | null) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAliasText(value?: string | null) {
  return normalizeLaneText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedHasAlias(value: string, alias: string) {
  return new RegExp(`(^|\\s)${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`).test(value);
}

export function isPublicPinLikelyText(value?: string | null) {
  const normalized = normalizeLaneText(value);
  if (!normalized) return false;

  const aliasText = normalizeAliasText(normalized);
  if (VERIFIED_PUBLIC_PIN_LOCATION_ALIASES.some((alias) => normalizedHasAlias(aliasText, alias))) {
    return true;
  }

  return PUBLIC_PIN_MARINE_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function isPublicPinLikelyGeocodeCandidate(input: PublicPinCandidateInput) {
  return isPublicPinLikelyText(input.queryText) || isPublicPinLikelyText(input.locationText);
}

export function isPublicPinEligiblePrecision(precision?: GeocodePrecision | null) {
  return Boolean(precision && PUBLIC_PIN_ELIGIBLE_PRECISIONS.has(precision));
}

export function isPublicPinEligibleResult(
  result?: Pick<GeocodeResult, "status" | "precision"> | null
) {
  return result?.status === "geocoded" && isPublicPinEligiblePrecision(result.precision);
}

export function getPublicPinEligibleRate(eligible: number, selectedRows: number) {
  if (selectedRows <= 0) return 0;
  return Number((eligible / selectedRows).toFixed(3));
}

export function getPublicPinApplyResult(result: GeocodeResult): GeocodeResult {
  if (isPublicPinEligibleResult(result)) return result;
  if (result.status !== "geocoded") return result;

  return {
    ...result,
    status: "review",
    latitude: null,
    longitude: null,
    error: result.error || "public_pin_ineligible_precision",
  };
}

export function getPublicPinApplyGateStop(input: {
  apply: boolean;
  publicPinCandidates: boolean;
  selectedRows: number;
  publicPinEligibleRate: number;
  minEligibleRate?: number;
}) {
  const minEligibleRate = input.minEligibleRate ?? PUBLIC_PIN_MIN_ELIGIBLE_RATE;
  if (!input.apply || !input.publicPinCandidates || input.selectedRows === 0) return null;
  if (input.publicPinEligibleRate >= minEligibleRate) return null;

  return {
    stoppedReason: "public_pin_eligible_rate_below_threshold",
    message: `Public pin apply blocked: eligible precision rate ${input.publicPinEligibleRate} is below ${minEligibleRate}. Run a preview/source cleanup before applying.`,
  };
}
