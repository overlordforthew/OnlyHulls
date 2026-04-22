import test from "node:test";
import assert from "node:assert/strict";

import {
  COUNTRY_CENTROIDS,
  getCountryCentroid,
} from "../../src/lib/locations/country-centroids";

test("getCountryCentroid resolves canonical codes", () => {
  const us = getCountryCentroid("us");
  assert.ok(us);
  assert.equal(us?.name, "United States");
  assert.equal(typeof us?.lat, "number");
  assert.equal(typeof us?.lng, "number");

  const gb = getCountryCentroid("gb");
  assert.equal(gb?.name, "United Kingdom");

  const gr = getCountryCentroid("gr");
  assert.equal(gr?.name, "Greece");
});

test("getCountryCentroid is case-insensitive and trims whitespace", () => {
  assert.equal(getCountryCentroid("US")?.name, "United States");
  assert.equal(getCountryCentroid(" us ")?.name, "United States");
  assert.equal(getCountryCentroid("Us")?.name, "United States");
});

test("getCountryCentroid returns null for missing or unknown codes", () => {
  assert.equal(getCountryCentroid(null), null);
  assert.equal(getCountryCentroid(undefined), null);
  assert.equal(getCountryCentroid(""), null);
  assert.equal(getCountryCentroid("xx"), null);
  assert.equal(getCountryCentroid("united states"), null);
});

test("every centroid has coords in valid ranges", () => {
  for (const [code, entry] of Object.entries(COUNTRY_CENTROIDS)) {
    assert.ok(
      entry.lat >= -90 && entry.lat <= 90,
      `${code} lat ${entry.lat} out of range`
    );
    assert.ok(
      entry.lng >= -180 && entry.lng <= 180,
      `${code} lng ${entry.lng} out of range`
    );
    assert.equal(typeof entry.name, "string");
    assert.ok(entry.name.length > 0, `${code} has empty name`);
  }
});

test("centroid keys are lowercase two-letter ISO codes", () => {
  for (const code of Object.keys(COUNTRY_CENTROIDS)) {
    assert.equal(code, code.toLowerCase(), `${code} should be lowercase`);
    assert.equal(code.length, 2, `${code} should be 2 chars`);
  }
});

test("covers countries in the existing COUNTRY_CODES map", () => {
  // Every ISO code mapped from the geocoding.ts COUNTRY_CODES table
  // must have a centroid, otherwise the country short-circuit in
  // buildGeocodeQuery will fail to produce coords for a boat whose
  // location_country is one of those values.
  const required = [
    "ag", "aw", "au", "bs", "bz", "bm", "vg", "ca", "co", "hr",
    "cy", "dk", "do", "fj", "fr", "pf", "de", "gi", "gr", "gd",
    "gp", "gt", "gg", "hn", "hk", "hu", "id", "ie", "it", "je",
    "lv", "my", "mt", "mq", "mx", "mc", "me", "nl", "nz", "no",
    "pa", "ph", "pl", "pt", "pr", "mf", "lc", "sc", "sx", "si",
    "za", "es", "se", "tw", "th", "tn", "tr", "gb", "us", "vi",
  ];
  for (const code of required) {
    assert.ok(
      COUNTRY_CENTROIDS[code],
      `${code} missing from COUNTRY_CENTROIDS but present in geocoding COUNTRY_CODES`
    );
  }
});
