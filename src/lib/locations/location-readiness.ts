import { resolveLocationCountryHint } from "@/lib/locations/top-markets";

export type LocationCountryHintAuditInput = {
  locationText?: string | null;
  storedCountry?: string | null;
};

export type LocationCountryHintMismatchGroup = {
  locationText: string;
  storedCountry: string | null;
  expectedCountry: string;
  expectedRegion: string;
  matchedTerm: string;
  count: number;
};

export type LocationMapReadinessInput = {
  marketTagRate: number;
  cityOrBetterRate: number;
  mappableCoordinateRate: number;
  countryHintMismatchCount: number;
  reviewFailedCount: number;
  geocodingEnabled: boolean;
};

function normalizeAuditValue(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildCountryHintMismatchGroups(
  rows: LocationCountryHintAuditInput[],
  limit = 12
): LocationCountryHintMismatchGroup[] {
  const groups = new Map<string, LocationCountryHintMismatchGroup>();

  for (const row of rows) {
    const locationText = String(row.locationText || "").trim();
    if (!locationText) continue;
    const hint = resolveLocationCountryHint(locationText);
    if (!hint) continue;
    if (normalizeAuditValue(row.storedCountry) === normalizeAuditValue(hint.country)) continue;

    const key = normalizeAuditValue(locationText);
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }

    groups.set(key, {
      locationText,
      storedCountry: row.storedCountry || null,
      expectedCountry: hint.country,
      expectedRegion: hint.region,
      matchedTerm: hint.matchedTerm,
      count: 1,
    });
  }

  return Array.from(groups.values())
    .sort((left, right) => right.count - left.count || left.locationText.localeCompare(right.locationText))
    .slice(0, Math.max(0, limit));
}

export function getLocationMapReadinessBlockers(input: LocationMapReadinessInput) {
  const blockers: string[] = [];

  if (input.marketTagRate < 95) blockers.push("market tags below 95%");
  if (input.cityOrBetterRate < 85) blockers.push("city-quality locations below 85%");
  if (input.mappableCoordinateRate < 85) blockers.push("public map pins below 85%");
  if (input.countryHintMismatchCount > 0) {
    blockers.push(`${input.countryHintMismatchCount.toLocaleString()} country hint mismatch${input.countryHintMismatchCount === 1 ? "" : "es"}`);
  }
  if (input.reviewFailedCount > 0) {
    blockers.push(`${input.reviewFailedCount.toLocaleString()} review/failed geocode${input.reviewFailedCount === 1 ? "" : "s"}`);
  }
  if (!input.geocodingEnabled) blockers.push("geocoder not configured");

  return blockers;
}

export function isLocationMapDataReady(input: LocationMapReadinessInput) {
  return getLocationMapReadinessBlockers(input).length === 0;
}
