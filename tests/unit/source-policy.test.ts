import test from "node:test";
import assert from "node:assert/strict";

import {
  assertSourceImportAllowed,
  getDailySourceDecision,
  getSourceDecisionByKey,
  getSourceDecisionByName,
  shouldRunSourceInDailyPortfolio,
} from "../../src/lib/source-policy";

const EXPECTED_DECISIONS = [
  {
    key: "sailboatlistings",
    name: "Sailboat Listings",
    status: "keep",
    reasonPrefix: "Keep in the daily portfolio;",
  },
  {
    key: "theyachtmarket",
    name: "TheYachtMarket",
    status: "keep",
    reasonPrefix: "Keep in the daily portfolio;",
  },
  {
    key: "dreamyacht",
    name: "Dream Yacht Sales",
    status: "keep",
    reasonPrefix: "Keep in the daily portfolio;",
  },
  {
    key: "catamaransite",
    name: "CatamaranSite",
    status: "keep",
    reasonPrefix: "Keep in the daily portfolio;",
  },
  {
    key: "moorings",
    name: "Moorings Brokerage",
    status: "keep",
    reasonPrefix: "Keep in the daily portfolio;",
  },
  {
    key: "rightboat",
    name: "Rightboat",
    status: "test",
    reasonPrefix: "Keep Rightboat in the controlled-test lane only;",
  },
  {
    key: "apolloduck_us",
    name: "Apollo Duck US",
    status: "hold",
    reasonPrefix: "Hold new imports until",
  },
  {
    key: "camperandnicholsons",
    name: "Camper & Nicholsons",
    status: "hold",
    reasonPrefix: "Hold new imports until",
  },
  {
    key: "boote_yachten",
    name: "Boote & Yachten",
    status: "hold",
    reasonPrefix: "Hold new imports until",
  },
  {
    key: "denison",
    name: "Denison Yachting",
    status: "hold",
    reasonPrefix: "Hold new imports until",
  },
  {
    key: "multihullcompany",
    name: "Multihull Company",
    status: "hold",
    reasonPrefix: "Hold new imports until",
  },
  {
    key: "vi_yachtbroker",
    name: "VI Yacht Broker",
    status: "hold",
    reasonPrefix: "Hold new imports until",
  },
  {
    key: "multihullworld",
    name: "Multihull World",
    status: "hold",
    reasonPrefix: "Hold new imports until",
  },
  {
    key: "catamarans_com",
    name: "Catamarans.com",
    status: "hold",
    reasonPrefix: "Hold new imports until",
  },
] as const;

test("source policy resolves explicit decisions by key and name", () => {
  for (const decision of EXPECTED_DECISIONS) {
    const byKey = getSourceDecisionByKey(decision.key);
    const byName = getSourceDecisionByName(decision.name);

    assert.equal(byKey?.status, decision.status);
    assert.equal(byKey?.sourceName, decision.name);
    assert.match(byKey?.reason || "", new RegExp(`^${decision.reasonPrefix}`));

    assert.equal(byName?.status, decision.status);
    assert.equal(byName?.sourceName, decision.name);
    assert.match(byName?.reason || "", new RegExp(`^${decision.reasonPrefix}`));
  }
});

test("source policy leaves unrelated sources undecided", () => {
  assert.equal(getSourceDecisionByKey("boats_com"), null);
  assert.equal(getSourceDecisionByName("Boats.com"), null);
});

test("source policy exposes the daily scrape run decision", () => {
  for (const decision of EXPECTED_DECISIONS) {
    const daily = getDailySourceDecision(decision.key, decision.name);

    assert.equal(daily.status, decision.status);
    assert.equal(daily.sourceName, decision.name);
    assert.equal(daily.run, decision.status === "keep");
    assert.equal(shouldRunSourceInDailyPortfolio(decision.key), decision.status === "keep");
  }

  const undecided = getDailySourceDecision("boats_com", "Boats.com");
  assert.equal(undecided.run, false);
  assert.equal(undecided.status, "undecided");
  assert.match(undecided.reason, /not in the daily portfolio yet/i);
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
