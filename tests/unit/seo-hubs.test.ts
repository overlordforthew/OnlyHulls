import test from "node:test";
import assert from "node:assert/strict";

import {
  CATEGORY_HUBS,
  LOCATION_HUBS,
  getRelevantSeoHubLinksForBoat,
  listProgrammaticHubSlugs,
  resolveProgrammaticHub,
} from "../../src/lib/seo/hubs";

test("listProgrammaticHubSlugs enumerates the full matrix", () => {
  const slugs = listProgrammaticHubSlugs();
  assert.equal(slugs.length, 8);
  for (const slug of [
    "catamarans-for-sale-in-florida",
    "catamarans-for-sale-in-caribbean",
    "catamarans-for-sale-in-puerto-rico",
    "catamarans-for-sale-in-bahamas",
    "sailboats-for-sale-in-florida",
    "sailboats-for-sale-in-caribbean",
    "sailboats-for-sale-in-puerto-rico",
    "sailboats-for-sale-in-bahamas",
  ]) {
    assert.ok(slugs.includes(slug), `missing ${slug}`);
  }
});

test("resolveProgrammaticHub returns null for unknown slugs", () => {
  assert.equal(resolveProgrammaticHub("some-unrelated-route"), null);
  assert.equal(resolveProgrammaticHub("catamarans-for-sale-in-mars"), null);
  assert.equal(resolveProgrammaticHub("sailboats-for-sale-in-"), null);
});

test("resolveProgrammaticHub returns a hub with consistent SQL placeholder count", () => {
  const hub = resolveProgrammaticHub("catamarans-for-sale-in-florida");
  assert.ok(hub);
  const refs = [...hub!.queryWhere.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]));
  const max = Math.max(...refs);
  assert.equal(hub!.queryParams?.length, max, "queryParams length should match highest $N placeholder");
});

test("programmatic hubs cross-link to sibling matrix entries", () => {
  const hub = resolveProgrammaticHub("catamarans-for-sale-in-florida");
  assert.ok(hub);
  const hrefs = hub!.relatedLinks.map((link) => link.href);
  assert.ok(hrefs.includes("/catamarans-for-sale-in-caribbean"), "same-category sibling");
  assert.ok(hrefs.includes("/sailboats-for-sale-in-florida"), "same-location sibling");
  assert.ok(hrefs.includes("/catamarans-for-sale"), "parent category hub");
  assert.ok(hrefs.includes("/boats/location/florida"), "parent location hub");
});

test("static CATEGORY_HUBS link down to programmatic children", () => {
  const hrefs = CATEGORY_HUBS["catamarans-for-sale"]!.relatedLinks.map((l) => l.href);
  assert.ok(hrefs.includes("/catamarans-for-sale-in-florida"));
  assert.ok(hrefs.includes("/catamarans-for-sale-in-caribbean"));
  assert.ok(hrefs.includes("/catamarans-for-sale-in-puerto-rico"));
  assert.ok(hrefs.includes("/catamarans-for-sale-in-bahamas"));
});

test("static LOCATION_HUBS link down to both category programmatic children", () => {
  const florida = LOCATION_HUBS["florida"]!.relatedLinks.map((l) => l.href);
  assert.ok(florida.includes("/catamarans-for-sale-in-florida"));
  assert.ok(florida.includes("/sailboats-for-sale-in-florida"));

  const bahamas = LOCATION_HUBS["bahamas"]!.relatedLinks.map((l) => l.href);
  assert.ok(bahamas.includes("/catamarans-for-sale-in-bahamas"));
  assert.ok(bahamas.includes("/sailboats-for-sale-in-bahamas"));
});

test("boat-detail relevance picks catamaran programmatic hub when make is in CATAMARAN_MAKES", () => {
  const links = getRelevantSeoHubLinksForBoat({ make: "Lagoon", locationText: "Miami, FL" });
  assert.equal(links[0]?.href, "/catamarans-for-sale-in-florida");
});

test("boat-detail relevance resolves Fort Lauderdale to florida via alias", () => {
  const links = getRelevantSeoHubLinksForBoat({ make: "Lagoon", locationText: "Fort Lauderdale" });
  assert.equal(links[0]?.href, "/catamarans-for-sale-in-florida");
});

test("boat-detail relevance resolves Nassau to bahamas via alias", () => {
  const links = getRelevantSeoHubLinksForBoat({
    make: "Beneteau",
    locationText: "Nassau, Bahamas",
    rigType: "sloop",
  });
  assert.equal(links[0]?.href, "/sailboats-for-sale-in-bahamas");
});

test("boat-detail relevance does NOT emit programmatic link for non-sailing boats", () => {
  // Boston Whaler in Miami — explicit powerboat, no hull evidence, should
  // NOT get a sailboats-for-sale programmatic link. Regression from 2026-04-24.
  const links = getRelevantSeoHubLinksForBoat({
    make: "Boston Whaler",
    locationText: "Miami, FL",
  });
  const hrefs = links.map((l) => l.href);
  assert.ok(!hrefs.some((h) => h.startsWith("/sailboats-for-sale-in-")), `got ${hrefs.join(", ")}`);
});

test("boat-detail relevance does NOT emit programmatic link for ambiguous unknown boats", () => {
  const links = getRelevantSeoHubLinksForBoat({
    make: "Unknown",
    locationText: "San Juan, Puerto Rico",
  });
  const hrefs = links.map((l) => l.href);
  assert.ok(!hrefs.some((h) => h.startsWith("/catamarans-for-sale-in-")), `got ${hrefs.join(", ")}`);
  assert.ok(!hrefs.some((h) => h.startsWith("/sailboats-for-sale-in-")), `got ${hrefs.join(", ")}`);
});

test("boat-detail relevance reads canonical vessel_type for catamaran classification", () => {
  // A "Custom" catamaran (not in CATAMARAN_MAKES list) with only vessel_type
  // populated must still route to catamaran programmatic hub, not sailboat.
  const links = getRelevantSeoHubLinksForBoat({
    make: "Custom",
    locationText: "Miami, FL",
    vesselType: "catamaran",
  });
  assert.equal(links[0]?.href, "/catamarans-for-sale-in-florida");
});

test("boat-detail relevance falls back to hullType when vesselType is missing (legacy alias)", () => {
  const links = getRelevantSeoHubLinksForBoat({
    make: "Custom",
    locationText: "Miami, FL",
    hullType: "catamaran",
  });
  assert.equal(links[0]?.href, "/catamarans-for-sale-in-florida");
});

test("boat-detail relevance caps at 4 links", () => {
  const links = getRelevantSeoHubLinksForBoat({
    make: "Lagoon",
    locationText: "Fort Lauderdale",
  });
  assert.ok(links.length <= 4);
});

test("boat-detail relevance: vessel_type=powerboat blocks sailboat rig fallback AND static category anchors", () => {
  // Canonical vessel_type must be authoritative. A powerboat with rig_type
  // set (bad data, but can happen) must NOT route to sailboats-for-sale-in-X
  // — and the generic /sailboats-for-sale / /catamarans-for-sale static
  // hubs must not appear as fallback fillers either. Same rule for
  // catamaran-only make hubs.
  const links = getRelevantSeoHubLinksForBoat({
    make: "Custom",
    locationText: "Miami, FL",
    vesselType: "powerboat",
    rigType: "sloop",
  });
  const hrefs = links.map((l) => l.href);
  assert.ok(!hrefs.some((h) => h.startsWith("/sailboats-for-sale")), `got ${hrefs.join(", ")}`);
  assert.ok(!hrefs.some((h) => h.startsWith("/catamarans-for-sale")), `got ${hrefs.join(", ")}`);
  assert.ok(!hrefs.some((h) => /^\/boats\/make\/(lagoon|leopard|bali|catana)$/.test(h)), `got ${hrefs.join(", ")}`);
});

test("boat-detail relevance: vessel_type=trimaran blocks programmatic AND static category anchors", () => {
  const links = getRelevantSeoHubLinksForBoat({
    make: "Neel",
    locationText: "Fort Lauderdale",
    vesselType: "trimaran",
    rigType: "sloop",
  });
  const hrefs = links.map((l) => l.href);
  assert.ok(!hrefs.some((h) => h.startsWith("/sailboats-for-sale")), `got ${hrefs.join(", ")}`);
  assert.ok(!hrefs.some((h) => h.startsWith("/catamarans-for-sale")), `got ${hrefs.join(", ")}`);
});

test("boat-detail relevance: rig_type=motor classifies as non-sailing", () => {
  const links = getRelevantSeoHubLinksForBoat({
    make: "Pacific Seacraft",
    locationText: "Miami, FL",
    rigType: "motor",
  });
  const hrefs = links.map((l) => l.href);
  assert.ok(!hrefs.some((h) => h.startsWith("/sailboats-for-sale-in-")), `got ${hrefs.join(", ")}`);
});

test("catamaran hub SQL includes vessel_type=catamaran classification", () => {
  const hub = resolveProgrammaticHub("catamarans-for-sale-in-florida");
  assert.ok(hub);
  assert.match(hub!.queryWhere, /vessel_type.*=.*'catamaran'/);
});

test("sailboat hub SQL excludes powerboat and trimaran vessel_types", () => {
  const hub = resolveProgrammaticHub("sailboats-for-sale-in-florida");
  assert.ok(hub);
  assert.match(hub!.queryWhere, /vessel_type.*NOT IN.*'powerboat'.*'trimaran'/);
});

test("boat-detail relevance: unrecognised vesselType falls back to canonical hullType", () => {
  // Legacy record shape: vesselType populated with a non-canonical string
  // ("yacht"), but hullType carries the real signal. The resolver must not
  // let the unknown vesselType suppress a recognised hullType.
  const links = getRelevantSeoHubLinksForBoat({
    make: "Custom",
    locationText: "Miami, FL",
    vesselType: "yacht",
    hullType: "catamaran",
  });
  assert.equal(links[0]?.href, "/catamarans-for-sale-in-florida");
});

test("boat-detail relevance: powerboat gets no related hubs except location", () => {
  // Concrete regression anchor for Codex's HIGH finding. A Boston Whaler
  // in Miami should land only on /boats/location/florida — no catamaran or
  // sailboat category hubs, no catamaran make hubs.
  const links = getRelevantSeoHubLinksForBoat({
    make: "Boston Whaler",
    locationText: "Miami, FL",
    vesselType: "powerboat",
    rigType: "motor",
  });
  const hrefs = links.map((l) => l.href);
  // Must contain the neutral location hub.
  assert.ok(hrefs.includes("/boats/location/florida"));
  // Must NOT contain any hull-axis-specific surface.
  assert.ok(!hrefs.includes("/catamarans-for-sale"));
  assert.ok(!hrefs.includes("/sailboats-for-sale"));
  assert.ok(!hrefs.includes("/boats/make/lagoon"));
});
