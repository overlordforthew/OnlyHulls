import test from "node:test";
import assert from "node:assert/strict";

import {
  getBatchUniqueApplyThreshold,
  getGeocodeApplySafetyStop,
  isEnabledEnvValue,
  NOMINATIM_VALIDATION_UNIQUE_APPLY_THRESHOLD,
  PAID_PROVIDER_UNIQUE_APPLY_THRESHOLD,
} from "../../src/lib/locations/geocode-rollout-safety";

test("geocode apply safety blocks write-runs while the public map is enabled", () => {
  const stop = getGeocodeApplySafetyStop({
    apply: true,
    provider: "opencage",
    providerEnabled: true,
    publicMapEnabled: true,
    selectedUniqueQueries: 10,
    allowLargeBatch: false,
    allowPublicMapApply: false,
  });

  assert.equal(stop?.stoppedReason, "public_map_enabled_without_override");
  assert.match(stop?.message || "", /PUBLIC_MAP_ENABLED=true/);
  assert.match(stop?.message || "", /--allow-public-map-apply/);
});

test("geocode apply safety allows an explicit public-map maintenance override", () => {
  const stop = getGeocodeApplySafetyStop({
    apply: true,
    provider: "opencage",
    providerEnabled: true,
    publicMapEnabled: true,
    selectedUniqueQueries: 10,
    allowLargeBatch: false,
    allowPublicMapApply: true,
  });

  assert.equal(stop, null);
});

test("geocode apply safety keeps public Nominatim to small validation batches", () => {
  assert.equal(getBatchUniqueApplyThreshold("nominatim"), NOMINATIM_VALIDATION_UNIQUE_APPLY_THRESHOLD);
  assert.equal(getBatchUniqueApplyThreshold("opencage"), PAID_PROVIDER_UNIQUE_APPLY_THRESHOLD);

  const stop = getGeocodeApplySafetyStop({
    apply: true,
    provider: "nominatim",
    providerEnabled: true,
    publicMapEnabled: false,
    selectedUniqueQueries: 51,
    allowLargeBatch: false,
    allowPublicMapApply: false,
  });

  assert.equal(stop?.stoppedReason, "selected_unique_queries_51_exceeds_50");
  assert.match(stop?.message || "", /validation ceiling/);
  assert.match(stop?.message || "", /opencage/);
});

test("geocode apply safety ignores dry-runs and parses enabled env values strictly", () => {
  assert.equal(isEnabledEnvValue("true"), true);
  assert.equal(isEnabledEnvValue(" TRUE "), true);
  assert.equal(isEnabledEnvValue("1"), false);
  assert.equal(
    getGeocodeApplySafetyStop({
      apply: false,
      provider: "disabled",
      providerEnabled: false,
      publicMapEnabled: true,
      selectedUniqueQueries: 999,
      allowLargeBatch: false,
      allowPublicMapApply: false,
    }),
    null
  );
});
