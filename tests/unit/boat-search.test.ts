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
  assert.deepEqual(florida.marketSlugs, ["united-states", "florida"]);
  assert.equal(florida.confidence, "exact");
  assert.equal(florida.approximate, false);

  const approximateCannes = inferLocationMarketSignals({
    locationText: "Cannes",
    latitude: 43.5528,
    longitude: 7.0174,
    coordinatesApproximate: true,
  });
  assert.deepEqual(approximateCannes.marketSlugs, ["mediterranean", "france"]);
  assert.equal(approximateCannes.confidence, "city");
  assert.equal(approximateCannes.approximate, true);
});

test("location inference covers high-volume European marina text", () => {
  const croatia = inferLocationMarketSignals({ locationText: "Split" });
  assert.deepEqual(croatia.marketSlugs, ["mediterranean", "croatia"]);
  assert.equal(croatia.country, "Croatia");
  assert.equal(croatia.confidence, "city");

  const uk = inferLocationMarketSignals({ locationText: "Plymouth, Devon" });
  assert.deepEqual(uk.marketSlugs, ["uk"]);
  assert.equal(uk.country, "United Kingdom");
  assert.equal(uk.confidence, "city");

  const martinique = inferLocationMarketSignals({ locationText: "Le Marin" });
  assert.deepEqual(martinique.marketSlugs, ["caribbean", "martinique"]);
  assert.equal(martinique.country, "Martinique");
});

test("location inference covers long-tail commercial cruising markets", () => {
  const grenada = inferLocationMarketSignals({ locationText: "Clarke's Court Boatyard & Marina" });
  assert.deepEqual(grenada.marketSlugs, ["caribbean", "grenada"]);
  assert.equal(grenada.country, "Grenada");

  const canada = inferLocationMarketSignals({ locationText: "Central Vancouver Island, British Columbia" });
  assert.deepEqual(canada.marketSlugs, ["canada", "pacific-northwest"]);
  assert.equal(canada.country, "Canada");

  const carolina = inferLocationMarketSignals({ locationText: "Charleston" });
  assert.deepEqual(carolina.marketSlugs, ["united-states", "south-carolina"]);
  assert.equal(carolina.country, "United States");

  const france = inferLocationMarketSignals({ locationText: "Cannes" });
  assert.deepEqual(france.marketSlugs, ["mediterranean", "france"]);
  assert.equal(france.country, "France");
});

test("location inference covers low-volume marina tail without overpromising coordinates", () => {
  const texas = inferLocationMarketSignals({ locationText: "Kemah, Texas" });
  assert.deepEqual(texas.marketSlugs, ["united-states", "texas"]);
  assert.equal(texas.confidence, "city");
  assert.equal(texas.approximate, true);

  const malta = inferLocationMarketSignals({ locationText: "Valletta" });
  assert.deepEqual(malta.marketSlugs, ["mediterranean", "malta"]);
  assert.equal(malta.country, "Malta");

  const sweden = inferLocationMarketSignals({ locationText: "Gothenburg" });
  assert.deepEqual(sweden.marketSlugs, ["sweden"]);
  assert.equal(sweden.country, "Sweden");

  const hungary = inferLocationMarketSignals({ locationText: "Balatonvilágos" });
  assert.deepEqual(hungary.marketSlugs, ["hungary"]);
  assert.equal(hungary.country, "Hungary");

  const stMaarten = inferLocationMarketSignals({ locationText: "Sint Maarten" });
  assert.deepEqual(stMaarten.marketSlugs, ["caribbean", "st-maarten"]);
  assert.equal(stMaarten.country, "Sint Maarten");

  const greatLakes = inferLocationMarketSignals({ locationText: "Au Gres, Michigan" });
  assert.deepEqual(greatLakes.marketSlugs, ["united-states", "great-lakes"]);
  assert.equal(greatLakes.country, "United States");
  assert.equal(greatLakes.confidence, "city");
});

test("location inference keeps broad state-only aliases at regional confidence", () => {
  const maryland = inferLocationMarketSignals({ locationText: "Maryland" });
  assert.deepEqual(maryland.marketSlugs, ["united-states", "chesapeake-bay"]);
  assert.equal(maryland.confidence, "region");

  const michigan = inferLocationMarketSignals({ locationText: "Michigan" });
  assert.deepEqual(michigan.marketSlugs, ["united-states", "great-lakes"]);
  assert.equal(michigan.confidence, "region");

  const rhodeIsland = inferLocationMarketSignals({ locationText: "Rhode Island" });
  assert.deepEqual(rhodeIsland.marketSlugs, ["united-states", "new-england"]);
  assert.equal(rhodeIsland.confidence, "region");

  const annapolis = inferLocationMarketSignals({ locationText: "Annapolis" });
  assert.deepEqual(annapolis.marketSlugs, ["united-states", "chesapeake-bay"]);
  assert.equal(annapolis.confidence, "city");
});

test("saved search signature keeps location and currency distinct", () => {
  const signature = JSON.parse(
    buildSavedSearchSignature({ location: "bahamas", minPrice: "200000", currency: "GBP" })
  );

  assert.equal(signature.location, "bahamas");
  assert.equal(signature.currency, "GBP");
});
