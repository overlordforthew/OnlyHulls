import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBoatSearchParams,
  buildOrderBy,
  buildSavedSearchName,
  buildSavedSearchSignature,
  buildWhereClause,
  filtersFromSearchParams,
} from "../../src/lib/search/boat-search";
import { inferLocationMarketSignals } from "../../src/lib/locations/top-markets";

test("buildSavedSearchName uses stable ASCII separators", () => {
  assert.equal(
    buildSavedSearchName({
      search: "Catana",
      minPrice: "200000",
      maxPrice: "400000",
      minYear: "2008",
      rigType: "sloop",
    }),
    "Catana | $200k-$400k | 2008+ | Sloop"
  );
});

test("buildSavedSearchName falls back cleanly for broad saved searches", () => {
  assert.equal(buildSavedSearchName({}), "All boats");
});

test("buildSavedSearchName includes dedicated location filters", () => {
  assert.equal(buildSavedSearchName({ location: "bahamas" }), "In Bahamas");
});

test("buildSavedSearchName preserves non-USD price context", () => {
  assert.equal(
    buildSavedSearchName({ minPrice: "200000", maxPrice: "400000", currency: "EUR" }),
    "All boats | EUR 200k-EUR 400k"
  );
});

test("buildOrderBy favors stronger trust signals on newest browse results", () => {
  const orderBy = buildOrderBy("newest", "desc");

  assert.match(orderBy, /location_text/i);
  assert.match(orderBy, /boat_media/i);
  assert.match(orderBy, /import_quality_score/i);
});

test("buildOrderBy keeps explicit price sorting centered on price", () => {
  const orderBy = buildOrderBy("price", "asc");

  assert.match(orderBy, /asking_price_usd|b\.asking_price/i);
  assert.doesNotMatch(orderBy, /location_text/i);
});

test("boat search preserves dedicated location filters separately from text search", () => {
  const filters = filtersFromSearchParams(
    new URLSearchParams("location=bahamas&page=2&limit=30")
  );

  assert.equal(filters.search, "");
  assert.equal(filters.location, "bahamas");

  const params = buildBoatSearchParams({ location: "bahamas" });
  assert.equal(params.get("location"), "bahamas");
  assert.equal(params.get("q"), null);

  const where = buildWhereClause(filters);
  assert.match(where.where, /location_text/i);
  assert.match(where.where, /location_market_slugs/i);
  assert.equal(where.params[0], "bahamas");
  assert.equal(where.params[1], "%bahamas%");
});

test("boat search canonicalizes known location aliases and expands market terms", () => {
  const filters = filtersFromSearchParams(new URLSearchParams("location=PR"));

  assert.equal(filters.location, "puerto-rico");

  const params = buildBoatSearchParams({ location: "Fajardo" });
  assert.equal(params.get("location"), "puerto-rico");

  const where = buildWhereClause(filters);
  assert.match(where.where, /location_text/i);
  assert.match(where.where, /location_market_slugs/i);
  assert.deepEqual(where.params.slice(0, 4), [
    "puerto-rico",
    "%puerto rico%",
    "%san juan%",
    "%fajardo%",
  ]);
});

test("boat search keeps exact child markets from collapsing into regional rollups", () => {
  assert.equal(buildBoatSearchParams({ location: "BVI" }).get("location"), "bvi");
  assert.equal(buildBoatSearchParams({ location: "Greece" }).get("location"), "greece");
  assert.equal(buildBoatSearchParams({ location: "Spain" }).get("location"), "spain");
});

test("location inference tags exact markets and parent cruising regions", () => {
  const bvi = inferLocationMarketSignals({ locationText: "Tortola, British Virgin Islands" });

  assert.deepEqual(bvi.marketSlugs, ["caribbean", "bvi"]);
  assert.equal(bvi.country, "British Virgin Islands");
  assert.equal(bvi.region, "Caribbean");
  assert.equal(bvi.confidence, "city");
  assert.equal(bvi.approximate, true);

  const florida = inferLocationMarketSignals({
    locationText: "Fort Lauderdale, FL",
    latitude: 26.1224,
    longitude: -80.1373,
  });
  assert.deepEqual(florida.marketSlugs, ["florida"]);
  assert.equal(florida.confidence, "exact");
  assert.equal(florida.approximate, false);
});

test("saved search signature keeps location and currency distinct", () => {
  const signature = JSON.parse(
    buildSavedSearchSignature({ location: "bahamas", minPrice: "200000", currency: "GBP" })
  );

  assert.equal(signature.location, "bahamas");
  assert.equal(signature.currency, "GBP");
});
