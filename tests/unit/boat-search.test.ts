import test from "node:test";
import assert from "node:assert/strict";

import { buildSavedSearchName } from "../../src/lib/search/boat-search";

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
