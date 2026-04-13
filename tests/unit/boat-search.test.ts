import test from "node:test";
import assert from "node:assert/strict";

import { buildOrderBy, buildSavedSearchName } from "../../src/lib/search/boat-search";

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
