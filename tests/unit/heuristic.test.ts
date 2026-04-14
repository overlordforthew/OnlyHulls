import test from "node:test";
import assert from "node:assert/strict";

import {
  boatMatchesDesiredTypes,
  inferBoatTypes,
  type BoatForMatching,
} from "../../src/lib/matching/heuristic";

const dufour: BoatForMatching = {
  id: "dufour-390",
  make: "Dufour",
  model: "390 Grand Large",
  asking_price: 179000,
  asking_price_usd: 179000,
  currency: "USD",
  year: 2023,
  location_text: "Tortola",
  specs: {
    loa: 39.2,
    rig_type: "masthead sloop",
  },
  condition_score: 8,
  character_tags: ["coastal-cruiser", "liveaboard-ready", "family-friendly"],
  ai_summary: "A modern cruising monohull with a sloop rig and family-friendly layout.",
};

test("inferBoatTypes treats a cruising sloop as monohull by default", () => {
  assert.deepEqual(inferBoatTypes(dufour), ["monohull"]);
});

test("boatMatchesDesiredTypes rejects monohulls when buyer only wants catamarans", () => {
  const result = boatMatchesDesiredTypes(
    { boat_type_prefs: { types: ["catamaran"] } },
    dufour
  );

  assert.equal(result, false);
});
