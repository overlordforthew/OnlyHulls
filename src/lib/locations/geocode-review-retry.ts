import { normalizeGeocodeQueryKey, type GeocodeStatus } from "./geocoding";

export type ChangedReviewRetryInput = {
  status?: GeocodeStatus | "pending" | null;
  previousQueryText?: string | null;
  currentQueryKey?: string | null;
};

export function shouldRetryChangedReviewGeocode(input: ChangedReviewRetryInput) {
  if (input.status !== "review" && input.status !== "failed") return false;

  const previousQueryKey = normalizeGeocodeQueryKey(input.previousQueryText);
  const currentQueryKey = normalizeGeocodeQueryKey(input.currentQueryKey);
  if (!previousQueryKey || !currentQueryKey) return false;

  return previousQueryKey !== currentQueryKey;
}
