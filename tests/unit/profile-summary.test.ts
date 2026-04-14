import test from "node:test";
import assert from "node:assert/strict";

import { buildBuyerProfileSummary } from "../../src/lib/matching/profile-summary";

test("builds a concise buyer profile summary for matches", () => {
  const summary = buildBuyerProfileSummary({
    use_case: ["cruising", "liveaboard"],
    budget_range: {
      min: 150000,
      max: 300000,
      currency: "USD",
    },
    boat_type_prefs: {
      types: ["catamaran"],
      rig_prefs: [],
    },
    spec_preferences: {
      loa_min: 38,
      loa_max: 45,
      year_min: 2005,
    },
    location_prefs: {
      home_port: "Fort Lauderdale, FL",
      regions: ["Caribbean", "US East Coast", "Bahamas"],
    },
    timeline: "3mo",
  });

  assert.deepEqual(summary.items, [
    { label: "Mission", value: "Cruising, Liveaboard" },
    { label: "Boat type", value: "Catamaran" },
    { label: "Budget", value: "$150,000 to $300,000" },
    { label: "Size and year", value: "38-45 ft / 2005+" },
    { label: "Sailing area", value: "Caribbean, US East Coast +1 more" },
    { label: "Timing", value: "Buying in 3 months" },
  ]);
});

test("falls back cleanly when the buyer has broad preferences", () => {
  const summary = buildBuyerProfileSummary({
    use_case: [],
    budget_range: {
      min: 0,
      max: 25000,
      currency: "USD",
    },
    boat_type_prefs: {
      types: [],
      rig_prefs: [],
    },
    spec_preferences: {},
    location_prefs: {
      home_port: "Annapolis, MD",
      regions: [],
    },
    timeline: "browsing",
  });

  assert.deepEqual(summary.items, [
    { label: "Boat type", value: "All boat types" },
    { label: "Budget", value: "Under $25,000" },
    { label: "Sailing area", value: "Annapolis, MD" },
    { label: "Timing", value: "Just browsing" },
  ]);
});
