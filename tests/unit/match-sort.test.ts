import test from "node:test";
import assert from "node:assert/strict";

import {
  buildMatchOrderBy,
  parseMatchDir,
  parseMatchSort,
} from "../../src/lib/matching/match-sort";

test("default match sort groups by score and breaks ties by lower price", () => {
  const sort = parseMatchSort(null);
  const dir = parseMatchDir(null, sort);
  const orderBy = buildMatchOrderBy(sort, dir);

  assert.equal(sort, "match");
  assert.equal(dir, "desc");
  assert.match(orderBy, /^m\.score DESC NULLS LAST/);
  assert.match(orderBy, /COALESCE\(b\.asking_price_usd, b\.asking_price\) ASC NULLS LAST/);
  assert.match(orderBy, /b\.year DESC NULLS LAST$/);
});

test("price sort still prioritizes price first and keeps stronger matches ahead on ties", () => {
  const orderBy = buildMatchOrderBy("price", "asc");

  assert.equal(
    orderBy,
    "COALESCE(b.asking_price_usd, b.asking_price) ASC NULLS LAST, m.score DESC NULLS LAST"
  );
});
