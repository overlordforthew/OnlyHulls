import test from "node:test";
import assert from "node:assert/strict";

import {
  buildActionRecommendation,
  buildBoatInsights,
  buildQuickFactors,
  type CompareBoat,
} from "../../src/lib/compare-analysis";

const mockBoats: CompareBoat[] = [
  {
    id: "boat-a",
    make: "Lagoon",
    model: "42",
    year: 2016,
    asking_price: 369000,
    currency: "USD",
    asking_price_usd: 369000,
    location_text: "Florida",
    slug: "2016-lagoon-42",
    is_sample: false,
    hero_url: null,
    image_count: 7,
    specs: {
      loa: 42,
      beam: 25,
      draft: 4.2,
      cabins: 3,
      berths: 6,
      heads: 2,
      rig_type: "catamaran",
    },
    character_tags: ["family-friendly", "liveaboard-ready"],
    seller_subscription_tier: "featured",
    condition_score: 8,
    source_url: null,
  },
  {
    id: "boat-b",
    make: "Catana",
    model: "522",
    year: 2005,
    asking_price: 748000,
    currency: "USD",
    asking_price_usd: 748000,
    location_text: "South Carolina",
    slug: "2005-catana-522",
    is_sample: false,
    hero_url: null,
    image_count: 4,
    specs: {
      loa: 52,
      beam: 27,
      draft: 5.2,
      cabins: 4,
      berths: 8,
      heads: 3,
      rig_type: "catamaran",
    },
    character_tags: ["bluewater"],
    seller_subscription_tier: "free",
    condition_score: 7,
    source_url: "https://example.com/listing",
    source_site: "sailboatlistings",
  },
];

test("buildQuickFactors surfaces the strongest decision separators", () => {
  const factors = buildQuickFactors(mockBoats, "USD");

  assert.equal(factors.length, 4);
  assert.equal(factors[0]?.label, "Lowest buy-in");
  assert.equal(factors[0]?.winnerId, "boat-a");
  assert.match(factors.map((factor) => factor.label).join(" | "), /Newest build|Longest hull/);
});

test("buildActionRecommendation favors the cleaner first-contact path", () => {
  const recommendation = buildActionRecommendation(mockBoats, "USD");

  assert.ok(recommendation);
  assert.equal(recommendation?.winnerId, "boat-a");
  assert.match(recommendation?.detail || "", /direct OnlyHulls path/i);
});

test("buildBoatInsights flags both strengths and watchouts", () => {
  const insights = buildBoatInsights(mockBoats);

  assert.ok((insights.get("boat-a")?.strengths.length || 0) > 0);
  assert.ok((insights.get("boat-b")?.watchouts.length || 0) > 0);
});
