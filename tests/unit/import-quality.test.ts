import test from "node:test";
import assert from "node:assert/strict";

import { normalizeImportedLocation } from "../../src/lib/import-quality";

test("normalizeImportedLocation repairs mojibake place names", () => {
  assert.equal(normalizeImportedLocation("DÃƒÆ’Ã‚Âºn Laoghaire"), "Dún Laoghaire");
  assert.equal(normalizeImportedLocation("VÃƒÆ’Ã‚Â¤stkusten"), "Västkusten");
  assert.equal(normalizeImportedLocation("VÃƒÆ’Ã‚Â¤nersborg"), "Vänersborg");
});

test("normalizeImportedLocation removes duplicate tails and placeholder values", () => {
  assert.equal(
    normalizeImportedLocation("Honolulu, Hawaii, Hawaii"),
    "Honolulu, Hawaii"
  );
  assert.equal(normalizeImportedLocation("Mare Adriatico,"), "Mare Adriatico");
  assert.equal(normalizeImportedLocation("Outside United States"), "");
  assert.equal(normalizeImportedLocation("Price"), "");
  assert.equal(normalizeImportedLocation("???????"), "");
});

test("normalizeImportedLocation preserves useful region formatting", () => {
  assert.equal(
    normalizeImportedLocation("San Juan Puerto Rico"),
    "San Juan, Puerto Rico"
  );
  assert.equal(
    normalizeImportedLocation("Location: Tortola, BVI"),
    "Tortola, British Virgin Islands"
  );
});
