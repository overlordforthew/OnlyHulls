import test from "node:test";
import assert from "node:assert/strict";

import {
  assertSourceImportAllowed,
  getSourceDecisionByKey,
  getSourceDecisionByName,
} from "../../src/lib/source-policy";

const EXPECTED_DECISIONS = [
  {
    key: "sailboatlistings",
    name: "Sailboat Listings",
    status: "keep",
    reason:
      "Keep in the daily portfolio; production source health on 2026-04-14 showed 8,386 visible listings out of 9,906 active rows, making it the largest buyer-visible sailing source.",
  },
  {
    key: "theyachtmarket",
    name: "TheYachtMarket",
    status: "keep",
    reason:
      "Keep in the daily portfolio; production source health on 2026-04-14 showed 3,522 visible listings out of 3,665 active rows with strong sailing relevance.",
  },
  {
    key: "dreamyacht",
    name: "Dream Yacht Sales",
    status: "keep",
    reason:
      "Keep in the daily portfolio; production source health on 2026-04-14 showed 95 visible listings out of 97 active rows after the recent image and location recovery work.",
  },
  {
    key: "catamaransite",
    name: "CatamaranSite",
    status: "keep",
    reason:
      "Keep in the daily portfolio; production source health on 2026-04-14 showed all 44 active CatamaranSite rows buyer-visible.",
  },
  {
    key: "moorings",
    name: "Moorings Brokerage",
    status: "keep",
    reason:
      "Keep in the daily portfolio; production source health on 2026-04-14 showed 13 visible listings out of 14 active rows for this high-fit charter-exit source.",
  },
  {
    key: "rightboat",
    name: "Rightboat",
    status: "test",
    reason:
      "Keep Rightboat in the controlled-test lane only; the operational source directory still flags aggressive rate limiting, and production currently has 0 active imported rows on 2026-04-14.",
  },
  {
    key: "apolloduck_us",
    name: "Apollo Duck US",
    status: "hold",
    reason:
      "Hold new imports until the scraper can capture real images; production source health on 2026-04-13 showed 0 visible listings out of 89 active rows.",
  },
  {
    key: "camperandnicholsons",
    name: "Camper & Nicholsons",
    status: "hold",
    reason:
      "Hold new imports until the scraper follows detail pages for real location and image extraction; production source health on 2026-04-13 showed 0 visible listings out of 90 active rows.",
  },
  {
    key: "boote_yachten",
    name: "Boote & Yachten",
    status: "hold",
    reason:
      "Hold new imports until the scraper follows detail pages for real image extraction; production source health on 2026-04-14 showed 0 visible listings out of 23 active rows with all 23 missing images.",
  },
  {
    key: "denison",
    name: "Denison Yachting",
    status: "hold",
    reason:
      "Hold new imports until the scraper follows detail pages for real image and location extraction; production source health on 2026-04-14 showed 0 visible listings out of 21 active rows with all 21 missing locations and images.",
  },
  {
    key: "multihullcompany",
    name: "Multihull Company",
    status: "hold",
    reason:
      "Hold new imports until the scraper captures real images from listing or detail pages; production source health on 2026-04-14 showed 0 visible listings out of 17 active rows with all 17 missing images.",
  },
  {
    key: "vi_yachtbroker",
    name: "VI Yacht Broker",
    status: "hold",
    reason:
      "Hold new imports until the scraper follows detail pages for real image extraction; production source health on 2026-04-14 showed 0 visible listings out of 15 active rows with all 15 missing images.",
  },
  {
    key: "multihullworld",
    name: "Multihull World",
    status: "hold",
    reason:
      "Hold new imports until the scraper follows detail pages for real image and location extraction; production source health on 2026-04-14 showed 0 visible listings out of 14 active rows with all 14 missing locations and images.",
  },
  {
    key: "catamarans_com",
    name: "Catamarans.com",
    status: "hold",
    reason:
      "Hold new imports until location extraction is materially better and powerboat/RIB bleed is filtered out; production source health on 2026-04-14 showed only 10 visible listings out of 88 active rows, with 78 missing locations and 21 active used-power URLs.",
  },
] as const;

test("source policy resolves explicit decisions by key and name", () => {
  for (const decision of EXPECTED_DECISIONS) {
    assert.deepEqual(getSourceDecisionByKey(decision.key), {
      status: decision.status,
      sourceName: decision.name,
      reason: decision.reason,
    });
    assert.deepEqual(getSourceDecisionByName(decision.name), {
      status: decision.status,
      sourceName: decision.name,
      reason: decision.reason,
    });
  }
});

test("source policy leaves unrelated sources undecided", () => {
  assert.equal(getSourceDecisionByKey("boats_com"), null);
  assert.equal(getSourceDecisionByName("Boats.com"), null);
});

test("source policy blocks only held imports", () => {
  for (const decision of EXPECTED_DECISIONS) {
    if (decision.status === "hold") {
      assert.throws(
        () => assertSourceImportAllowed(decision.key, decision.name),
        new RegExp(`${decision.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} imports are on hold`)
      );
      continue;
    }

    assert.doesNotThrow(() => assertSourceImportAllowed(decision.key, decision.name));
  }
});
