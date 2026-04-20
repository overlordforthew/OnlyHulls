import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCountryHintMismatchGroups,
  getLocationMapReadinessBlockers,
  isLocationMapDataReady,
} from "../../src/lib/locations/location-readiness";

test("country hint mismatch groups only conflicting stored countries", () => {
  const groups = buildCountryHintMismatchGroups([
    { locationText: "Fort Lauderdale, FL", storedCountry: "United States" },
    { locationText: "Fort Lauderdale, FL", storedCountry: "Greece" },
    { locationText: " fort lauderdale, fl ", storedCountry: "Greece" },
    { locationText: "Somewhere vague", storedCountry: "Greece" },
    { locationText: "Jersey City, NJ", storedCountry: null },
  ]);

  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0], {
    locationText: "Fort Lauderdale, FL",
    storedCountry: "Greece",
    expectedCountry: "United States",
    expectedRegion: "Florida",
    matchedTerm: "fl",
    count: 2,
  });
  assert.equal(groups[1].locationText, "Jersey City, NJ");
  assert.equal(groups[1].storedCountry, null);
  assert.equal(groups[1].expectedCountry, "United States");
  assert.equal(groups[1].count, 1);
});

test("location map readiness requires data quality and provider readiness", () => {
  const ready = {
    marketTagRate: 96,
    cityOrBetterRate: 86,
    mappableCoordinateRate: 86,
    countryHintMismatchCount: 0,
    reviewFailedCount: 0,
    geocodingEnabled: true,
  };

  assert.equal(isLocationMapDataReady(ready), true);
  assert.deepEqual(getLocationMapReadinessBlockers(ready), []);

  assert.equal(
    isLocationMapDataReady({ ...ready, countryHintMismatchCount: 1 }),
    false
  );
  assert.equal(
    isLocationMapDataReady({ ...ready, reviewFailedCount: 1 }),
    false
  );
  assert.equal(
    isLocationMapDataReady({ ...ready, geocodingEnabled: false }),
    false
  );
  assert.match(
    getLocationMapReadinessBlockers({ ...ready, mappableCoordinateRate: 80 }).join(", "),
    /public map pins below 85%/
  );
});
