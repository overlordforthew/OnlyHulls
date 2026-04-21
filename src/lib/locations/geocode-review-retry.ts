import { normalizeGeocodeQueryKey, type GeocodePrecision, type GeocodeStatus } from "./geocoding";

export type ChangedReviewRetryInput = {
  status?: GeocodeStatus | "pending" | null;
  previousQueryText?: string | null;
  currentQueryKey?: string | null;
};

export type ChangedGeocodedRetryInput = ChangedReviewRetryInput & {
  previousPrecision?: GeocodePrecision | null;
  verifiedAliasInLocationText?: boolean;
  verifiedAliasInQueryText?: boolean;
};

const RETRYABLE_GEOCODED_PRECISIONS: ReadonlySet<GeocodePrecision> = new Set([
  "city",
  "region",
  "country",
  "unknown",
]);

export function shouldRetryChangedReviewGeocode(input: ChangedReviewRetryInput) {
  if (input.status !== "review" && input.status !== "failed") return false;

  const previousQueryKey = normalizeGeocodeQueryKey(input.previousQueryText);
  const currentQueryKey = normalizeGeocodeQueryKey(input.currentQueryKey);
  if (!previousQueryKey || !currentQueryKey) return false;

  return previousQueryKey !== currentQueryKey;
}

export function shouldRetryChangedGeocodedNonPublicGeocode(input: ChangedGeocodedRetryInput) {
  if (input.status !== "geocoded") return false;
  if (!input.previousPrecision || !RETRYABLE_GEOCODED_PRECISIONS.has(input.previousPrecision)) {
    return false;
  }
  if (!input.verifiedAliasInLocationText || !input.verifiedAliasInQueryText) return false;

  const previousQueryKey = normalizeGeocodeQueryKey(input.previousQueryText);
  const currentQueryKey = normalizeGeocodeQueryKey(input.currentQueryKey);
  if (!previousQueryKey || !currentQueryKey) return false;

  return previousQueryKey !== currentQueryKey;
}
