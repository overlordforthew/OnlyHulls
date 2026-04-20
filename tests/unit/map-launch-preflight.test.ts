import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildMapLaunchPreflight,
  type MapLaunchBatchSimulation,
  type MapLaunchInventorySnapshot,
  type MapLaunchPinAuditInput,
} from "../../src/lib/locations/map-launch-preflight";
import type { MapReadinessSnapshot } from "../../src/lib/locations/map-readiness";

const readySnapshot: MapReadinessSnapshot = {
  generatedAt: "2026-04-20T00:00:00.000Z",
  launchReady: true,
  publicMapEnabled: false,
  geocoding: {
    enabled: true,
    provider: "opencage",
  },
  thresholds: {
    minMarketTaggedPct: 95,
    minCityOrBetterPct: 85,
    minPublicPinPct: 85,
    minNonApproxPublicPinPct: 50,
    maxReviewFailedPct: 0,
    stalePinDays: 90,
    minPinScore: 0.6,
  },
  blockers: [],
  summary: {
    activeVisibleCount: 100,
    withLocationTextCount: 98,
    withMarketSlugsCount: 98,
    cityOrBetterCount: 92,
    publicPinCount: 88,
    nonApproxPublicPinCount: 70,
    rawCoordinateCount: 95,
    cityCoordinateCount: 7,
    regionalCoordinateCount: 0,
    approximatePublicPinCount: 18,
    pendingCount: 3,
    geocodedCount: 95,
    reviewCount: 0,
    failedCount: 0,
    skippedCount: 0,
    invalidPublicCoordinateCount: 0,
    publicMissingMetadataCount: 0,
    stalePublicCoordinateCount: 0,
    lowScorePublicPinCount: 0,
  },
  rates: {
    locationTextPct: 98,
    marketTaggedPct: 98,
    cityOrBetterPct: 92,
    publicPinPct: 88,
    nonApproxPublicPinPct: 70,
    reviewFailedPct: 0,
    stalePublicPinPct: 0,
    lowScorePublicPinPct: 0,
  },
  splits: {
    precision: [],
    status: [],
    provider: [],
  },
  diagnostics: {
    launchWarning: false,
    warnings: [],
    scoreBands: [],
    ageBands: [],
    sourceKinds: [],
    confidence: [],
  },
};

const safeBatch: MapLaunchBatchSimulation = {
  limit: 100,
  totalCandidates: 25,
  geocodableCandidates: 20,
  selectedRows: 20,
  selectedUniqueQueries: 18,
};

const inventorySnapshot: MapLaunchInventorySnapshot = {
  activeCount: 12000,
  qualityVisibleBeforeFreshnessCount: 11000,
  qualityVisibleBeforePolicyCount: 4300,
  visibleCount: 4000,
  qualitySuppressedCount: 1000,
  freshnessSuppressedCount: 6700,
  policySuppressedCount: 300,
  hiddenCount: 8000,
};

const launchPinAuditReport = {
  schemaVersion: 1 as const,
  generatedAt: "2026-04-20T00:00:00.000Z",
  reviewedAt: "2026-04-19T00:00:00.000Z",
  reviewedBy: "ops",
  sampleSeed: "launch-review",
  sampleHash: "abc123",
  sampleLimit: 25,
  sampleSize: 25,
  acceptedCount: 25,
  rejectedCount: 0,
  precision: "all" as const,
  backupTable: null,
};

const launchPinAudit: MapLaunchPinAuditInput = {
  currentSampleHash: "abc123",
  report: launchPinAuditReport,
};

const launchEnv = {
  LOCATION_GEOCODING_PROVIDER: "opencage",
  LOCATION_GEOCODING_API_KEY: "opencage_live_key",
  LOCATION_GEOCODING_EMAIL: "ops@onlyhulls.com",
  PUBLIC_MAP_ENABLED: "false",
  NEXT_PUBLIC_MAP_ENABLED: "false",
  MAPTILER_KEY: "maptiler_live_key",
  NEXT_PUBLIC_MAP_STYLE_URL: "https://api.maptiler.com/maps/streets-v2/style.json?key=maptiler_live_key",
  NEXT_PUBLIC_MAP_ATTRIBUTION: "MapTiler OpenStreetMap contributors",
  NEXT_PUBLIC_MAP_RESOURCE_ORIGINS: "https://api.maptiler.com,https://tiles.maptiler.com",
};

const backfillEnv = {
  LOCATION_GEOCODING_PROVIDER: "opencage",
  LOCATION_GEOCODING_API_KEY: "opencage_live_key",
  LOCATION_GEOCODING_EMAIL: "ops@onlyhulls.com",
  PUBLIC_MAP_ENABLED: "false",
  NEXT_PUBLIC_MAP_ENABLED: "false",
};

test("map launch preflight blocks the default unconfigured environment", () => {
  const result = buildMapLaunchPreflight({
    env: {
      PUBLIC_MAP_ENABLED: "false",
      NEXT_PUBLIC_MAP_ENABLED: "false",
      LOCATION_GEOCODING_PROVIDER: "disabled",
    },
    readiness: null,
    batchSimulation: null,
    generatedAt: "2026-04-20T00:00:00.000Z",
  });

  assert.equal(result.verdict, "NO_GO");
  assert(result.blockers.some((step) => step.key === "commercial_geocoder_not_configured"));
  assert(result.blockers.some((step) => step.key === "map_style_url_missing"));
  assert(result.blockers.some((step) => step.key === "readiness_missing"));
  assert(result.blockers.some((step) => step.key === "batch_simulation_missing"));
});

test("map backfill preflight allows safe OpenCage batches before tile-provider launch config", () => {
  const notLaunchReadySnapshot: MapReadinessSnapshot = {
    ...readySnapshot,
    launchReady: false,
    blockers: ["public pins below 85%", "review/failed geocodes above 0%"],
    summary: {
      ...readySnapshot.summary,
      publicPinCount: 40,
      reviewCount: 3,
      failedCount: 1,
    },
  };
  const result = buildMapLaunchPreflight({
    env: backfillEnv,
    phase: "backfill",
    readiness: notLaunchReadySnapshot,
    batchSimulation: safeBatch,
  });

  assert.equal(result.verdict, "GO");
  assert.equal(result.phase, "backfill");
  assert.equal(result.blockers.length, 0);
  assert(result.warnings.some((step) => step.key === "readiness_available_with_backfill_blockers"));
  assert(result.warnings.some((step) => step.key === "review_queue_not_clear"));
  assert(result.steps.some((step) => step.key === "map_tile_env_deferred" && step.status === "info"));
  assert(result.nextCommands.some((command) => command.includes("db:geocode-locations")));
  assert(result.nextCommands.some((command) => command.includes("--phase=launch --ping")));
});

test("map backfill preflight still requires OpenCage before paid coordinate work", () => {
  const result = buildMapLaunchPreflight({
    env: {
      ...backfillEnv,
      LOCATION_GEOCODING_PROVIDER: "disabled",
      LOCATION_GEOCODING_API_KEY: "",
    },
    phase: "backfill",
    readiness: readySnapshot,
    batchSimulation: safeBatch,
  });

  assert.equal(result.verdict, "NO_GO");
  assert(result.blockers.some((step) => step.key === "commercial_geocoder_not_configured"));
});

test("map backfill preflight blocks oversized paid-provider batch simulations", () => {
  const result = buildMapLaunchPreflight({
    env: backfillEnv,
    phase: "backfill",
    readiness: readySnapshot,
    batchSimulation: {
      ...safeBatch,
      selectedRows: 2500,
      selectedUniqueQueries: 2001,
    },
  });

  assert.equal(result.verdict, "NO_GO");
  assert.equal(result.blockers.find((step) => step.key === "batch_apply_safety")?.actual, "selected_unique_queries_2001_exceeds_2000");
});

test("map launch preflight returns GO only when env, readiness, review queue, and batch safety pass", () => {
  const result = buildMapLaunchPreflight({
    env: launchEnv,
    inventory: inventorySnapshot,
    pinAudit: launchPinAudit,
    readiness: readySnapshot,
    batchSimulation: safeBatch,
    generatedAt: "2026-04-20T00:00:00.000Z",
  });

  assert.equal(result.verdict, "GO");
  assert.equal(result.blockers.length, 0);
  assert(result.steps.some((step) => step.key === "pin_audit_review_passed" && step.status === "pass"));
  assert(result.steps.some((step) => step.key === "inventory_waterfall_available" && step.status === "pass"));
  assert(result.warnings.some((step) => step.key === "inventory_freshness_suppression_present"));
  assert(result.steps.some((step) => step.key === "batch_apply_safety" && step.status === "pass"));
  assert(result.nextCommands.some((command) => command.includes("staging")));
  assert.equal(JSON.stringify(result).includes("maptiler_live_key"), false);
  assert(JSON.stringify(result).includes("key=redacted"));
});

test("map launch preflight blocks launch when inventory waterfall is missing", () => {
  const result = buildMapLaunchPreflight({
    env: launchEnv,
    pinAudit: launchPinAudit,
    readiness: readySnapshot,
    batchSimulation: safeBatch,
    generatedAt: "2026-04-20T00:00:00.000Z",
  });

  assert.equal(result.verdict, "NO_GO");
  assert(result.blockers.some((step) => step.key === "inventory_waterfall_missing"));
  assert(result.nextCommands.some((command) => command.includes("db:source-health")));
});

test("map launch preflight blocks empty or collapsed visible inventory", () => {
  const empty = buildMapLaunchPreflight({
    env: launchEnv,
    inventory: {
      ...inventorySnapshot,
      visibleCount: 0,
      freshnessSuppressedCount: 11000,
      policySuppressedCount: 0,
    },
    pinAudit: launchPinAudit,
    readiness: readySnapshot,
    batchSimulation: safeBatch,
    generatedAt: "2026-04-20T00:00:00.000Z",
  });

  assert.equal(empty.verdict, "NO_GO");
  assert(empty.blockers.some((step) => step.key === "inventory_visible_empty"));

  const collapsed = buildMapLaunchPreflight({
    env: launchEnv,
    inventory: {
      ...inventorySnapshot,
      visibleCount: 1900,
      freshnessSuppressedCount: 8800,
    },
    pinAudit: launchPinAudit,
    readiness: readySnapshot,
    batchSimulation: safeBatch,
    generatedAt: "2026-04-20T00:00:00.000Z",
  });

  assert.equal(collapsed.verdict, "NO_GO");
  assert(collapsed.blockers.some((step) => step.key === "inventory_visible_rate_collapsed"));
});

test("map launch preflight remains the default strict phase", () => {
  const result = buildMapLaunchPreflight({
    env: backfillEnv,
    readiness: readySnapshot,
    batchSimulation: safeBatch,
  });

  assert.equal(result.phase, "launch");
  assert.equal(result.verdict, "NO_GO");
  assert(result.blockers.some((step) => step.key === "map_style_url_missing"));
});

test("map launch preflight requires reviewed pin audit evidence", () => {
  const result = buildMapLaunchPreflight({
    env: launchEnv,
    readiness: readySnapshot,
    batchSimulation: safeBatch,
    generatedAt: "2026-04-20T00:00:00.000Z",
  });

  assert.equal(result.verdict, "NO_GO");
  assert(result.blockers.some((step) => step.key === "pin_audit_report_missing"));
  assert(result.nextCommands.some((command) => command.includes("--attest")));
  assert(result.nextCommands.some((command) => command.includes("--pin-audit-report")));
});

test("map launch preflight blocks stale rejected or mismatched pin audit reports", () => {
  const stale = buildMapLaunchPreflight({
    env: launchEnv,
    readiness: readySnapshot,
    batchSimulation: safeBatch,
    generatedAt: "2026-04-20T00:00:00.000Z",
    pinAudit: {
      ...launchPinAudit,
      report: {
        ...launchPinAuditReport,
        reviewedAt: "2026-04-01T00:00:00.000Z",
      },
    },
  });
  assert(stale.blockers.some((step) => step.key === "pin_audit_stale"));

  const rejected = buildMapLaunchPreflight({
    env: launchEnv,
    readiness: readySnapshot,
    batchSimulation: safeBatch,
    generatedAt: "2026-04-20T00:00:00.000Z",
    pinAudit: {
      ...launchPinAudit,
      report: {
        ...launchPinAuditReport,
        acceptedCount: 24,
        rejectedCount: 1,
      },
    },
  });
  assert(rejected.blockers.some((step) => step.key === "pin_audit_rejections_present"));

  const mismatched = buildMapLaunchPreflight({
    env: launchEnv,
    readiness: readySnapshot,
    batchSimulation: safeBatch,
    generatedAt: "2026-04-20T00:00:00.000Z",
    pinAudit: {
      ...launchPinAudit,
      currentSampleHash: "current",
    },
  });
  assert(mismatched.blockers.some((step) => step.key === "pin_audit_hash_mismatch"));
});

test("map launch preflight blocks incomplete pin audit reports", () => {
  const small = buildMapLaunchPreflight({
    env: launchEnv,
    readiness: readySnapshot,
    batchSimulation: safeBatch,
    generatedAt: "2026-04-20T00:00:00.000Z",
    pinAudit: {
      currentSampleHash: "abc123",
      report: {
        ...launchPinAuditReport,
        acceptedCount: 10,
        sampleSize: 10,
      },
    },
  });
  assert(small.blockers.some((step) => step.key === "pin_audit_sample_too_small"));

  const emptyReviewer = buildMapLaunchPreflight({
    env: launchEnv,
    readiness: readySnapshot,
    batchSimulation: safeBatch,
    generatedAt: "2026-04-20T00:00:00.000Z",
    pinAudit: {
      ...launchPinAudit,
      report: {
        ...launchPinAuditReport,
        reviewedBy: "",
      },
    },
  });
  assert(emptyReviewer.blockers.some((step) => step.key === "pin_audit_reviewer_missing"));
});

test("map backfill preflight fails closed if public map flags are already enabled", () => {
  const result = buildMapLaunchPreflight({
    env: {
      ...backfillEnv,
      PUBLIC_MAP_ENABLED: "true",
      NEXT_PUBLIC_MAP_ENABLED: "true",
    },
    phase: "backfill",
    readiness: readySnapshot,
    batchSimulation: safeBatch,
  });

  assert.equal(result.verdict, "NO_GO");
  assert(result.blockers.some((step) => step.key === "public_map_flags_enabled_during_backfill"));
});

test("map launch preflight rejects validation-only Nominatim for commercial launch", () => {
  const result = buildMapLaunchPreflight({
    env: {
      ...launchEnv,
      LOCATION_GEOCODING_PROVIDER: "nominatim",
      LOCATION_GEOCODING_USER_AGENT: "OnlyHulls/1.0 (ops@onlyhulls.com)",
    },
    readiness: readySnapshot,
    batchSimulation: safeBatch,
  });

  assert.equal(result.verdict, "NO_GO");
  assert.match(
    result.blockers.find((step) => step.key === "commercial_geocoder_not_configured")?.message || "",
    /validation-only/
  );
});

test("map launch preflight blocks stale or low-score public pins even if aggregate readiness is true", () => {
  const staleSnapshot: MapReadinessSnapshot = {
    ...readySnapshot,
    summary: {
      ...readySnapshot.summary,
      stalePublicCoordinateCount: 2,
      lowScorePublicPinCount: 1,
    },
  };

  const result = buildMapLaunchPreflight({
    env: launchEnv,
    readiness: staleSnapshot,
    batchSimulation: safeBatch,
  });

  assert.equal(result.verdict, "NO_GO");
  assert(result.blockers.some((step) => step.key === "stale_public_coordinates"));
  assert(result.blockers.some((step) => step.key === "low_score_public_pins"));
});

test("map launch preflight blocks oversized paid-provider batch simulations", () => {
  const result = buildMapLaunchPreflight({
    env: launchEnv,
    readiness: readySnapshot,
    batchSimulation: {
      ...safeBatch,
      selectedRows: 2500,
      selectedUniqueQueries: 2001,
    },
  });

  assert.equal(result.verdict, "NO_GO");
  assert.equal(result.blockers.find((step) => step.key === "batch_apply_safety")?.actual, "selected_unique_queries_2001_exceeds_2000");
});

test("map launch preflight treats failed optional network pings as launch blockers", () => {
  const result = buildMapLaunchPreflight({
    env: launchEnv,
    readiness: readySnapshot,
    batchSimulation: safeBatch,
    externalSteps: [
      {
        section: "network",
        key: "map_style_ping",
        status: "fail",
        message: "Map style URL responded with HTTP 403.",
        target: "HTTP 2xx",
      },
    ],
  });

  assert.equal(result.verdict, "NO_GO");
  assert(result.blockers.some((step) => step.section === "network" && step.key === "map_style_ping"));
});
