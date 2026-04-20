import test from "node:test";
import assert from "node:assert/strict";

import { buildBoatDetailFacts, buildBoatDisplayTitle } from "../../src/lib/boats/detail-display";

test("boat detail title keeps year first when present", () => {
  assert.equal(
    buildBoatDisplayTitle({ year: 2006, make: "Sunreef", model: "Catamaran Flybridge" }),
    "2006 Sunreef Catamaran Flybridge"
  );
});

test("boat detail title avoids null or zero year artifacts", () => {
  assert.equal(
    buildBoatDisplayTitle({ year: null, make: "Lagoon", model: "450" }),
    "Lagoon 450"
  );
  assert.equal(
    buildBoatDisplayTitle({ year: 0, make: "Lagoon", model: "450" }),
    "Lagoon 450"
  );
  assert.equal(
    buildBoatDisplayTitle({ year: "0", make: "Lagoon", model: "450" }),
    "Lagoon 450"
  );
});

test("boat detail facts label critical buyer fields above the fold", () => {
  assert.deepEqual(
    buildBoatDetailFacts({
      year: 2006,
      locationText: "Bali, Indonesia",
      specs: { loa: 62 },
      labels: { year: "Year", location: "Location", loa: "LOA" },
    }),
    [
      { key: "year", label: "Year", value: "2006" },
      { key: "location", label: "Location", value: "Bali, Indonesia" },
      { key: "loa", label: "LOA", value: "62 ft" },
    ]
  );
});

test("boat detail facts omit missing values and normalize imported LOA strings", () => {
  assert.deepEqual(
    buildBoatDetailFacts({
      year: null,
      locationText: "  Penang, Malaysia  ",
      specs: { loa: "45.5" },
      labels: { year: "Year", location: "Location", loa: "LOA" },
    }),
    [
      { key: "location", label: "Location", value: "Penang, Malaysia" },
      { key: "loa", label: "LOA", value: "45.5 ft" },
    ]
  );
});
