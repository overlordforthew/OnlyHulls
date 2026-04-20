import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildMapReadinessSnapshot,
  getMapReadinessThresholds,
} from "../../src/lib/locations/map-readiness";
import { buildAdminMapReadinessResponse } from "../../src/app/api/admin/map-readiness/route";

test("map readiness snapshot computes exact aggregate counts and launch blockers", () => {
  const snapshot = buildMapReadinessSnapshot({
    generatedAt: "2026-04-20T00:00:00.000Z",
    geocodingEnabled: true,
    geocodingProvider: "opencage",
    publicMapEnabled: false,
    thresholds: {
      minMarketTaggedPct: 90,
      minCityOrBetterPct: 80,
      minPublicPinPct: 75,
      minNonApproxPublicPinPct: 50,
      maxReviewFailedPct: 5,
      stalePinDays: 90,
      minPinScore: 0.6,
    },
    summary: {
      active_visible_count: "100",
      with_location_text_count: "98",
      with_market_slugs_count: "92",
      city_or_better_count: "84",
      public_pin_count: "78",
      non_approx_public_pin_count: "60",
      raw_coordinate_count: "88",
      city_coordinate_count: "10",
      regional_coordinate_count: "2",
      approximate_public_pin_count: "18",
      pending_count: "12",
      geocoded_count: "80",
      review_count: "2",
      failed_count: "1",
      skipped_count: "5",
      invalid_public_coordinate_count: "0",
      public_missing_metadata_count: "0",
      stale_public_coordinate_count: "4",
      low_score_public_pin_count: "3",
    },
    precisionRows: [
      { label: "marina", count: "50" },
      { label: "city", count: "10" },
    ],
    statusRows: [
      { label: "geocoded", count: "80" },
      { label: "pending", count: "12" },
    ],
    providerRows: [{ label: "opencage", count: "88" }],
    scoreBandRows: [
      { label: "meets_score", count: "75" },
      { label: "below_min_score", count: "3" },
    ],
    ageBandRows: [
      { label: "fresh", count: "74" },
      { label: "stale", count: "4" },
    ],
    sourceKindRows: [
      { label: "imported", count: "70" },
      { label: "platform", count: "30" },
    ],
    confidenceRows: [
      { label: "exact", count: "20" },
      { label: "city", count: "64" },
    ],
  });

  assert.equal(snapshot.launchReady, true);
  assert.equal(snapshot.summary.publicPinCount, 78);
  assert.equal(snapshot.summary.nonApproxPublicPinCount, 60);
  assert.equal(snapshot.rates.marketTaggedPct, 92);
  assert.equal(snapshot.rates.cityOrBetterPct, 84);
  assert.equal(snapshot.rates.publicPinPct, 78);
  assert.equal(snapshot.rates.nonApproxPublicPinPct, 60);
  assert.equal(snapshot.rates.reviewFailedPct, 3);
  assert.equal(snapshot.rates.stalePublicPinPct, 5.13);
  assert.deepEqual(snapshot.blockers, []);
  assert.deepEqual(snapshot.splits.precision[0], {
    label: "marina",
    count: 50,
    percentOfVisible: 50,
  });
  assert.equal(snapshot.diagnostics.launchWarning, false);
  assert.deepEqual(snapshot.diagnostics.scoreBands[0], {
    label: "meets_score",
    count: 75,
    percentOfVisible: 75,
  });
  assert.deepEqual(snapshot.diagnostics.sourceKinds.map((row) => row.label), ["imported", "platform"]);
});

test("map readiness thresholds handle boundary cases and empty databases", () => {
  const boundaryInput = {
    geocodingEnabled: true,
    geocodingProvider: "opencage",
    publicMapEnabled: false,
    thresholds: {
      minMarketTaggedPct: 95,
      minCityOrBetterPct: 85,
      minPublicPinPct: 85,
      minNonApproxPublicPinPct: 50,
      maxReviewFailedPct: 1,
      stalePinDays: 90,
      minPinScore: 0.6,
    },
    summary: {
      active_visible_count: 100,
      with_market_slugs_count: 95,
      city_or_better_count: 85,
      public_pin_count: 85,
      non_approx_public_pin_count: 50,
      review_count: 1,
      failed_count: 0,
    },
  };
  const atBoundary = buildMapReadinessSnapshot(boundaryInput);
  assert.equal(atBoundary.launchReady, true);

  const justOverMaxReview = buildMapReadinessSnapshot({
    ...boundaryInput,
    summary: {
      active_visible_count: 100,
      with_market_slugs_count: 95,
      city_or_better_count: 85,
      public_pin_count: 85,
      non_approx_public_pin_count: 50,
      review_count: 2,
      failed_count: 0,
    },
  });
  assert.equal(justOverMaxReview.launchReady, false);
  assert.match(justOverMaxReview.blockers.join(" "), /review\/failed/);

  const empty = buildMapReadinessSnapshot({
    geocodingEnabled: true,
    geocodingProvider: "opencage",
    publicMapEnabled: false,
    summary: null,
  });
  assert.equal(empty.launchReady, false);
  assert.equal(empty.rates.publicPinPct, 0);
  assert.match(empty.blockers.join(" "), /no active visible listings/);

  const enabledBeforeReady = buildMapReadinessSnapshot({
    geocodingEnabled: false,
    geocodingProvider: "disabled",
    publicMapEnabled: true,
    summary: {
      active_visible_count: 10,
    },
  });
  assert.equal(enabledBeforeReady.diagnostics.launchWarning, true);
  assert.match(enabledBeforeReady.diagnostics.warnings.join(" "), /Public map is enabled/);
});

test("map readiness env thresholds reject invalid values safely", () => {
  assert.deepEqual(
    getMapReadinessThresholds({
      MAP_READINESS_MIN_MARKET_TAG_PCT: "90",
      MAP_READINESS_MIN_CITY_OR_BETTER_PCT: "-1",
      MAP_READINESS_MIN_PUBLIC_PIN_PCT: "not-a-number",
      MAP_READINESS_MIN_NON_APPROX_PUBLIC_PIN_PCT: "55.5",
      MAP_READINESS_MAX_REVIEW_FAILED_PCT: "101",
      MAP_READINESS_STALE_PIN_DAYS: "45",
      MAP_READINESS_MIN_PIN_SCORE: "0.72",
    }),
    {
      minMarketTaggedPct: 90,
      minCityOrBetterPct: 85,
      minPublicPinPct: 85,
      minNonApproxPublicPinPct: 55.5,
      maxReviewFailedPct: 0,
      stalePinDays: 45,
      minPinScore: 0.72,
    }
  );
});

test("admin map readiness API gates access and does not leak coordinates or ids", async () => {
  const forbidden = await buildAdminMapReadinessResponse(
    async () => {
      throw new Error("Forbidden");
    },
    async () =>
      buildMapReadinessSnapshot({
        geocodingEnabled: true,
        geocodingProvider: "opencage",
        publicMapEnabled: false,
      })
  );
  assert.equal(forbidden.status, 403);

  const ok = await buildAdminMapReadinessResponse(
    async () => null,
    async () =>
      buildMapReadinessSnapshot({
        geocodingEnabled: true,
        geocodingProvider: "opencage",
        publicMapEnabled: false,
        summary: {
          active_visible_count: 1,
          with_market_slugs_count: 1,
          city_or_better_count: 1,
          public_pin_count: 1,
          non_approx_public_pin_count: 1,
        },
      })
  );
  assert.equal(ok.status, 200);
  const payload = await ok.json();
  const seenKeys = new Set<string>();
  const collectKeys = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      seenKeys.add(key);
      collectKeys(child);
    }
  };
  collectKeys(payload);

  for (const forbiddenKey of ["latitude", "longitude", "lat", "lng", "slug", "userId", "boatId", "listingId"]) {
    assert.equal(seenKeys.has(forbiddenKey), false, `${forbiddenKey} should not be exposed`);
  }

  const allowedDiagnosticLabels = new Set([
    "meets_score",
    "below_min_score",
    "missing_score",
    "fresh",
    "aging",
    "stale",
    "missing_geocoded_at",
    "imported",
    "platform",
    "external",
    "exact",
    "city",
    "region",
    "unknown",
    "missing",
  ]);
  for (const group of [
    payload.diagnostics.scoreBands,
    payload.diagnostics.ageBands,
    payload.diagnostics.sourceKinds,
    payload.diagnostics.confidence,
  ]) {
    for (const row of group) {
      assert.equal(allowedDiagnosticLabels.has(row.label), true, `${row.label} is not allowlisted`);
    }
  }
});
