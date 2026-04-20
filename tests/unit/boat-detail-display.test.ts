import test from "node:test";
import assert from "node:assert/strict";

import { buildBoatDisplayTitle } from "../../src/lib/boats/detail-display";

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
});
