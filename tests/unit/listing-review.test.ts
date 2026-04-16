import test from "node:test";
import assert from "node:assert/strict";
import { getListingReviewReadinessIssues } from "@/lib/listings/shared";

test("listing review readiness passes for a strong listing", () => {
  const issues = getListingReviewReadinessIssues(
    {
      make: "Beneteau",
      model: "Oceanis 41.1",
      year: 2020,
      askingPrice: 289000,
      currency: "USD",
      locationText: "Annapolis, MD",
      specs: {
        loa: 41,
        beam: 13,
        draft: 6,
        rig_type: "sloop",
      },
      conditionScore: 8,
      description:
        "Well-equipped cruising boat with recent canvas, upgraded electronics, and a clean service history. Ready for coastal passages and extended time aboard.",
      media: [],
    },
    5
  );

  assert.deepEqual(issues, []);
});

test("listing review readiness calls out missing quality blockers", () => {
  const issues = getListingReviewReadinessIssues(
    {
      make: "Pearson",
      model: "36",
      year: 1978,
      askingPrice: 25000,
      currency: "USD",
      locationText: "",
      specs: {
        loa: 36,
      },
      conditionScore: 5,
      description: "Short draft.",
      media: [],
    },
    1
  );

  assert.deepEqual(issues, [
    "Add at least 3 photos.",
    "Add a real location.",
    "Add a stronger description with at least 120 characters.",
    "Fill in at least 3 core specs.",
  ]);
});
