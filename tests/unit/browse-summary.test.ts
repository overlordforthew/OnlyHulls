import test from "node:test";
import assert from "node:assert/strict";

import { buildBoatBrowseSummary } from "../../src/lib/browse-summary";

test("buildBoatBrowseSummary drops title, price, and import-source boilerplate", () => {
  assert.equal(
    buildBoatBrowseSummary({
      title: "1988 Stephens Sparkman & Stevens 88",
      locationText: "Bahamas",
      summary:
        "1988 Stephens Sparkman & Stevens 88 listed in Bahamas. Key specs include 88ft LOA, motorsailer rig, monohull hull. Asking USD 695,000. Imported from Sailboat Listings.",
    }),
    "88ft LOA, motorsailer rig, monohull."
  );
});

test("buildBoatBrowseSummary keeps the useful middle sentence from source-style copy", () => {
  assert.equal(
    buildBoatBrowseSummary({
      title: "1974 Contest Yachts 33",
      locationText: "Nassau, Bahamas",
      summary:
        "1974 Contest Yachts 33 in Nassau, Bahamas. Masthead sloop, 33-ft LOA, 10.5 ft beam, 5 ft draft. Asking USD 19,500.",
    }),
    "Masthead sloop, 33-ft LOA, 10.5 ft beam, 5 ft draft."
  );
});

test("buildBoatBrowseSummary preserves already-useful summaries", () => {
  assert.equal(
    buildBoatBrowseSummary({
      title: "2013 Lagoon 400 S2",
      locationText: "Bahamas",
      summary:
        "Three-cabin owner's layout with updated canvas, solar support, and a practical cruising cockpit setup.",
    }),
    "Three-cabin owner's layout with updated canvas, solar support, and a practical cruising cockpit setup."
  );
});
