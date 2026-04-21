import assert from "node:assert/strict";
import { test } from "node:test";

import { shouldRetryChangedReviewGeocode } from "../../src/lib/locations/geocode-review-retry";

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
