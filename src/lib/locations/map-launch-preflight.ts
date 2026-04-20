import { getPublicMapClientConfig } from "@/lib/config/public-map";
import type { GeocodingProvider } from "@/lib/locations/geocoding";
import {
  getBatchUniqueApplyThreshold,
  getGeocodeApplySafetyStop,
  isEnabledEnvValue,
} from "@/lib/locations/geocode-rollout-safety";
import type { MapReadinessSnapshot } from "@/lib/locations/map-readiness";

type PreflightEnv = Record<string, string | undefined>;

export type MapLaunchPreflightStatus = "pass" | "fail" | "warn" | "info";

export type MapLaunchPreflightStep = {
  section: "env" | "readiness" | "review_queue" | "batch_simulation" | "verdict";
  key: string;
  status: MapLaunchPreflightStatus;
  message: string;
  actual?: string | number | boolean | null;
  target?: string | number | boolean | null;
  action?: string;
};

export type MapLaunchReadinessGate = {
  key?: string;
  target?: string;
  actual?: string | number | boolean | null;
  passed?: boolean;
};

export type MapLaunchReadinessReport = {
  verdict?: string;
  gates?: MapLaunchReadinessGate[];
  generatedAt?: string;
  coverage?: {
    publicCoverageRate?: number;
    publicPinCount?: number;
    activeVisibleCount?: number;
  };
  queue?: {
    pendingReadyCount?: number;
    uniqueReadyQueries?: number;
  };
  attempted?: {
    reviewCount?: number;
    failedCount?: number;
    reviewFailedRate?: number;
  };
  invariants?: {
    stalePublicCoordinateCount?: number;
    lowScorePublicPinCount?: number;
    invalidPublicCoordinateCount?: number;
    publicMissingMetadataCount?: number;
  };
  provider?: {
    configuredProvider?: string;
    enabled?: boolean;
  };
};

export type MapLaunchBatchSimulation = {
  limit: number;
  totalCandidates: number;
  geocodableCandidates: number;
  selectedRows: number;
  selectedUniqueQueries: number;
};

export type MapLaunchPreflightInput = {
  env?: PreflightEnv;
  readiness?: MapReadinessSnapshot | MapLaunchReadinessReport | null;
  batchSimulation?: MapLaunchBatchSimulation | null;
  externalSteps?: MapLaunchPreflightStep[];
  generatedAt?: string;
};

export type MapLaunchPreflightResult = {
  verdict: "GO" | "NO_GO";
  generatedAt: string;
  blockers: MapLaunchPreflightStep[];
  warnings: MapLaunchPreflightStep[];
  steps: MapLaunchPreflightStep[];
  nextCommands: string[];
};

const PLACEHOLDER_MARKERS = [
  "placeholder",
  "changeme",
  "example",
  "dummy",
  "replace-me",
  "replace_me",
  "...",
];

function hasConfiguredValue(value?: string | null) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("<") && trimmed.endsWith(">")) return false;
  if (trimmed.includes("$")) return false;

  const normalized = trimmed.toLowerCase();
  return !PLACEHOLDER_MARKERS.some((marker) => normalized.includes(marker));
}

function getEnvValue(env: PreflightEnv, ...keys: string[]) {
  for (const key of keys) {
    const value = env[key];
    if (value !== undefined) return value;
  }

  return undefined;
}

function normalizeProvider(value?: string | null): GeocodingProvider | "other" {
  const provider = String(value || "").trim().toLowerCase();
  if (provider === "opencage" || provider === "nominatim" || provider === "disabled") {
    return provider;
  }

  return provider ? "other" : "disabled";
}

function getProvider(env: PreflightEnv) {
  return normalizeProvider(getEnvValue(env, "LOCATION_GEOCODING_PROVIDER", "GEOCODING_PROVIDER"));
}

function getProviderForSafety(provider: ReturnType<typeof getProvider>): GeocodingProvider {
  return provider === "other" ? "disabled" : provider;
}

function getOpenCageKey(env: PreflightEnv) {
  return getEnvValue(env, "LOCATION_GEOCODING_API_KEY", "GEOCODING_API_KEY", "OPENCAGE_API_KEY");
}

function getContactEmail(env: PreflightEnv) {
  return getEnvValue(env, "LOCATION_GEOCODING_EMAIL", "GEOCODING_EMAIL");
}

function getUserAgent(env: PreflightEnv) {
  return getEnvValue(env, "LOCATION_GEOCODING_USER_AGENT", "GEOCODING_USER_AGENT");
}

function getClientFlag(env: PreflightEnv) {
  return getEnvValue(env, "NEXT_PUBLIC_MAP_ENABLED", "NEXT_PUBLIC_PUBLIC_MAP_ENABLED");
}

function getServerFlag(env: PreflightEnv) {
  return getEnvValue(env, "PUBLIC_MAP_ENABLED");
}

function step(input: MapLaunchPreflightStep): MapLaunchPreflightStep {
  return input;
}

function containsUnexpandedPlaceholder(value?: string | null) {
  return /\$[A-Z_][A-Z0-9_]*|\$\{[A-Z_][A-Z0-9_]*\}/.test(String(value || ""));
}

function getMapTilerKeyFromStyle(styleUrl: string) {
  try {
    const url = new URL(styleUrl);
    if (!url.hostname.includes("maptiler.com")) return null;
    return url.searchParams.get("key");
  } catch {
    return null;
  }
}

function isMapTilerStyle(styleUrl: string) {
  try {
    return new URL(styleUrl).hostname.includes("maptiler.com");
  } catch {
    return false;
  }
}

function getReadinessGates(readiness: MapLaunchPreflightInput["readiness"]) {
  if (!readiness) return [];
  if ("gates" in readiness && Array.isArray(readiness.gates)) return readiness.gates;
  return [];
}

function getReadinessReady(readiness: MapLaunchPreflightInput["readiness"]) {
  if (!readiness) return false;
  if ("launchReady" in readiness) return readiness.launchReady;
  if ("verdict" in readiness) return readiness.verdict === "GO_MAP_DATA_READY";

  return false;
}

function getReadinessBlockers(readiness: MapLaunchPreflightInput["readiness"]) {
  if (!readiness) return [];
  if ("blockers" in readiness) return readiness.blockers;

  return getReadinessGates(readiness)
    .filter((gate) => gate.passed === false)
    .map((gate) => gate.key || "readiness_gate_failed");
}

function getReviewFailedCount(readiness: MapLaunchPreflightInput["readiness"]) {
  if (!readiness) return null;
  if ("summary" in readiness) {
    return readiness.summary.reviewCount + readiness.summary.failedCount;
  }
  if ("attempted" in readiness) {
    return (readiness.attempted?.reviewCount || 0) + (readiness.attempted?.failedCount || 0);
  }

  return null;
}

function getInvariantCount(
  readiness: MapLaunchPreflightInput["readiness"],
  snapshotKey: keyof MapReadinessSnapshot["summary"],
  reportKey: keyof NonNullable<MapLaunchReadinessReport["invariants"]>
) {
  if (!readiness) return null;
  if ("summary" in readiness) return readiness.summary[snapshotKey];
  if ("invariants" in readiness) return readiness.invariants?.[reportKey] ?? null;

  return null;
}

function addUnique(commands: string[], command: string) {
  if (!commands.includes(command)) commands.push(command);
}

export function buildMapLaunchPreflight(
  input: MapLaunchPreflightInput = {}
): MapLaunchPreflightResult {
  const env = input.env || process.env;
  const steps: MapLaunchPreflightStep[] = [...(input.externalSteps || [])];
  const nextCommands: string[] = [];
  const provider = getProvider(env);
  const providerForSafety = getProviderForSafety(provider);
  const openCageKey = getOpenCageKey(env);
  const userAgent = getUserAgent(env);
  const contactEmail = getContactEmail(env);
  const serverFlag = getServerFlag(env);
  const clientFlag = getClientFlag(env);
  const publicMapEnabled = isEnabledEnvValue(serverFlag);
  const publicClientFlagEnabled = isEnabledEnvValue(clientFlag);
  const clientConfig = getPublicMapClientConfig({
    NEXT_PUBLIC_MAP_ENABLED: env.NEXT_PUBLIC_MAP_ENABLED,
    NEXT_PUBLIC_PUBLIC_MAP_ENABLED: env.NEXT_PUBLIC_PUBLIC_MAP_ENABLED,
    NEXT_PUBLIC_MAP_STYLE_URL: env.NEXT_PUBLIC_MAP_STYLE_URL,
    NEXT_PUBLIC_MAP_ATTRIBUTION: env.NEXT_PUBLIC_MAP_ATTRIBUTION,
    NEXT_PUBLIC_MAP_RESOURCE_ORIGINS: env.NEXT_PUBLIC_MAP_RESOURCE_ORIGINS,
  });
  const providerEnabled =
    provider === "opencage"
      ? hasConfiguredValue(openCageKey)
      : provider === "nominatim"
        ? hasConfiguredValue(userAgent)
        : false;

  if (provider === "opencage" && providerEnabled) {
    steps.push(step({
      section: "env",
      key: "opencage_provider_configured",
      status: "pass",
      message: "OpenCage is configured as the commercial geocoding provider.",
      actual: "opencage",
      target: "LOCATION_GEOCODING_PROVIDER=opencage with API key",
    }));
  } else if (provider === "nominatim") {
    steps.push(step({
      section: "env",
      key: "commercial_geocoder_not_configured",
      status: "fail",
      message: "Public Nominatim is validation-only; use OpenCage before commercial backfill or map launch.",
      actual: "nominatim",
      target: "opencage",
      action: "Set LOCATION_GEOCODING_PROVIDER=opencage and LOCATION_GEOCODING_API_KEY.",
    }));
    addUnique(nextCommands, "LOCATION_GEOCODING_PROVIDER=opencage LOCATION_GEOCODING_API_KEY=... PUBLIC_MAP_ENABLED=false npm run db:map-launch-preflight");
  } else {
    steps.push(step({
      section: "env",
      key: "commercial_geocoder_not_configured",
      status: "fail",
      message: provider === "other"
        ? "Unknown geocoding provider is configured."
        : "Commercial geocoding provider is not configured.",
      actual: provider,
      target: "opencage",
      action: "Set LOCATION_GEOCODING_PROVIDER=opencage and LOCATION_GEOCODING_API_KEY.",
    }));
    addUnique(nextCommands, "LOCATION_GEOCODING_PROVIDER=opencage LOCATION_GEOCODING_API_KEY=... PUBLIC_MAP_ENABLED=false npm run db:map-launch-preflight");
  }

  if (hasConfiguredValue(contactEmail) || String(userAgent || "").includes("@")) {
    steps.push(step({
      section: "env",
      key: "geocoder_contact_configured",
      status: "pass",
      message: "Geocoder contact metadata is configured.",
      target: "monitored support email in LOCATION_GEOCODING_EMAIL or user agent",
    }));
  } else {
    steps.push(step({
      section: "env",
      key: "geocoder_contact_missing",
      status: "warn",
      message: "Add a monitored geocoder contact before production batches.",
      target: "LOCATION_GEOCODING_EMAIL or contact email in LOCATION_GEOCODING_USER_AGENT",
      action: "Set LOCATION_GEOCODING_EMAIL to a monitored mailbox.",
    }));
  }

  if (publicMapEnabled === publicClientFlagEnabled) {
    steps.push(step({
      section: "env",
      key: "public_map_flags_match",
      status: "pass",
      message: "Server and client public map flags are aligned.",
      actual: publicMapEnabled,
      target: "both false before launch, both true only after GO",
    }));
  } else {
    steps.push(step({
      section: "env",
      key: "public_map_flags_mismatch",
      status: "fail",
      message: "Server and client public map flags are mismatched.",
      actual: `PUBLIC_MAP_ENABLED=${serverFlag || ""}, NEXT_PUBLIC_MAP_ENABLED=${clientFlag || ""}`,
      target: "matching flag values",
      action: "Flip both public map flags together.",
    }));
  }

  if (publicMapEnabled || publicClientFlagEnabled) {
    steps.push(step({
      section: "env",
      key: "public_map_flags_enabled",
      status: getReadinessReady(input.readiness) ? "pass" : "fail",
      message: getReadinessReady(input.readiness)
        ? "Public map flags are enabled after readiness passed."
        : "Public map flags are enabled before readiness passed.",
      actual: true,
      target: "false until readiness is GO",
      action: "Set PUBLIC_MAP_ENABLED=false and NEXT_PUBLIC_MAP_ENABLED=false until preflight is GO.",
    }));
  }

  if (clientConfig.styleUrl && !containsUnexpandedPlaceholder(env.NEXT_PUBLIC_MAP_STYLE_URL)) {
    steps.push(step({
      section: "env",
      key: "map_style_url_configured",
      status: "pass",
      message: "Map style URL is configured and parseable.",
      actual: clientConfig.styleUrl,
    }));
  } else {
    steps.push(step({
      section: "env",
      key: "map_style_url_missing",
      status: "fail",
      message: "Map style URL is missing, unsafe, or still contains an unexpanded env placeholder.",
      actual: env.NEXT_PUBLIC_MAP_STYLE_URL || null,
      target: "expanded https MapTiler style URL",
      action: "Set NEXT_PUBLIC_MAP_STYLE_URL with an expanded MapTiler key.",
    }));
    addUnique(nextCommands, "Configure MAPTILER_KEY, NEXT_PUBLIC_MAP_STYLE_URL, NEXT_PUBLIC_MAP_ATTRIBUTION, and NEXT_PUBLIC_MAP_RESOURCE_ORIGINS.");
  }

  const styleKey = getMapTilerKeyFromStyle(clientConfig.styleUrl);
  if (!isMapTilerStyle(clientConfig.styleUrl) || hasConfiguredValue(env.MAPTILER_KEY) || hasConfiguredValue(styleKey)) {
    steps.push(step({
      section: "env",
      key: "maptiler_key_configured",
      status: clientConfig.styleUrl ? "pass" : "info",
      message: clientConfig.styleUrl
        ? "Tile-provider key appears configured for the style URL."
        : "Tile-provider key cannot be checked until the style URL is configured.",
      target: "restricted commercial tile key",
    }));
  } else {
    steps.push(step({
      section: "env",
      key: "maptiler_key_missing",
      status: "fail",
      message: "MapTiler style URL is present but no usable key was found.",
      actual: styleKey || env.MAPTILER_KEY || null,
      target: "MAPTILER_KEY or expanded key= parameter",
      action: "Set a referrer-restricted MapTiler key before staging launch.",
    }));
  }

  if (clientConfig.attribution) {
    steps.push(step({
      section: "env",
      key: "map_attribution_configured",
      status: "pass",
      message: "Map attribution text is configured.",
    }));
  } else {
    steps.push(step({
      section: "env",
      key: "map_attribution_missing",
      status: "fail",
      message: "Map attribution is required before exposing the map.",
      target: "NEXT_PUBLIC_MAP_ATTRIBUTION",
      action: "Set provider and OpenStreetMap attribution text.",
    }));
  }

  if (String(env.NEXT_PUBLIC_MAP_RESOURCE_ORIGINS || "").includes("*")) {
    steps.push(step({
      section: "env",
      key: "map_resource_origins_wildcard",
      status: "fail",
      message: "Map resource origins contain a wildcard.",
      target: "explicit map style/tile/glyph/sprite origins only",
      action: "Replace wildcard map origins with explicit HTTPS origins.",
    }));
  } else if (clientConfig.resourceOrigins.length > 0) {
    steps.push(step({
      section: "env",
      key: "map_resource_origins_configured",
      status: "pass",
      message: "Map resource origins are explicit.",
      actual: clientConfig.resourceOrigins.join(","),
    }));
  } else {
    steps.push(step({
      section: "env",
      key: "map_resource_origins_missing",
      status: "fail",
      message: "No map resource origins are configured.",
      target: "explicit CSP/resource origins for map provider",
      action: "Set NEXT_PUBLIC_MAP_RESOURCE_ORIGINS to the provider hosts.",
    }));
  }

  if (!input.readiness) {
    steps.push(step({
      section: "readiness",
      key: "readiness_missing",
      status: "fail",
      message: "No map readiness snapshot was available.",
      target: "fresh readiness snapshot from live database",
      action: "Run npm run db:geocode-readiness, then rerun this preflight.",
    }));
    addUnique(nextCommands, "npm run db:geocode-readiness");
  } else if (getReadinessReady(input.readiness)) {
    steps.push(step({
      section: "readiness",
      key: "readiness_gates_passed",
      status: "pass",
      message: "Readiness gates report the map data as launch-ready.",
    }));
  } else {
    const blockers = getReadinessBlockers(input.readiness);
    steps.push(step({
      section: "readiness",
      key: "readiness_gates_failed",
      status: "fail",
      message: `Readiness gates are not launch-ready: ${blockers.slice(0, 5).join(", ") || "unknown"}.`,
      target: "all readiness gates passed",
      action: "Continue geocode batches and review queue cleanup before enabling the public map.",
    }));
    addUnique(nextCommands, "npm run db:geocode-locations -- --limit=100 --apply");
    addUnique(nextCommands, "npm run db:geocode-review");
    addUnique(nextCommands, "npm run db:geocode-readiness");
  }

  for (const gate of getReadinessGates(input.readiness)) {
    steps.push(step({
      section: "readiness",
      key: gate.key || "readiness_gate",
      status: gate.passed ? "pass" : "fail",
      message: gate.passed ? "Readiness gate passed." : "Readiness gate failed.",
      actual: gate.actual,
      target: gate.target,
    }));
  }

  const reviewFailedCount = getReviewFailedCount(input.readiness);
  if (reviewFailedCount === null) {
    steps.push(step({
      section: "review_queue",
      key: "review_queue_unknown",
      status: "fail",
      message: "Review/failed geocode queue count is unavailable.",
      target: "0 review/failed geocodes before launch",
      action: "Run npm run db:geocode-review and db:geocode-readiness.",
    }));
  } else if (reviewFailedCount === 0) {
    steps.push(step({
      section: "review_queue",
      key: "review_queue_clear",
      status: "pass",
      message: "No review/failed geocodes remain.",
      actual: 0,
    }));
  } else {
    steps.push(step({
      section: "review_queue",
      key: "review_queue_not_clear",
      status: "fail",
      message: `${reviewFailedCount.toLocaleString()} review/failed geocode rows remain.`,
      actual: reviewFailedCount,
      target: 0,
      action: "Run npm run db:geocode-review and resolve or hold back those locations.",
    }));
    addUnique(nextCommands, "npm run db:geocode-review");
  }

  const staleCount = getInvariantCount(
    input.readiness,
    "stalePublicCoordinateCount",
    "stalePublicCoordinateCount"
  );
  if (staleCount !== null && staleCount > 0) {
    steps.push(step({
      section: "readiness",
      key: "stale_public_coordinates",
      status: "fail",
      message: `${staleCount.toLocaleString()} public pins are stale and need re-verification.`,
      actual: staleCount,
      target: 0,
      action: "Re-verify stale pins before public launch.",
    }));
  }

  const lowScoreCount = getInvariantCount(
    input.readiness,
    "lowScorePublicPinCount",
    "lowScorePublicPinCount"
  );
  if (lowScoreCount !== null && lowScoreCount > 0) {
    steps.push(step({
      section: "readiness",
      key: "low_score_public_pins",
      status: "fail",
      message: `${lowScoreCount.toLocaleString()} public pins are below the configured score floor.`,
      actual: lowScoreCount,
      target: 0,
      action: "Review or hold back low-score public pins.",
    }));
  }

  if (input.batchSimulation) {
    const batch = input.batchSimulation;
    steps.push(step({
      section: "batch_simulation",
      key: "selected_batch_size",
      status: "info",
      message: `${batch.selectedRows.toLocaleString()} rows and ${batch.selectedUniqueQueries.toLocaleString()} unique queries selected for the next batch.`,
      actual: batch.selectedUniqueQueries,
      target: `<=${getBatchUniqueApplyThreshold(providerForSafety)} unique queries`,
    }));

    const safetyStop = getGeocodeApplySafetyStop({
      apply: true,
      provider: providerForSafety,
      providerEnabled,
      publicMapEnabled,
      selectedUniqueQueries: batch.selectedUniqueQueries,
      allowLargeBatch: false,
      allowPublicMapApply: false,
    });
    if (safetyStop) {
      steps.push(step({
        section: "batch_simulation",
        key: "batch_apply_safety",
        status: "fail",
        message: safetyStop.message,
        actual: safetyStop.stoppedReason,
        target: "apply safety permits the next batch",
        action: "Fix the environment or reduce the batch before running --apply.",
      }));
    } else {
      steps.push(step({
        section: "batch_simulation",
        key: "batch_apply_safety",
        status: "pass",
        message: "Next batch is inside apply safety limits.",
        actual: batch.selectedUniqueQueries,
      }));
    }
  } else {
    steps.push(step({
      section: "batch_simulation",
      key: "batch_simulation_missing",
      status: "fail",
      message: "Next geocode batch simulation is unavailable.",
      target: "read-only batch simulation from live database",
      action: "Run this command with DATABASE_URL configured.",
    }));
  }

  const blockers = steps.filter((item) => item.status === "fail");
  const warnings = steps.filter((item) => item.status === "warn");
  if (blockers.length === 0) {
    addUnique(nextCommands, "npm run db:geocode-readiness");
    addUnique(nextCommands, "Enable PUBLIC_MAP_ENABLED=true and NEXT_PUBLIC_MAP_ENABLED=true in staging first.");
    addUnique(nextCommands, "Run map-enabled browser smoke and production build before flipping production flags.");
  }

  return {
    verdict: blockers.length === 0 ? "GO" : "NO_GO",
    generatedAt: input.generatedAt || new Date().toISOString(),
    blockers,
    warnings,
    steps,
    nextCommands,
  };
}
