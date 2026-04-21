import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getPublicPinApplyGateStop,
  getPublicPinApplyResult,
  getPublicPinEligibleRate,
  isPublicPinLikelyGeocodeCandidate,
  isPublicPinEligiblePrecision,
  isPublicPinEligibleResult,
  isPublicPinLikelyText,
} from "../../src/lib/locations/geocode-candidate-lanes";
import type { GeocodeResult } from "../../src/lib/locations/geocoding";

test("public pin candidate lane accepts marine-specific location text", () => {
  const accepted = [
    "Jolly Harbour Marina, Antigua",
    "Alimos Marina, Athens, Greece",
    "British Virgin Islands, Hodge's Creek Marina, Caribbean",
    "Yacht Marine Marina Marmaris, Turkey",
    "D-Marin Lefkas Marina, Lefkada, Greece",
    "Marmaris Yacht Marina, Turkey",
    "Marina du Marin, Martinique",
    "Port Pin Rolland, Saint-Mandrier-sur-Mer, France",
    "Port Tino Rossi, Ajaccio, France",
    "Puerto del Rey Marina, Puerto Rico",
    "Darsena di Marina, Italy",
    "Port de Plaisance, Saint Martin",
    "Queensway Quay Marina",
    "Shelter Bay Boatyard",
    "Sag Harbor Yacht Club",
    "Rhodes Shipyard, Greece",
  ];

  for (const value of accepted) {
    assert.equal(isPublicPinLikelyText(value), true, value);
  }
});

test("public pin candidate lane rejects broad city and region-only text", () => {
  const rejected = [
    "Palma De Mallorca, Spain",
    "Athens, Greece",
    "Cartagena, Murcia, Spain",
    "Alicante, Valencian Community",
    "Lefkas, Greece",
    "Punta Gorda, Florida",
    "Canary Islands, Spain",
    "Mediterranean",
    "Luperon Harbour Mooring",
    "Puerto Rico, USA",
    "Porto Cervo, Sardinia",
    "Marmaris Yacht Marine",
    "Port de Marseille, France",
  ];

  for (const value of rejected) {
    assert.equal(isPublicPinLikelyText(value), false, value);
  }
});

test("public pin candidate lane checks both source text and cleaned query text", () => {
  assert.equal(
    isPublicPinLikelyGeocodeCandidate({
      locationText: "Athens, Alimos Marina, Mediterranean",
      queryText: "Alimos Marina, Athens, Greece",
    }),
    true
  );
  assert.equal(
    isPublicPinLikelyGeocodeCandidate({
      locationText: "Athens",
      queryText: "Athens, Greece",
    }),
    false
  );
});

test("public pin candidate lane only promotes exact, street, and marina precision", () => {
  for (const precision of ["exact", "street", "marina"] as const) {
    assert.equal(isPublicPinEligiblePrecision(precision), true, precision);
    assert.equal(isPublicPinEligibleResult({ status: "geocoded", precision }), true, precision);
  }

  for (const precision of ["city", "region", "country", "unknown"] as const) {
    assert.equal(isPublicPinEligiblePrecision(precision), false, precision);
    assert.equal(isPublicPinEligibleResult({ status: "geocoded", precision }), false, precision);
  }

  assert.equal(isPublicPinEligibleResult({ status: "review", precision: "marina" }), false);
  assert.equal(isPublicPinEligibleResult({ status: "failed", precision: "exact" }), false);
});

test("public pin apply result holds back city results even when formatted text says marina", () => {
  const cityResult = {
    status: "geocoded",
    latitude: 25.0207877,
    longitude: -77.2740614,
    precision: "city",
    score: 1,
    placeName: "Palm Cay Marina, Palm Cay, Nassau, Bahamas",
    provider: "opencage",
    error: null,
  } satisfies GeocodeResult;

  assert.deepEqual(getPublicPinApplyResult(cityResult), {
    ...cityResult,
    status: "review",
    latitude: null,
    longitude: null,
    error: "public_pin_ineligible_precision",
  });
});

test("public pin apply result does not rewrite existing review outcomes", () => {
  const reviewResult = {
    status: "review",
    latitude: 19.20561,
    longitude: -69.33685,
    precision: "city",
    score: 0.22,
    placeName: "Samaná, Dominican Republic",
    provider: "opencage",
    error: "low_confidence",
  } satisfies GeocodeResult;

  assert.equal(getPublicPinApplyResult(reviewResult), reviewResult);
});

test("public pin eligibility rate and apply gate block weak batches", () => {
  assert.equal(getPublicPinEligibleRate(10, 25), 0.4);
  assert.equal(getPublicPinEligibleRate(15, 25), 0.6);
  assert.equal(getPublicPinEligibleRate(0, 0), 0);

  assert.deepEqual(
    getPublicPinApplyGateStop({
      apply: true,
      publicPinCandidates: true,
      selectedRows: 25,
      publicPinEligibleRate: 0.4,
    }),
    {
      stoppedReason: "public_pin_eligible_rate_below_threshold",
      message:
        "Public pin apply blocked: eligible precision rate 0.4 is below 0.6. Run a preview/source cleanup before applying.",
    }
  );

  assert.equal(
    getPublicPinApplyGateStop({
      apply: true,
      publicPinCandidates: true,
      selectedRows: 25,
      publicPinEligibleRate: 0.6,
    }),
    null
  );
  assert.equal(
    getPublicPinApplyGateStop({
      apply: false,
      publicPinCandidates: true,
      selectedRows: 25,
      publicPinEligibleRate: 0.4,
    }),
    null
  );
});
