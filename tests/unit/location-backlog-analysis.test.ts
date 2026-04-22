import assert from "node:assert/strict";
import { test } from "node:test";

import {
  analyzeLocationBacklogRow,
  getSourceCleanupPatternMatches,
  getSourceCleanupPatternMatchesForTexts,
  normalizeLocationBacklogText,
} from "../../src/lib/locations/location-backlog-analysis";

test("location backlog analysis prioritizes cleanup fixes when source patterns are present", () => {
  const result = analyzeLocationBacklogRow({
    status: "review",
    precision: "city",
    hasValidCoordinates: false,
    candidateReason: "ready",
    locationText: "Canada West Coast Just North Of Seattle",
    queryText: "Canada West Coast, Seattle",
    error: "no_result",
  });

  assert.equal(result.bucket, "review_queue");
  assert.equal(result.intervention, "source_cleanup_rule");
  assert.deepEqual(result.cleanupPatternIds, ["directional_fragment"]);
  assert.equal(result.clusterLabel, "Directional fragment around a real place");
});

test("location backlog analysis routes geocoded city rows to search-coverage review", () => {
  const result = analyzeLocationBacklogRow({
    status: "geocoded",
    precision: "city",
    hasValidCoordinates: true,
    candidateReason: "ready",
    locationText: "Aalborg, Denmark",
    queryText: "Aalborg, Denmark",
  });

  assert.equal(result.bucket, "held_back_coordinate");
  assert.equal(result.intervention, "search_coverage_batch");
  assert.equal(result.rationale.startsWith("Has a city-level geocoded anchor"), true);
});

test("location backlog analysis records unfixable rows by broad city/region-only text", () => {
  const result = analyzeLocationBacklogRow({
    status: "pending",
    precision: null,
    hasValidCoordinates: false,
    candidateReason: "needs_more_specific_location",
    locationText: "Florida",
    queryText: null,
  });

  assert.equal(result.bucket, "needs_more_specific_location");
  assert.equal(result.intervention, "unfixable");
  assert.equal(result.unfixableReason, "broad_region_or_state_only");
});

test("location backlog analysis keeps pending rows in search coverage", () => {
  const result = analyzeLocationBacklogRow({
    status: "pending",
    precision: null,
    hasValidCoordinates: false,
    candidateReason: "ready",
    locationText: "Plymouth, United Kingdom",
    queryText: "Plymouth, United Kingdom",
  });

  assert.equal(result.bucket, "pending_ready");
  assert.equal(result.intervention, "search_coverage_batch");
  assert.equal(result.unfixableReason, null);
});

test("location backlog text helpers support cleanup-pattern detection", () => {
  assert.equal(normalizeLocationBacklogText("Alimos Marina? Greece"), "alimos marina greece");
  assert.equal(
    getSourceCleanupPatternMatches("Canada West Coast, Just North Of Seattle").some(
      (match) => match.id === "directional_fragment"
    ),
    true
  );
  assert.deepEqual(
    getSourceCleanupPatternMatchesForTexts("Aan Verkoopsteiger In Lelystad", "South Of, France").map(
      (match) => match.id
    ),
    ["dutch_sales_dock_prefix", "directional_fragment"]
  );
});
