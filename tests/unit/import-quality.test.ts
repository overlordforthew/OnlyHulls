import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeImportedLocation,
  normalizeImportedMakeModel,
} from "../../src/lib/import-quality";

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
  assert.equal(normalizeImportedLocation("\u{1F1E7}\u{1F1EC}, Bulgaria"), "Bulgaria");
  assert.equal(normalizeImportedLocation("Outside United States"), "");
  assert.equal(normalizeImportedLocation("Price"), "");
  assert.equal(normalizeImportedLocation("???????"), "");
});

test("normalizeImportedLocation fixes live TheYachtMarket UK and Greece tails", () => {
  assert.equal(
    normalizeImportedLocation("Cowes, Uk \u{1F1EC}\u{1F1E7}"),
    "Cowes, UK"
  );
  assert.equal(
    normalizeImportedLocation("Hamble, Uk \u{1F1EC}\u{1F1E7}"),
    "Hamble, UK"
  );
  assert.equal(
    normalizeImportedLocation("Alimos Marina, άλιμος, GrèCe"),
    "Alimos Marina, Alimos, Greece"
  );
  assert.equal(
    normalizeImportedLocation("Athens, Greecen / A"),
    "Athens, Greece"
  );
  assert.equal(
    normalizeImportedLocation("Lefkas, Greee"),
    "Lefkas, Greece"
  );
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
  assert.equal(
    normalizeImportedLocation("Hodge'S Creek Marina Hotel, Parham Town, ???Les Vierges Britanniques"),
    "Hodge's Creek Marina Hotel, Parham Town, British Virgin Islands"
  );
});

test("normalizeImportedMakeModel rejoins live compound-brand splits", () => {
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Fountaine",
      model: "Pajot Helia 44",
      sourceSite: "theyachtmarket",
      slug: "2014-fountaine-pajot-helia-44-nova-scotia",
    }),
    { make: "Fountaine Pajot", model: "Helia 44" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Hallberg",
      model: "Rassy 42",
      sourceSite: "theyachtmarket",
      slug: "1997-hallberg-rassy-42-balearic-islands",
    }),
    { make: "Hallberg-Rassy", model: "42" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Robertson",
      model: "And Caine Leopard 40",
      sourceSite: "theyachtmarket",
      slug: "2018-robertson-and-caine-leopard-40-",
    }),
    { make: "Robertson and Caine", model: "Leopard 40" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Robertson&caine",
      model: "Leopard 47",
      sourceSite: "sailboatlistings",
      slug: "2000-robertson-caine-leopard-47-outside-united-states",
    }),
    { make: "Robertson and Caine", model: "Leopard 47" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Robertson",
      model: "& Caine 2016 Leopard 40",
      sourceSite: "sailboatlistings",
      slug: "2016-robertson-caine-2016-leopard-40-outside-united-states",
    }),
    { make: "Robertson and Caine", model: "Leopard 40" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Camper",
      model: "And Nicholsons 60 Riviera",
      sourceSite: "theyachtmarket",
      slug: "1987-camper-and-nicholsons-60-riviera-",
    }),
    { make: "Camper & Nicholsons", model: "60 Riviera" }
  );
});

test("normalizeImportedMakeModel preserves live Saffier model code casing", () => {
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Saffier",
      model: "Se 37 Lounge",
      sourceSite: "theyachtmarket",
      slug: "2025-saffier-se-37-lounge-france",
    }),
    { make: "Saffier", model: "SE 37 Lounge" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Saffier",
      model: "Sc 8 Cabin",
      sourceSite: "theyachtmarket",
      slug: "2025-saffier-sc-8-cabin-france",
    }),
    { make: "Saffier", model: "SC 8 Cabin" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Saffier",
      model: "Sl 46",
      sourceSite: "theyachtmarket",
      slug: "2025-saffier-sl-46-france",
    }),
    { make: "Saffier", model: "SL 46" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Saffier",
      model: "32",
      sourceSite: "theyachtmarket",
      slug: "2018-saffier-32-",
    }),
    { make: "Saffier", model: "32" }
  );
});

test("normalizeImportedMakeModel avoids compound-brand overreach on unrelated boats", () => {
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Beneteau",
      model: "Oceanis 45",
      sourceSite: "theyachtmarket",
      slug: "2017-beneteau-oceanis-45-",
    }),
    { make: "Beneteau", model: "Oceanis 45" }
  );
});
