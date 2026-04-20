import type { GeocodingProvider } from "@/lib/locations/geocoding";

export const PUBLIC_MAP_APPLY_OVERRIDE_FLAG = "--allow-public-map-apply";
export const LARGE_BATCH_OVERRIDE_FLAG = "--allow-large-batch";
export const NOMINATIM_VALIDATION_UNIQUE_APPLY_THRESHOLD = 50;
export const PAID_PROVIDER_UNIQUE_APPLY_THRESHOLD = 2000;

export type GeocodeApplySafetyInput = {
  apply: boolean;
  provider: GeocodingProvider;
  providerEnabled: boolean;
  publicMapEnabled: boolean;
  selectedUniqueQueries: number;
  allowLargeBatch: boolean;
  allowPublicMapApply: boolean;
};

export type GeocodeApplySafetyStop = {
  stoppedReason: string;
  message: string;
};

export function isEnabledEnvValue(value?: string | null) {
  return String(value || "").trim().toLowerCase() === "true";
}

export function getBatchUniqueApplyThreshold(provider: GeocodingProvider) {
  return provider === "nominatim"
    ? NOMINATIM_VALIDATION_UNIQUE_APPLY_THRESHOLD
    : PAID_PROVIDER_UNIQUE_APPLY_THRESHOLD;
}

export function getGeocodeApplySafetyStop(
  input: GeocodeApplySafetyInput
): GeocodeApplySafetyStop | null {
  if (!input.apply) return null;

  if (!input.providerEnabled) {
    return {
      stoppedReason: `${input.provider}_not_configured`,
      message: `Refusing --apply: geocoding provider '${input.provider}' is not configured.`,
    };
  }

  if (input.publicMapEnabled && !input.allowPublicMapApply) {
    return {
      stoppedReason: "public_map_enabled_without_override",
      message:
        `Refusing --apply: PUBLIC_MAP_ENABLED=true. Run location backfills with PUBLIC_MAP_ENABLED=false, ` +
        `or pass ${PUBLIC_MAP_APPLY_OVERRIDE_FLAG} for a deliberate live-map maintenance run.`,
    };
  }

  const batchUniqueApplyThreshold = getBatchUniqueApplyThreshold(input.provider);
  if (input.selectedUniqueQueries > batchUniqueApplyThreshold && !input.allowLargeBatch) {
    const thresholdText = `${batchUniqueApplyThreshold}`;
    const nominatimMessage =
      `Refusing --apply: nominatim batch has ${input.selectedUniqueQueries} unique geocode queries, ` +
      `above the ${thresholdText} validation ceiling. Use opencage for production backfill, ` +
      `reduce --limit, or pass ${LARGE_BATCH_OVERRIDE_FLAG} with a written justification.`;

    return {
      stoppedReason: `selected_unique_queries_${input.selectedUniqueQueries}_exceeds_${thresholdText}`,
      message:
        input.provider === "nominatim"
          ? nominatimMessage
          : `Refusing --apply: selected batch has ${input.selectedUniqueQueries} unique geocode queries, above ${thresholdText}. Reduce --limit or pass ${LARGE_BATCH_OVERRIDE_FLAG}.`,
    };
  }

  return null;
}
