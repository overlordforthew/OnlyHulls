import test from "node:test";
import assert from "node:assert/strict";

import { normalizeImportedLocation } from "../../src/lib/import-quality";

test("normalizeImportedLocation repairs mojibake place names", () => {
  assert.equal(
    normalizeImportedLocation("D\u00c3\u0192\u00c6\u2019\u00c3\u201a\u00c2\u00ban Laoghaire"),
    "D\u00fan Laoghaire"
  );
  assert.equal(
    normalizeImportedLocation("V\u00c3\u0192\u00c6\u2019\u00c3\u201a\u00c2\u00a4stkusten"),
    "V\u00e4stkusten"
  );
  assert.equal(
    normalizeImportedLocation("V\u00c3\u0192\u00c6\u2019\u00c3\u201a\u00c2\u00a4nersborg"),
    "V\u00e4nersborg"
  );
  assert.equal(
    normalizeImportedLocation("L\u00fcBeck, Schleswig-Holstein"),
    "L\u00fcbeck, Schleswig-Holstein"
  );
  assert.equal(
    normalizeImportedLocation("Fiskeb\u00e4Ck Marinan"),
    "Fiskeb\u00e4ck Marinan"
  );
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
  assert.equal(normalizeImportedLocation("Washington D.C"), "Washington D.C");
  assert.equal(normalizeImportedLocation("British Virgin Islands"), "British Virgin Islands");
  assert.equal(
    normalizeImportedLocation("Trogir, Yachtclub Seget (Marina Baoti\u0107)"),
    "Trogir, Yachtclub Seget (Marina Baoti\u0107)"
  );
  assert.equal(
    normalizeImportedLocation("Nanny Cay, Virgin Islands (British)"),
    "Nanny Cay, Virgin Islands (British)"
  );
  assert.equal(
    normalizeImportedLocation("Cap D'Agde"),
    "Cap D'Agde"
  );
  assert.equal(
    normalizeImportedLocation("L'Escala, Catalonia"),
    "L'Escala, Catalonia"
  );
  assert.equal(
    normalizeImportedLocation("En Route St.Lucia Late April 2026"),
    "En Route St.Lucia Late April 2026"
  );
  assert.equal(
    normalizeImportedLocation("S.W, Turkey"),
    "S.W, Turkey"
  );
  assert.equal(
    normalizeImportedLocation("Ensenada B.C, Null"),
    "Ensenada B.C, Null"
  );
  assert.equal(
    normalizeImportedLocation("Clarke'S Court Boatyard & Marina"),
    "Clarke's Court Boatyard & Marina"
  );
  assert.equal(
    normalizeImportedLocation("St George'S"),
    "St George's"
  );
  assert.equal(
    normalizeImportedLocation("Bvi Yacht Charter Docks, Tortola"),
    "BVI Yacht Charter Docks, Tortola"
  );
});
