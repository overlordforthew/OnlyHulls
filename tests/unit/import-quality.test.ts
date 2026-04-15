import test from "node:test";
import assert from "node:assert/strict";

import {
  buildImportedSlugFallback,
  buildImportedSlug,
  normalizeImportedLocation,
  normalizeImportedMakeModel,
  sanitizeImportedBoatRecord,
  sanitizeImportedDimensions,
  sanitizeImportedSpecs,
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
  assert.equal(
    normalizeImportedLocation("Batamindonesia"),
    "Batam, Indonesia"
  );
  assert.equal(
    normalizeImportedLocation("Denpasarbali Indonesia"),
    "Denpasar, Bali, Indonesia"
  );
  assert.equal(
    normalizeImportedLocation("Luperon Sailing South"),
    "Luperon"
  );
  assert.equal(
    normalizeImportedLocation("(2) Horse Shoe Buoys"),
    "Horse Shoe Buoys"
  );
  assert.equal(
    normalizeImportedLocation("Southampton United Kingdom"),
    "Southampton, United Kingdom"
  );
  assert.equal(
    normalizeImportedLocation("Thunder Bay Ontario"),
    "Thunder Bay, Ontario"
  );
  assert.equal(
    normalizeImportedLocation("Kota Kinabalu Malaysia"),
    "Kota Kinabalu, Malaysia"
  );
  assert.equal(
    normalizeImportedLocation("Central Vancouver Island British Columbia"),
    "Central Vancouver Island, British Columbia"
  );
  assert.equal(
    normalizeImportedLocation("Roatan Bay Islands Honduras"),
    "Roatan Bay Islands, Honduras"
  );
  assert.equal(
    normalizeImportedLocation("San Blas Panama"),
    "San Blas, Panama"
  );
  assert.equal(
    normalizeImportedLocation("Grenada West Indies"),
    "Grenada, West Indies"
  );
  assert.equal(
    normalizeImportedLocation("Papeete Tahiti French Polynesia"),
    "Papeete, Tahiti, French Polynesia"
  );
  assert.equal(
    normalizeImportedLocation("La Paz Bcs"),
    "La Paz, BCS"
  );
  assert.equal(
    normalizeImportedLocation("Isla Mujerescancunmexico"),
    "Isla Mujeres, Cancun, Mexico"
  );
  assert.equal(
    normalizeImportedLocation("St Maarten Ducht Antilles"),
    "St Maarten, Dutch Antilles"
  );
  assert.equal(
    normalizeImportedLocation("Roatan Hn"),
    "Roatan, Honduras"
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
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Island",
      model: "Packet 460",
      sourceSite: "theyachtmarket",
      slug: "2008-island-packet-460-",
    }),
    { make: "Island Packet", model: "460" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Island",
      model: "Packet Ip-420",
      sourceSite: "sailboatlistings",
      slug: "2001-island-packet-ip-420-maryland",
    }),
    { make: "Island Packet", model: "Ip-420" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Island",
      model: "Packet Estero",
      sourceSite: "sailboatlistings",
      slug: "2012-island-packet-estero-connecticut",
    }),
    { make: "Island Packet", model: "Estero" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Cape",
      model: "Dory 36",
      sourceSite: "sailboatlistings",
      slug: "1988-cape-dory-36-florida",
    }),
    { make: "Cape Dory", model: "36" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Cape",
      model: "Dory Cape Dory 25",
      sourceSite: "sailboatlistings",
      slug: "1976-cape-dory-cape-dory-25-louisiana",
    }),
    { make: "Cape Dory", model: "25" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Cape",
      model: "Dory 1974 Cruiser",
      sourceSite: "sailboatlistings",
      slug: "1974-cape-dory-1974-cruiser-new-york",
    }),
    { make: "Cape Dory", model: "Cruiser" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Cape",
      model: "Dory 36",
      sourceSite: "apolloduck_us",
      slug: "1979-cape-dory-36-",
    }),
    { make: "Cape Dory", model: "36" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Chris",
      model: "Craft Apache",
      sourceSite: "sailboatlistings",
      slug: "1968-chris-craft-apache-connecticut",
    }),
    { make: "Chris Craft", model: "Apache" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Chris",
      model: "Craft",
      sourceSite: "sailboatlistings",
      slug: "1971-chris-craft-maryland",
    }),
    { make: "Chris Craft", model: "" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Chris",
      model: "Craft Chris Craft Sail Yacht 35",
      sourceSite: "sailboatlistings",
      slug: "1963-chris-craft-chris-craft-sail-yacht-35-texas",
    }),
    { make: "Chris Craft", model: "Sail Yacht 35" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Chriscraft",
      model: "Sparkman & Stephens Designed Sailyacht",
      sourceSite: "sailboatlistings",
      slug: "1964-chriscraft-sparkman-stephens-designed-sailyacht-florida",
    }),
    { make: "Chris Craft", model: "Sparkman & Stephens Designed Sailyacht" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Criscraft",
      model: "Carribean",
      sourceSite: "sailboatlistings",
      slug: "1974-criscraft-carribean-south-carolina",
    }),
    { make: "Chris Craft", model: "Carribean" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Chris",
      model: "White Atlantic 42",
      sourceSite: "sailboatlistings",
      slug: "2005-chris-white-atlantic-42-florida",
    }),
    { make: "Chris", model: "White Atlantic 42" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Cheoy",
      model: "Lee 47 Offshore",
      sourceSite: "theyachtmarket",
      slug: "1974-cheoy-lee-47-offshore-",
    }),
    { make: "Cheoy Lee", model: "47 Offshore" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Cheoy",
      model: "Lee Cheoy Lee 41 Offshore",
      sourceSite: "sailboatlistings",
      slug: "1977-cheoy-lee-cheoy-lee-41-offshore-south-carolina",
    }),
    { make: "Cheoy Lee", model: "41 Offshore" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Cheoy",
      model: "Lee 42 Ketch",
      sourceSite: "apolloduck_us",
      slug: "1987-cheoy-lee-42-ketch-",
    }),
    { make: "Cheoy Lee", model: "42 Ketch" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Cheoy",
      model: "Lee",
      sourceSite: "sailboatlistings",
      slug: "1977-cheoy-lee-florida",
    }),
    { make: "Cheoy Lee", model: "" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Grand",
      model: "Soleil 42 Lc",
      sourceSite: "theyachtmarket",
      slug: "2024-grand-soleil-42-lc-",
    }),
    { make: "Grand Soleil", model: "42 Lc" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Grand",
      model: "Soleil 43f Maletto",
      sourceSite: "sailboatlistings",
      slug: "2014-grand-soleil-43f-maletto-california",
    }),
    { make: "Grand Soleil", model: "43f Maletto" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Grand",
      model: "Soleil",
      sourceSite: "sailboatlistings",
      slug: "1980-grand-soleil-florida",
    }),
    { make: "Grand Soleil", model: "" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Pacific",
      model: "Seacraft Crealock 34",
      sourceSite: "sailboatlistings",
      slug: "1996-pacific-seacraft-crealock-34-maine",
    }),
    { make: "Pacific Seacraft", model: "Crealock 34" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Pacific",
      model: "Seacraft 40",
      sourceSite: "theyachtmarket",
      slug: "2002-pacific-seacraft-40-",
    }),
    { make: "Pacific Seacraft", model: "40" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Pacific",
      model: "Seacraft",
      sourceSite: "apolloduck_us",
      slug: "1980-pacific-seacraft-",
    }),
    { make: "Pacific Seacraft", model: "" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Carroll",
      model: "Marine Farr30",
      sourceSite: "sailboatlistings",
      slug: "1996-carroll-marine-farr30-new-york",
    }),
    { make: "Carroll Marine", model: "Farr30" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Carrol",
      model: "Marine 1d35",
      sourceSite: "sailboatlistings",
      slug: "1988-carrol-marine-1d35-texas",
    }),
    { make: "Carroll Marine", model: "1d35" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Carroll Marine",
      model: "Marine Frers 33",
      sourceSite: "sailboatlistings",
      slug: "1988-carroll-marine-frers-33-new-york",
    }),
    { make: "Carroll Marine", model: "Frers 33" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Carroll",
      model: "Marine",
      sourceSite: "sailboatlistings",
      slug: "1980-carroll-marine-florida",
    }),
    { make: "Carroll Marine", model: "" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Hunter",
      model: "Marine 33",
      sourceSite: "sailboatlistings",
      slug: "2008-hunter-marine-33-oklahoma",
    }),
    { make: "Hunter Marine", model: "33" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Hunter",
      model: "Marine Hunter 31",
      sourceSite: "sailboatlistings",
      slug: "1985-hunter-marine-hunter-31-new-york",
    }),
    { make: "Hunter Marine", model: "31" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Hunter",
      model: "Marine Hunter Legend 375",
      sourceSite: "sailboatlistings",
      slug: "1993-hunter-marine-hunter-legend-375-michigan",
    }),
    { make: "Hunter Marine", model: "Legend 375" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Hunter",
      model: "Marine 31",
      sourceSite: "apolloduck_us",
      slug: "1983-hunter-marine-31-",
    }),
    { make: "Hunter Marine", model: "31" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Hunter",
      model: "Marine",
      sourceSite: "apolloduck_us",
      slug: "1980-hunter-marine-",
    }),
    { make: "Hunter Marine", model: "" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Spirit",
      model: "Yachts C72",
      sourceSite: "theyachtmarket",
      slug: "2023-spirit-yachts-c72-",
    }),
    { make: "Spirit Yachts", model: "C72" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Spirit",
      model: "Yachts Spirit 76",
      sourceSite: "theyachtmarket",
      slug: "2008-spirit-yachts-spirit-76-balearic-islands",
    }),
    { make: "Spirit Yachts", model: "76" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Spirit",
      model: "Yachts Spirit 50dh",
      sourceSite: "theyachtmarket",
      slug: "2013-spirit-yachts-spirit-50dh-",
    }),
    { make: "Spirit Yachts", model: "50dh" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Spirit",
      model: "Yachts",
      sourceSite: "theyachtmarket",
      slug: "1980-spirit-yachts-",
    }),
    { make: "Spirit Yachts", model: "" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Leonardo",
      model: "Yachts Eagle 44",
      sourceSite: "sailboatlistings",
      slug: "2015-leonardo-yachts-eagle-44-california",
    }),
    { make: "Leonardo Yachts", model: "Eagle 44" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Leonardo",
      model: "Yachts Eagle 38",
      sourceSite: "theyachtmarket",
      slug: "2024-leonardo-yachts-eagle-38-balearic-islands",
    }),
    { make: "Leonardo Yachts", model: "Eagle 38" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Leonardo",
      model: "Yachts",
      sourceSite: "theyachtmarket",
      slug: "1980-leonardo-yachts-",
    }),
    { make: "Leonardo Yachts", model: "" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Italia",
      model: "Yachts 15 98",
      sourceSite: "theyachtmarket",
      slug: "2014-italia-yachts-15-98-monfalcone",
    }),
    { make: "Italia Yachts", model: "15 98" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Italia",
      model: "Yachts Italia 11 98",
      sourceSite: "theyachtmarket",
      slug: "2021-italia-yachts-italia-11-98-liguria",
    }),
    { make: "Italia Yachts", model: "11 98" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Italia Yachts",
      model: "Yachts Italia 12 98",
      sourceSite: "theyachtmarket",
      slug: "2022-italia-yachts-italia-12-98-op-de-wal-bij-delta-yacht",
    }),
    { make: "Italia Yachts", model: "12 98" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Italia",
      model: "Yachts",
      sourceSite: "theyachtmarket",
      slug: "1980-italia-yachts-",
    }),
    { make: "Italia Yachts", model: "" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Sweden",
      model: "Yachts 45",
      sourceSite: "theyachtmarket",
      slug: "2000-sweden-yachts-45-loftahammar",
    }),
    { make: "Sweden Yachts", model: "45" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Sweden Yachts",
      model: "Yachts C34",
      sourceSite: "theyachtmarket",
      slug: "1983-sweden-yachts-c34-penarth-marina",
    }),
    { make: "Sweden Yachts", model: "C34" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Sweden",
      model: "Yachts",
      sourceSite: "theyachtmarket",
      slug: "1985-sweden-yachts-stockholm",
    }),
    { make: "Sweden Yachts", model: "" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Smart",
      model: "Cat S280 Open",
      sourceSite: "sailboatlistings",
      slug: "2025-smart-cat-s280-open-california",
    }),
    { make: "Smart Cat", model: "S280 Open" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Smart Cat",
      model: "Cat S280 House",
      sourceSite: "sailboatlistings",
      slug: "2025-smart-cat-s280-house-florida",
    }),
    { make: "Smart Cat", model: "S280 House" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Smart",
      model: "Cat",
      sourceSite: "sailboatlistings",
      slug: "2025-smart-cat-florida",
    }),
    { make: "Smart Cat", model: "" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Smart",
      model: "Move 30",
      sourceSite: "sailboatlistings",
      slug: "2025-smart-move-30-florida",
    }),
    { make: "Smart", model: "Move 30" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Maine",
      model: "Cat 30",
      sourceSite: "sailboatlistings",
      slug: "1999-maine-cat-30-new-jersey",
    }),
    { make: "Maine Cat", model: "30" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Maine Cat",
      model: "Cat Maine Cat 41",
      sourceSite: "sailboatlistings",
      slug: "2007-maine-cat-maine-cat-41-virginia",
    }),
    { make: "Maine Cat", model: "41" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Maine",
      model: "Cat",
      sourceSite: "sailboatlistings",
      slug: "2002-maine-cat-panama",
    }),
    { make: "Maine Cat", model: "" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Maine",
      model: "Catboat 26",
      sourceSite: "sailboatlistings",
      slug: "1999-maine-catboat-26-maine",
    }),
    { make: "Maine", model: "Catboat 26" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Van",
      model: "De Stadt 74",
      sourceSite: "sailboatlistings",
      slug: "1993-van-de-stadt-74-outside-united-states",
    }),
    { make: "Van De Stadt", model: "74" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Van",
      model: "De Stadt 30 Vita",
      sourceSite: "theyachtmarket",
      slug: "1995-van-de-stadt-30-vita-",
    }),
    { make: "Van De Stadt", model: "30 Vita" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Van",
      model: "De Stadt Van De Stadt 44",
      sourceSite: "sailboatlistings",
      slug: "1993-van-de-stadt-van-de-stadt-44-florida",
    }),
    { make: "Van De Stadt", model: "44" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Van",
      model: "De Stadt",
      sourceSite: "sailboatlistings",
      slug: "1980-van-de-stadt-florida",
    }),
    { make: "Van De Stadt", model: "" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "North",
      model: "American Yachts Spirit 28",
      sourceSite: "sailboatlistings",
      slug: "1980-north-american-yachts-spirit-28-connecticut",
    }),
    { make: "North American Yachts", model: "Spirit 28" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "North",
      model: "American Yachts",
      sourceSite: "sailboatlistings",
      slug: "1980-north-american-yachts-",
    }),
    { make: "North American Yachts", model: "" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Graham",
      model: "Collingwood Boatbuilders Dixon 47",
      sourceSite: "theyachtmarket",
      slug: "2002-graham-collingwood-boatbuilders-dixon-47-falmouth",
    }),
    { make: "Graham Collingwood Boatbuilders", model: "Dixon 47" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Graham",
      model: "Collingwood Boatbuilders",
      sourceSite: "theyachtmarket",
      slug: "1980-graham-collingwood-boatbuilders-",
    }),
    { make: "Graham Collingwood Boatbuilders", model: "" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Cornish",
      model: "Crabbers 26",
      sourceSite: "theyachtmarket",
      slug: "2013-cornish-crabbers-26-bangor",
    }),
    { make: "Cornish Crabbers", model: "26" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Cornish",
      model: "Crabbers Crabber 24 Mkv",
      sourceSite: "theyachtmarket",
      slug: "2019-cornish-crabbers-crabber-24-mkv-plymouth",
    }),
    { make: "Cornish Crabbers", model: "Crabber 24 Mkv" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Cornish Crabbers",
      model: "Crabbers Pilot Cutter 30",
      sourceSite: "theyachtmarket",
      slug: "2006-cornish-crabbers-pilot-cutter-30-maliano",
    }),
    { make: "Cornish Crabbers", model: "Pilot Cutter 30" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Cornish",
      model: "Crabbers",
      sourceSite: "theyachtmarket",
      slug: "2005-cornish-crabbers-hampshire",
    }),
    { make: "Cornish Crabbers", model: "" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Cabo",
      model: "Rico 38",
      sourceSite: "sailboatlistings",
      slug: "1987-cabo-rico-38-florida",
    }),
    { make: "Cabo Rico", model: "38" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Cabo",
      model: "Rico Cabo Rico 34",
      sourceSite: "sailboatlistings",
      slug: "1989-cabo-rico-cabo-rico-34-north-carolina",
    }),
    { make: "Cabo Rico", model: "34" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Cabo",
      model: "Rico",
      sourceSite: "sailboatlistings",
      slug: "1989-cabo-rico-mississippi",
    }),
    { make: "Cabo Rico", model: "" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Cabo Rico",
      model: "Rico Pilothouse Cutter 42",
      sourceSite: "sailboatlistings",
      slug: "2003-cabo-rico-pilothouse-cutter-42-washington",
    }),
    { make: "Cabo Rico", model: "Pilothouse Cutter 42" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Hans",
      model: "Christian 38t",
      sourceSite: "sailboatlistings",
      slug: "1976-hans-christian-38t-puerto-rico",
    }),
    { make: "Hans Christian", model: "38t" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Hans",
      model: "Christian Yachts Hans Christian 43",
      sourceSite: "sailboatlistings",
      slug: "1984-hans-christian-yachts-hans-christian-43-maine",
    }),
    { make: "Hans Christian", model: "43" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Hans",
      model: "Christan 34 Ft",
      sourceSite: "sailboatlistings",
      slug: "1978-hans-christan-34-ft-trinidad",
    }),
    { make: "Hans Christian", model: "34 Ft" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Hans",
      model: "Christian",
      sourceSite: "sailboatlistings",
      slug: "1986-hans-christian-maryland",
    }),
    { make: "Hans Christian", model: "" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Hans Christian",
      model: "Christian",
      sourceSite: "sailboatlistings",
      slug: "1986-hans-christian-maryland",
    }),
    { make: "Hans Christian", model: "" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Hans Christian",
      model: "Christian 43",
      sourceSite: "theyachtmarket",
      slug: "1989-hans-christian-43-contact-de-valk-corfu",
    }),
    { make: "Hans Christian", model: "43" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Bruce",
      model: "Roberts 65",
      sourceSite: "theyachtmarket",
      slug: "1994-bruce-roberts-65-at-request",
    }),
    { make: "Bruce Roberts", model: "65" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Bruce",
      model: "Roberts Bruce Roberts 37 Cutter",
      sourceSite: "sailboatlistings",
      slug: "1985-bruce-roberts-bruce-roberts-37-cutter-trinidad",
    }),
    { make: "Bruce Roberts", model: "37 Cutter" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Bruce",
      model: "Robert 53 Pilot House Ketch",
      sourceSite: "sailboatlistings",
      slug: "1982-bruce-robert-53-pilot-house-ketch-bali-serangan-harbour",
    }),
    { make: "Bruce Roberts", model: "53 Pilot House Ketch" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Bruce",
      model: "Roberts",
      sourceSite: "sailboatlistings",
      slug: "2005-bruce-roberts-ohio",
    }),
    { make: "Bruce Roberts", model: "" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Bruce Roberts",
      model: "Roberts Ketch",
      sourceSite: "sailboatlistings",
      slug: "1986-bruce-roberts-ketch-florida",
    }),
    { make: "Bruce Roberts", model: "" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Bruce Roberts",
      model: "Roberts",
      sourceSite: "sailboatlistings",
      slug: "2005-bruce-roberts-ohio",
    }),
    { make: "Bruce Roberts", model: "" }
  );
});

test("sanitizeImportedBoatRecord drops unsafe imported source and hero urls", () => {
  const sanitized = sanitizeImportedBoatRecord({
    make: "Lagoon",
    model: "42",
    source_site: "theyachtmarket",
    source_url: "javascript:alert(1)",
    hero_url: "data:text/html,<script>alert(1)</script>",
    specs: {},
  });

  assert.equal(sanitized.source_url, null);
  assert.equal(sanitized.hero_url, null);
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
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "E G",
      model: "Van De Stadt Rebel 41",
      sourceSite: "sailboatlistings",
      slug: "1968-e-g-van-de-stadt-rebel-41-washington",
    }),
    { make: "E G", model: "Van De Stadt Rebel 41" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "North",
      model: "Wind 50",
      sourceSite: "theyachtmarket",
      slug: "1996-north-wind-50-",
    }),
    { make: "North", model: "Wind 50" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Hans",
      model: "Alma 42",
      sourceSite: "theyachtmarket",
      slug: "2004-hans-alma-42-kissamos",
    }),
    { make: "Hans", model: "Alma 42" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Graham",
      model: "& Schlageter G&s 35",
      sourceSite: "sailboatlistings",
      slug: "1988-graham-schlageter-g-s-35-ohio",
    }),
    { make: "Graham", model: "& Schlageter G&s 35" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Bruce",
      model: "Askew Steel Pilothouse Expedition World Cruiser",
      sourceSite: "sailboatlistings",
      slug: "1999-bruce-askew-steel-pilothouse-expedition-world-cruiser-kota-kinabalu-malaysia",
    }),
    { make: "Bruce", model: "Askew Steel Pilothouse Expedition World Cruiser" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Bruce",
      model: "Farr Libera",
      sourceSite: "sailboatlistings",
      slug: "1983-bruce-farr-libera-hungary",
    }),
    { make: "Bruce", model: "Farr Libera" }
  );
});

test("normalizeImportedMakeModel promotes out of generic sailboat listing makes", () => {
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Sailboat",
      model: "Benetau Idille 51",
      sourceSite: "sailboatlistings",
      slug: "1987-sailboat-benetau-idille-51-outside-united-states",
    }),
    { make: "Benetau", model: "Idille 51" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Yacht",
      model: "Constructors Cascade 36",
      sourceSite: "sailboatlistings",
      slug: "1986-yacht-constructors-cascade-36-outside-united-states",
    }),
    { make: "Cascade", model: "36" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Performance",
      model: "Cruising Gemini 3000",
      sourceSite: "sailboatlistings",
      slug: "1989-performance-cruising-gemini-3000-california",
    }),
    { make: "Performance Cruising", model: "Gemini 3000" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Performance",
      model: "Cruising Inc Gemini 105",
      sourceSite: "sailboatlistings",
      slug: "2008-performance-cruising-inc-gemini-105-british-virgin-islands",
    }),
    { make: "Performance Cruising", model: "Gemini 105" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Performance Cruising",
      model: "Inc Gemini 105mc",
      sourceSite: "sailboatlistings",
      slug: "2006-performance-cruising-inc-gemini-105mc-florida",
    }),
    { make: "Performance Cruising", model: "Gemini 105mc" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Performance Cruising",
      model: "Inc",
      sourceSite: "sailboatlistings",
      slug: "1998-performance-cruising-inc-florida",
    }),
    { make: "Performance Cruising", model: "" }
  );
});

test("normalizeImportedMakeModel strips unhelpful sailboatlistings year-only and partnership models", () => {
  assert.deepEqual(
    normalizeImportedMakeModel({
      year: 1978,
      make: "C&C",
      model: "1978",
      sourceSite: "sailboatlistings",
      slug: "1978-c-c-1978-texas",
    }),
    { make: "C&C", model: "" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      year: 2012,
      make: "Dufour",
      model: "Fractional Ownership Sailboat Partnership 425 Grand Large",
      sourceSite: "sailboatlistings",
      slug: "2012-dufour-fractional-ownership-sailboat-partnership-425-grand-large-culebra",
    }),
    { make: "Dufour", model: "425 Grand Large" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      year: 2008,
      make: "Fountaine Pajot",
      model: "Salina Fractional Ownership",
      sourceSite: "sailboatlistings",
      slug: "2008-fountaine-pajot-salina-fractional-ownership-st-thomas",
    }),
    { make: "Fountaine Pajot", model: "Salina" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      year: 1986,
      make: "O'Day",
      model: "Sold",
      sourceSite: "sailboatlistings",
      slug: "1986-o-day-sold-new-york",
    }),
    { make: "O'Day", model: "" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      year: 2007,
      make: "Beneteau",
      model: "343 Deal Pending 10/05/18",
      sourceSite: "sailboatlistings",
      slug: "2007-beneteau-343-deal-pending-10-05-18-shediac-new-brunswick",
    }),
    { make: "Beneteau", model: "343" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      year: 1980,
      make: "Downeaster",
      model: "Ketch New",
      sourceSite: "sailboatlistings",
      slug: "1980-downeaster-ketch-new-new-york",
    }),
    { make: "Downeaster", model: "" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      year: 2004,
      make: "Beneteau",
      model: "Sold 473",
      sourceSite: "sailboatlistings",
      slug: "2004-beneteau-sold-473-texas",
    }),
    { make: "Beneteau", model: "473" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      year: 1974,
      make: "Prout",
      model: "Sale Pending Sold 35",
      sourceSite: "sailboatlistings",
      slug: "1974-prout-sale-pending-sold-35-texas",
    }),
    { make: "Prout", model: "35" }
  );
});

test("normalizeImportedMakeModel restores dotted Bali model codes", () => {
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Bali",
      model: "5 2",
      sourceSite: "theyachtmarket",
      slug: "2026-bali-5-2-catalonia",
    }),
    { make: "Bali", model: "5.2" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Bali",
      model: "5 8 Open Space",
      sourceSite: "theyachtmarket",
      slug: "2026-bali-5-8-catalonia",
    }),
    { make: "Bali", model: "5.8 Open Space" }
  );
});

test("sanitizeImportedDimensions repairs Bali values inflated by bad source units", () => {
  assert.deepEqual(
    sanitizeImportedDimensions({
      make: "Bali",
      model: "5.2",
      sourceSite: "theyachtmarket",
      loa: 170.6,
      beam: 88.6,
      draft: 6.6,
    }),
    { loa: 52, beam: 27, draft: 6.6 }
  );
});

test("sanitizeImportedDimensions drops impossible Bali draft after conversion check fails", () => {
  assert.deepEqual(
    sanitizeImportedDimensions({
      make: "Bali",
      model: "5.4",
      sourceSite: "theyachtmarket",
      loa: 55.6,
      beam: 28.7,
      draft: 53.8,
    }),
    { loa: 55.6, beam: 28.7, draft: null }
  );
});

test("sanitizeImportedDimensions repairs compact sailboatlistings beam values", () => {
  assert.deepEqual(
    sanitizeImportedDimensions({
      make: "Irwin",
      model: "43cc",
      sourceSite: "sailboatlistings",
      loa: 45.6,
      beam: 1358,
      draft: 4.9,
    }),
    { loa: 45.6, beam: 13.6, draft: 4.9 }
  );
  assert.deepEqual(
    sanitizeImportedDimensions({
      make: "Catalina",
      model: "Tall Rig",
      sourceSite: "sailboatlistings",
      loa: 36,
      beam: 1111,
      draft: 5,
    }),
    { loa: 36, beam: 11.9, draft: 5 }
  );
});

test("sanitizeImportedDimensions drops sailboatlistings draft values that stay implausible", () => {
  assert.deepEqual(
    sanitizeImportedDimensions({
      make: "Catalina",
      model: "Tall Rig",
      sourceSite: "sailboatlistings",
      loa: 27,
      beam: 810,
      draft: 11,
    }),
    { loa: 27, beam: 8.8, draft: null }
  );
});

test("sanitizeImportedDimensions can infer sailboatlistings loa from model for compact repairs", () => {
  assert.deepEqual(
    sanitizeImportedDimensions({
      make: "Crealock",
      model: "37",
      sourceSite: "sailboatlistings",
      loa: null,
      beam: 1011,
      draft: 56,
    }),
    { loa: null, beam: 10.9, draft: 5.6 }
  );
  assert.deepEqual(
    sanitizeImportedDimensions({
      make: "Seidelmann",
      model: "299",
      sourceSite: "sailboatlistings",
      loa: null,
      beam: 113,
      draft: 55,
    }),
    { loa: null, beam: 11.3, draft: 5.5 }
  );
});

test("sanitizeImportedSpecs persists normalized vessel type for matching", () => {
  assert.equal(
    sanitizeImportedSpecs(
      {
        rig_type: "masthead sloop",
      },
      {
        make: "Dufour",
        model: "390 Grand Large",
        sourceSite: "theyachtmarket",
      }
    ).vessel_type,
    "monohull"
  );

  assert.equal(
    sanitizeImportedSpecs(
      {
        rig_type: "sloop",
      },
      {
        make: "Lagoon",
        model: "380",
        sourceSite: "theyachtmarket",
      }
    ).vessel_type,
    "catamaran"
  );
});

test("sanitizeImportedBoatRecord normalizes make model, location, and specs together", () => {
  const normalized = sanitizeImportedBoatRecord({
    make: "Bali",
    model: "5 2",
    slug: "2026-bali-5-2-catalonia",
    source_site: "theyachtmarket",
    location_text: "San Juan Puerto Rico",
    specs: {
      loa: 170.6,
      beam: 88.6,
      draft: 6.6,
      rig_type: "catamaran",
    },
  });

  assert.equal(normalized.model, "5.2");
  assert.equal(normalized.location_text, "San Juan, Puerto Rico");
  assert.deepEqual(normalized.specs, {
    loa: 52,
    beam: 27,
    draft: 6.6,
    rig_type: "catamaran",
    vessel_type: "catamaran",
  });
});

test("sanitizeImportedBoatRecord keeps intentionally blank normalized models blank", () => {
  const hansChristian = sanitizeImportedBoatRecord({
    year: 1986,
    make: "Hans Christian",
    model: "Christian",
    slug: "1986-hans-christian-maryland",
    source_site: "sailboatlistings",
    location_text: "Maryland",
    specs: {
      loa: 38,
      rig_type: "other",
    },
  });

  assert.equal(hansChristian.make, "Hans Christian");
  assert.equal(hansChristian.model, "");
  assert.deepEqual(hansChristian.specs, {
    loa: 38,
    rig_type: "other",
    vessel_type: "monohull",
  });

  const bruceRoberts = sanitizeImportedBoatRecord({
    year: 2005,
    make: "Bruce Roberts",
    model: "Roberts",
    slug: "2005-bruce-roberts-ohio",
    source_site: "sailboatlistings",
    location_text: "Ohio",
    specs: {
      loa: 53,
      rig_type: "ketch",
    },
  });

  assert.equal(bruceRoberts.make, "Bruce Roberts");
  assert.equal(bruceRoberts.model, "");
  assert.deepEqual(bruceRoberts.specs, {
    loa: 53,
    rig_type: "ketch",
    vessel_type: "monohull",
  });
});

test("buildImportedSlug uses cleaned location lead token", () => {
  assert.equal(
    buildImportedSlug(2003, "Robertson and Caine", "Leopard 47 Catamaran", "British Virgin Islands"),
    "2003-robertson-and-caine-leopard-47-catamaran-british-virgin-islands"
  );
});

test("buildImportedSlugFallback appends deterministic suffix", () => {
  assert.equal(
    buildImportedSlugFallback(
      "1983-irwin-38-center-cockpit-mark-2-la-cruz-marina-near-puerto-vallarta",
      "4cc610fb-435a-4dd4-88f7-934f655964b3"
    ),
    "1983-irwin-38-center-cockpit-mark-2-la-cruz-marina-near-puerto-vallarta-4cc610"
  );
});
