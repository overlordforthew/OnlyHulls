import assert from "node:assert/strict";
import { test } from "node:test";

import {
  analyzeLocationBacklogRow,
  getMarinePoiNameCandidate,
  getSourceCleanupPatternMatches,
  getSourceCleanupPatternMatchesForTexts,
  normalizeLocationBacklogText,
} from "../../src/lib/locations/location-backlog-analysis";

test("location backlog analysis ranks verified aliases as hand-alias work", () => {
  const result = analyzeLocationBacklogRow({
    status: "review",
    precision: "city",
    hasValidCoordinates: false,
    candidateReason: "ready",
    locationText: "Nassau, Palm Cay Marina, Bahamas",
    queryText: "Palm Cay Marina, Nassau, Bahamas",
    error: "public_pin_ineligible_precision",
    triageCategory: "manual_review",
  });

  assert.equal(result.bucket, "review_queue");
  assert.equal(result.intervention, "hand_alias");
  assert.equal(result.verifiedAlias, "palm cay marina");
  assert.equal(result.clusterLabel, "palm cay marina");
});

test("location backlog analysis routes marine POI text to gazetteer candidates", () => {
  const result = analyzeLocationBacklogRow({
    status: "pending",
    precision: null,
    hasValidCoordinates: false,
    candidateReason: "ready",
    locationText: "Virgin Gorda Boatyard, British Virgin Islands",
    queryText: "Virgin Gorda Boatyard, British Virgin Islands",
  });

  assert.equal(result.bucket, "pending_ready");
  assert.equal(result.intervention, "gazetteer_poi");
  assert.equal(result.marinePoiName, "Virgin Gorda Boatyard");
});

test("location backlog analysis detects cleanup-rule candidates", () => {
  const result = analyzeLocationBacklogRow({
    status: "review",
    precision: "unknown",
    hasValidCoordinates: false,
    candidateReason: "ready",
    locationText: "Canada West Coast Just North Of Seattle",
    queryText: "Canada West Coast Just, Seattle",
    error: "no_result",
    triageCategory: "cleanup_source_text",
  });

  assert.equal(result.intervention, "source_cleanup_rule");
  assert.deepEqual(result.cleanupPatternIds, ["directional_fragment"]);
});

test("location backlog analysis detects cleanup patterns in query text", () => {
  const result = analyzeLocationBacklogRow({
    status: "pending",
    precision: null,
    hasValidCoordinates: false,
    candidateReason: "ready",
    locationText: "Lelystad",
    queryText: "Aan Verkoopsteiger In Lelystad",
  });

  assert.equal(result.intervention, "source_cleanup_rule");
  assert.deepEqual(result.cleanupPatternIds, ["dutch_sales_dock_prefix"]);
});

test("location backlog analysis detects each cleanup pattern", () => {
  const examples = [
    ["Aan Verkoopsteiger In Lelystad", "dutch_sales_dock_prefix"],
    ["St Maarten NA Northeastern Caribbean", "saint_martin_variants"],
    ["Georgetown Exuma Bahmas", "misspelled_country_or_region"],
    ["Bayfield - Lake Huron", "lake_context"],
    ["South Of, France", "directional_fragment"],
  ] as const;

  for (const [text, patternId] of examples) {
    assert.equal(
      getSourceCleanupPatternMatches(text).some((match) => match.id === patternId),
      true,
      text
    );
  }
});

test("location backlog analysis keeps broad city rows as search coverage", () => {
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
});

test("location backlog analysis records unfixable sub-reasons", () => {
  const result = analyzeLocationBacklogRow({
    status: "pending",
    precision: null,
    hasValidCoordinates: false,
    candidateReason: "needs_more_specific_location",
    locationText: "Florida",
    queryText: null,
  });

  assert.equal(result.intervention, "unfixable");
  assert.equal(result.unfixableReason, "broad_region_or_state_only");
});

test("location backlog text helpers normalize and extract useful patterns", () => {
  assert.equal(normalizeLocationBacklogText("CONWY Marina."), "conwy marina");
  assert.equal(getMarinePoiNameCandidate("Nassau, Palm Cay Marina, Bahamas"), "Palm Cay Marina");
  assert.deepEqual(
    getSourceCleanupPatternMatchesForTexts("Aan Verkoopsteiger In Lelystad", "South Of, France").map(
      (match) => match.id
    ),
    ["dutch_sales_dock_prefix", "directional_fragment"]
  );
  assert.deepEqual(
    getSourceCleanupPatternMatches("Aan Verkoopsteiger In Lelystad").map((match) => match.id),
    ["dutch_sales_dock_prefix"]
  );
});
