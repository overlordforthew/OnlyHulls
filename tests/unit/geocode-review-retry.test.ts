import assert from "node:assert/strict";
import { test } from "node:test";

import {
  shouldRetryChangedGeocodedNonPublicGeocode,
  shouldRetryChangedReviewGeocode,
} from "../../src/lib/locations/geocode-review-retry";

test("changed review retry excludes pending and unchanged geocode rows", () => {
  assert.equal(
    shouldRetryChangedReviewGeocode({
      status: "pending",
      previousQueryText: null,
      currentQueryKey: "port louis marina grenada",
    }),
    false
  );
  assert.equal(
    shouldRetryChangedReviewGeocode({
      status: "geocoded",
      previousQueryText: "Port Louis Marina, Grenada",
      currentQueryKey: "port louis marina grenada",
    }),
    false
  );
  assert.equal(
    shouldRetryChangedReviewGeocode({
      status: "review",
      previousQueryText: "Port Louis Marina, Grenada",
      currentQueryKey: "port louis marina grenada",
    }),
    false
  );
  assert.equal(
    shouldRetryChangedReviewGeocode({
      status: "failed",
      previousQueryText: "",
      currentQueryKey: "port louis marina grenada",
    }),
    false
  );
});

test("changed review retry includes only review or failed rows with changed query keys", () => {
  assert.equal(
    shouldRetryChangedReviewGeocode({
      status: "review",
      previousQueryText: "Clarke's Court Boatyard & Marina, Grenada",
      currentQueryKey: "clarkes court boatyard and marina grenada",
    }),
    true
  );
  assert.equal(
    shouldRetryChangedReviewGeocode({
      status: "failed",
      previousQueryText: "Marsh Harbour, Conch Inn Marina, Bahamas",
      currentQueryKey: "conch inn marina marsh harbour bahamas",
    }),
    true
  );
});

test("changed geocoded retry requires changed non-public verified-alias rows", () => {
  assert.equal(
    shouldRetryChangedGeocodedNonPublicGeocode({
      status: "geocoded",
      previousPrecision: "city",
      previousQueryText: "Yachtclub Seget (Marina Baotic), Trogir, Croatia",
      currentQueryKey: "marina baotic seget donji croatia",
      verifiedAliasInLocationText: true,
      verifiedAliasInQueryText: true,
    }),
    true
  );
  assert.equal(
    shouldRetryChangedGeocodedNonPublicGeocode({
      status: "geocoded",
      previousPrecision: "city",
      previousQueryText: "Marina Baotic, Seget Donji, Croatia",
      currentQueryKey: "marina baotic seget donji croatia",
      verifiedAliasInLocationText: true,
      verifiedAliasInQueryText: true,
    }),
    false,
    "unchanged city geocodes must not retry"
  );
  assert.equal(
    shouldRetryChangedGeocodedNonPublicGeocode({
      status: "geocoded",
      previousPrecision: "marina",
      previousQueryText: "Yachtclub Seget (Marina Baotic), Trogir, Croatia",
      currentQueryKey: "marina baotic seget donji croatia",
      verifiedAliasInLocationText: true,
      verifiedAliasInQueryText: true,
    }),
    false,
    "existing public-grade pins must not retry through this lane"
  );
  assert.equal(
    shouldRetryChangedGeocodedNonPublicGeocode({
      status: "geocoded",
      previousPrecision: "city",
      previousQueryText: "Yachtclub Seget (Marina Baotic), Trogir, Croatia",
      currentQueryKey: "marina baotic seget donji croatia",
      verifiedAliasInLocationText: true,
      verifiedAliasInQueryText: false,
    }),
    false,
    "verified alias must be present in the recomputed query"
  );
  assert.equal(
    shouldRetryChangedGeocodedNonPublicGeocode({
      status: "review",
      previousPrecision: "city",
      previousQueryText: "Yachtclub Seget (Marina Baotic), Trogir, Croatia",
      currentQueryKey: "marina baotic seget donji croatia",
      verifiedAliasInLocationText: true,
      verifiedAliasInQueryText: true,
    }),
    false,
    "review rows stay in the changed-review lane"
  );
});
