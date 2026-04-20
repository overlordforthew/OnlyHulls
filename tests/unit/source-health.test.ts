import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSourceHealthPolicySignals,
  deriveImportVisibilityCounts,
} from "../../src/lib/source-health";

test("source health flags held inventory suppressed by public policy", () => {
  assert.deepEqual(
    buildSourceHealthPolicySignals({
      source: "Catamarans.com",
      active: 76,
      qualityVisibleBeforePolicy: 8,
      visible: 0,
    }),
    ["hold_suppresses_pre_policy_visible_inventory"]
  );
});

test("source health still flags held sources that leak into public visibility", () => {
  assert.deepEqual(
    buildSourceHealthPolicySignals({
      source: "Catamarans.com",
      active: 76,
      qualityVisibleBeforePolicy: 8,
      visible: 2,
    }),
    [
      "hold_has_public_visible_inventory",
      "hold_suppresses_pre_policy_visible_inventory",
    ]
  );
});

test("source health flags active sources without an explicit policy decision", () => {
  assert.deepEqual(
    buildSourceHealthPolicySignals({
      source: "Boats.com",
      active: 3,
      qualityVisibleBeforePolicy: 3,
      visible: 3,
    }),
    ["source_policy_undecided"]
  );
});

test("source health leaves approved sources quiet", () => {
  assert.deepEqual(
    buildSourceHealthPolicySignals({
      source: "Sailboat Listings",
      active: 9000,
      qualityVisibleBeforePolicy: 8500,
      visible: 8500,
    }),
    []
  );
});

test("source health flags freshness suppression separately from source policy", () => {
  assert.deepEqual(
    buildSourceHealthPolicySignals({
      source: "Sailboat Listings",
      active: 9000,
      qualityVisibleBeforeFreshness: 8800,
      qualityVisibleBeforePolicy: 4200,
      visible: 4200,
    }),
    ["source_freshness_suppresses_visible_inventory"]
  );
});

test("import visibility counts form a non-negative visibility waterfall", () => {
  assert.deepEqual(
    deriveImportVisibilityCounts({
      active: 12000,
      qualityVisibleBeforeFreshness: 11000,
      qualityVisibleBeforePolicy: 4300,
      visible: 4000,
    }),
    {
      qualitySuppressedCount: 1000,
      freshnessSuppressedCount: 6700,
      policySuppressedCount: 300,
      hiddenCount: 8000,
    }
  );

  assert.deepEqual(
    deriveImportVisibilityCounts({
      active: 10,
      qualityVisibleBeforeFreshness: 12,
      qualityVisibleBeforePolicy: 11,
      visible: 15,
    }),
    {
      qualitySuppressedCount: 0,
      freshnessSuppressedCount: 1,
      policySuppressedCount: 0,
      hiddenCount: 0,
    }
  );
});
