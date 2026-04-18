import test from "node:test";
import assert from "node:assert/strict";

import {
  buildImportedSlugFallback,
  buildImportedSlug,
  buildImportQualityFlags,
  buildImportedSummary,
  mergeStickyImportQualityFlags,
  hasImportedSaleStatusMarker,
  normalizeImportedLocation,
  normalizeImportedMakeModel,
  resolveImportedDedupLocationText,
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

test("normalizeImportedLocation trims narrative tails from scraped location text", () => {
  assert.equal(
    normalizeImportedLocation(
      "Viewing Location: We are scheduling viewings as we sail around Bahamas with family visiting in February"
    ),
    "Bahamas"
  );
  assert.equal(
    normalizeImportedLocation(
      "Cancun, Mexico, The Vessel Was Previously Part Of A Charter Fleet And Has Recently Been Removed From Service"
    ),
    "Cancun, Mexico"
  );
  assert.equal(
    normalizeImportedLocation(
      "League City, Tx (Texas) Jewel Is A 2018 Lagoon 42 For Sale By Broker."
    ),
    "League City, TX"
  );
  assert.equal(
    normalizeImportedLocation(
      "Pangkor Marina, A Duty And Tax Free Port For International Yachts"
    ),
    "Pangkor Marina"
  );
  assert.equal(
    normalizeImportedLocation(
      "Toronto, Canada - Out Of Water Survey 2024 Available Upon Request For Serious Inquiry"
    ),
    "Toronto, Canada"
  );
  assert.equal(
    normalizeImportedLocation("Treasure Cay Abaco Bahamas Duty Paid"),
    "Treasure Cay Abaco, Bahamas"
  );
  assert.equal(
    normalizeImportedLocation("Nassau - The, Bahamas"),
    "Nassau, Bahamas"
  );
});

test("resolveImportedDedupLocationText matches the importer update target", () => {
  assert.equal(
    resolveImportedDedupLocationText("Nassau, Bahamas", "Viewing Location: Bahamas"),
    "Nassau, Bahamas"
  );
  assert.equal(resolveImportedDedupLocationText("", ""), "");
  assert.equal(resolveImportedDedupLocationText("", null), null);
  assert.equal(
    resolveImportedDedupLocationText("", "Outside United States"),
    "Outside United States"
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
      make: "Fountain",
      model: "Pajot Lucia 40",
      sourceSite: "sailboatlistings",
      slug: "2018-fountain-pajot-lucia-40-southern-caribbean",
    }),
    { make: "Fountaine Pajot", model: "Lucia 40" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Fontaine",
      model: "Pajot Venezia",
      sourceSite: "sailboatlistings",
      slug: "1995-fontaine-pajot-venezia-grenada",
    }),
    { make: "Fountaine Pajot", model: "Venezia" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Fountains",
      model: "Pajot Eleuthera",
      sourceSite: "sailboatlistings",
      slug: "2006-fountains-pajot-eleuthera-florida",
    }),
    { make: "Fountaine Pajot", model: "Eleuthera" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Fountain Pajot",
      model: "Lavezzi",
      sourceSite: "sailboatlistings",
      slug: "2009-fountain-pajot-lavezzi-antigua",
    }),
    { make: "Fountaine Pajot", model: "Lavezzi" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Fountaine",
      model: "Pajot Fp Saba 50",
      sourceSite: "catamarans_com",
      slug: "2016-fountaine-pajot-fp-saba-50-panama",
    }),
    { make: "Fountaine Pajot", model: "Saba 50" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Fountaine",
      model: "Pajot 44 Helia",
      sourceSite: "catamaransite",
      slug: "2014-fountaine-pajot-44-helia-fort-lauderdale",
    }),
    { make: "Fountaine Pajot", model: "44 Helia" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Fountaine Pajot",
      model: "Fp 41",
      sourceSite: "theyachtmarket",
      slug: "2025-fountaine-pajot-fp-41-united-kingdom",
    }),
    { make: "Fountaine Pajot", model: "41" }
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
      make: "Jensen",
      model: "Marine Cal 25",
      sourceSite: "sailboatlistings",
      slug: "1966-jensen-marine-cal-25-california",
    }),
    { make: "Cal", model: "25" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Cal",
      model: "Jensen Marine Cal 2-27",
      sourceSite: "sailboatlistings",
      slug: "1976-cal-jensen-marine-cal-2-27-california",
    }),
    { make: "Cal", model: "2-27" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Jensen",
      model: "Cal 35 Mkii",
      sourceSite: "theyachtmarket",
      slug: "1985-jensen-cal-35-mkii-warwick",
    }),
    { make: "Cal", model: "35 Mkii" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Cal-Jensen",
      model: "Cal Jensen",
      sourceSite: "sailboatlistings",
      slug: "1969-cal-jensen-cal-jensen-california",
    }),
    { make: "Cal", model: "" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Jensen",
      model: "Marinecal Boats Cal29-2",
      sourceSite: "sailboatlistings",
      slug: "1975-jensen-marinecal-boats-cal29-2-under-cockpit",
    }),
    { make: "Cal", model: "29-2" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Jensen",
      model: "Catalina 30",
      sourceSite: "sailboatlistings",
      slug: "1978-jensen-catalina-30-california",
    }),
    { make: "Jensen", model: "Catalina 30" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Rossiter",
      model: "Yachts Curlew 32",
      sourceSite: "theyachtmarket",
      slug: "1984-rossiter-yachts-curlew-32-falmouth",
    }),
    { make: "Rossiter Yachts", model: "Curlew 32" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Rossiter Yachts",
      model: "Curlew 32",
      sourceSite: "theyachtmarket",
      slug: "1984-rossiter-yachts-curlew-32-falmouth",
    }),
    { make: "Rossiter Yachts", model: "Curlew 32" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Rossiter",
      model: "33",
      sourceSite: "sailboatlistings",
      slug: "1983-rossiter-33-maine",
    }),
    { make: "Rossiter", model: "33" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Comuzzi",
      model: "Yachts C32 Sport",
      sourceSite: "theyachtmarket",
      slug: "2024-comuzzi-yachts-c32-sport-adriatic-sea",
    }),
    { make: "Comuzzi Yachts", model: "C32 Sport" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Comuzzi Yachts",
      model: "Yachts C32 Sport",
      sourceSite: "theyachtmarket",
      slug: "2024-comuzzi-yachts-c32-sport-adriatic-sea",
    }),
    { make: "Comuzzi Yachts", model: "C32 Sport" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Comuzzi",
      model: "32",
      sourceSite: "sailboatlistings",
      slug: "2024-comuzzi-32-adriatic-sea",
    }),
    { make: "Comuzzi", model: "32" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Oqs",
      model: "Yachts Ocean Explorer 60",
      sourceSite: "theyachtmarket",
      slug: "2019-oqs-yachts-ocean-explorer-60-fort-lauderdale",
    }),
    { make: "OQS Yachts", model: "Ocean Explorer 60" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Oqs Yachts",
      model: "Yachts Ocean Explorer 60",
      sourceSite: "theyachtmarket",
      slug: "2019-oqs-yachts-ocean-explorer-60-fort-lauderdale",
    }),
    { make: "OQS Yachts", model: "Ocean Explorer 60" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Oqs",
      model: "Ocean Explorer 60",
      sourceSite: "theyachtmarket",
      slug: "2019-oqs-ocean-explorer-60-fort-lauderdale",
    }),
    { make: "OQS", model: "Ocean Explorer 60" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Mcp",
      model: "Yachts Global Exp 68",
      sourceSite: "theyachtmarket",
      slug: "2025-mcp-yachts-global-exp-68-genoa",
    }),
    { make: "MCP Yachts", model: "Global Exp 68" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Mcp Yachts",
      model: "Global Exp 68",
      sourceSite: "theyachtmarket",
      slug: "2025-mcp-yachts-global-exp-68-genoa",
    }),
    { make: "MCP Yachts", model: "Global Exp 68" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Mcp",
      model: "Global Exp 68",
      sourceSite: "theyachtmarket",
      slug: "2025-mcp-global-exp-68-genoa",
    }),
    { make: "MCP", model: "Global Exp 68" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Nauta",
      model: "Yachts 54",
      sourceSite: "theyachtmarket",
      slug: "1990-nauta-yachts-54-brittany",
    }),
    { make: "Nauta Yachts", model: "54" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Nauta Yachts",
      model: "54",
      sourceSite: "theyachtmarket",
      slug: "1990-nauta-yachts-54-brittany",
    }),
    { make: "Nauta Yachts", model: "54" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Nauta",
      model: "Wind 46",
      sourceSite: "theyachtmarket",
      slug: "1977-nauta-wind-46-mallorca",
    }),
    { make: "Nauta", model: "Wind 46" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Mastori",
      model: "Yachts Gulet",
      sourceSite: "theyachtmarket",
      slug: "2007-mastori-yachts-gulet-bodrum",
    }),
    { make: "Mastori Yachts", model: "Gulet" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Mastori Yachts",
      model: "Gulet",
      sourceSite: "theyachtmarket",
      slug: "2007-mastori-yachts-gulet-bodrum",
    }),
    { make: "Mastori Yachts", model: "Gulet" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Mastori",
      model: "Gulet",
      sourceSite: "theyachtmarket",
      slug: "2007-mastori-gulet-bodrum",
    }),
    { make: "Mastori", model: "Gulet" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Morris",
      model: "Yachts 46",
      sourceSite: "theyachtmarket",
      slug: "1997-morris-yachts-46-kremic-marina",
    }),
    { make: "Morris Yachts", model: "46" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Morris Yachts",
      model: "Yachts 46",
      sourceSite: "theyachtmarket",
      slug: "1997-morris-yachts-46-kremic-marina",
    }),
    { make: "Morris Yachts", model: "46" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Morris",
      model: "46",
      sourceSite: "theyachtmarket",
      slug: "1997-morris-46-kremic-marina",
    }),
    { make: "Morris", model: "46" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Magic",
      model: "Yachts 96 Catamaran",
      sourceSite: "theyachtmarket",
      slug: "2015-magic-yachts-96-catamaran-french-riviera",
    }),
    { make: "Magic Yachts", model: "96 Catamaran" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Magic Yachts",
      model: "Yachts 96 Catamaran",
      sourceSite: "theyachtmarket",
      slug: "2015-magic-yachts-96-catamaran-french-riviera",
    }),
    { make: "Magic Yachts", model: "96 Catamaran" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Maxi",
      model: "Magic",
      sourceSite: "theyachtmarket",
      slug: "1984-maxi-magic-siek",
    }),
    { make: "Maxi", model: "Magic" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Fast",
      model: "Yachts 42",
      sourceSite: "theyachtmarket",
      slug: "2002-fast-yachts-42-d-n-laoghaire",
    }),
    { make: "Fast Yachts", model: "42" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Fast Yachts",
      model: "Yachts 42",
      sourceSite: "theyachtmarket",
      slug: "2002-fast-yachts-42-d-n-laoghaire",
    }),
    { make: "Fast Yachts", model: "42" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Fast",
      model: "Yachts 50",
      sourceSite: "theyachtmarket",
      slug: "2003-fast-50-marseille",
    }),
    { make: "Fast", model: "Yachts 50" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "M A",
      model: "T Yachts 1220",
      sourceSite: "theyachtmarket",
      slug: "2023-m-a-t-yachts-1220-bulgaria",
    }),
    { make: "M A T Yachts", model: "1220" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "M A T Yachts",
      model: "1220",
      sourceSite: "theyachtmarket",
      slug: "2023-m-a-t-yachts-1220-bulgaria",
    }),
    { make: "M A T Yachts", model: "1220" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "M A",
      model: "T Yachts 1070",
      sourceSite: "theyachtmarket",
      slug: "2023-m-a-t-yachts-1070-bulgaria",
    }),
    { make: "M A", model: "T Yachts 1070" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "More",
      model: "Boats 55",
      sourceSite: "theyachtmarket",
      slug: "2016-more-boats-55-at-request",
    }),
    { make: "More Boats", model: "55" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "More",
      model: "Boats 55",
      sourceSite: "theyachtmarket",
      slug: "2016-more-55-at-request",
    }),
    { make: "More", model: "Boats 55" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Caledonia",
      model: "Marine Systems Halifax 37",
      sourceSite: "sailboatlistings",
      slug: "2019-caledonia-marine-systems-halifax-37-vieques",
    }),
    { make: "Caledonia Marine Systems", model: "Halifax 37" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Caledonia",
      model: "Marine Systems Halifax 37",
      sourceSite: "sailboatlistings",
      slug: "2019-caledonia-halifax-37-vieques",
    }),
    { make: "Caledonia", model: "Marine Systems Halifax 37" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Tradition",
      model: "Marine Tm 42",
      sourceSite: "theyachtmarket",
      slug: "2001-tradition-marine-tm-42-barcelona",
    }),
    { make: "Tradition Marine", model: "Tm 42" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Tradition Marine",
      model: "Marine Tm 42",
      sourceSite: "theyachtmarket",
      slug: "2001-tradition-marine-tm-42-barcelona",
    }),
    { make: "Tradition Marine", model: "Tm 42" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Tradition",
      model: "Marine Tm 42",
      sourceSite: "theyachtmarket",
      slug: "2001-tradition-tm-42-barcelona",
    }),
    { make: "Tradition", model: "Marine Tm 42" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Nortech",
      model: "Marine Hood 50",
      sourceSite: "theyachtmarket",
      slug: "1993-nortech-marine-hood-50-sotogrande",
    }),
    { make: "Nortech Marine", model: "Hood 50" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Nortech Marine",
      model: "Marine Hood 50",
      sourceSite: "theyachtmarket",
      slug: "1993-nortech-marine-hood-50-sotogrande",
    }),
    { make: "Nortech Marine", model: "Hood 50" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Nortech",
      model: "Marine Hood 50",
      sourceSite: "theyachtmarket",
      slug: "1993-nortech-hood-50-sotogrande",
    }),
    { make: "Nortech", model: "Marine Hood 50" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "King",
      model: "Marine Nmyd Irc One Off 54",
      sourceSite: "theyachtmarket",
      slug: "2017-king-marine-nmyd-irc-one-off-54-hamble",
    }),
    { make: "King Marine", model: "Nmyd Irc One Off 54" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "King Marine",
      model: "Marine Nmyd Irc One Off 54",
      sourceSite: "theyachtmarket",
      slug: "2017-king-marine-nmyd-irc-one-off-54-hamble",
    }),
    { make: "King Marine", model: "Nmyd Irc One Off 54" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "King",
      model: "Marine Nmyd Irc One Off 54",
      sourceSite: "theyachtmarket",
      slug: "2017-king-nmyd-irc-one-off-54-hamble",
    }),
    { make: "King", model: "Marine Nmyd Irc One Off 54" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Squalt",
      model: "Marine Ck 64",
      sourceSite: "theyachtmarket",
      slug: "2019-squalt-marine-ck-64-le-marin",
    }),
    { make: "Squalt Marine", model: "Ck 64" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Squalt Marine",
      model: "Marine Ck 64",
      sourceSite: "theyachtmarket",
      slug: "2019-squalt-marine-ck-64-le-marin",
    }),
    { make: "Squalt Marine", model: "Ck 64" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Squalt",
      model: "Marine Ck 64",
      sourceSite: "theyachtmarket",
      slug: "2019-squalt-ck-64-le-marin",
    }),
    { make: "Squalt", model: "Marine Ck 64" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Green",
      model: "Marine Volvo 65",
      sourceSite: "theyachtmarket",
      slug: "2014-green-marine-volvo-65-lisbon",
    }),
    { make: "Green Marine", model: "Volvo 65" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Green Marine",
      model: "Marine Volvo 65",
      sourceSite: "theyachtmarket",
      slug: "2014-green-marine-volvo-65-lisbon",
    }),
    { make: "Green Marine", model: "Volvo 65" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Green",
      model: "Marine Volvo 65",
      sourceSite: "theyachtmarket",
      slug: "2014-green-volvo-65-lisbon",
    }),
    { make: "Green", model: "Marine Volvo 65" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Fastnet",
      model: "Marine Fastnet 34",
      sourceSite: "theyachtmarket",
      slug: "1988-fastnet-marine-fastnet-34-southampton",
    }),
    { make: "Fastnet Marine", model: "Fastnet 34" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Fastnet Marine",
      model: "Marine Fastnet 34",
      sourceSite: "theyachtmarket",
      slug: "1988-fastnet-marine-fastnet-34-southampton",
    }),
    { make: "Fastnet Marine", model: "Fastnet 34" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Fastnet",
      model: "Marine Fastnet 34",
      sourceSite: "theyachtmarket",
      slug: "1988-fastnet-fastnet-34-southampton",
    }),
    { make: "Fastnet", model: "Marine Fastnet 34" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Blakes",
      model: "Marine Cruising Folkboat",
      sourceSite: "theyachtmarket",
      slug: "1972-blakes-marine-cruising-folkboat-portland-marina",
    }),
    { make: "Blakes Marine", model: "Cruising Folkboat" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Blakes Marine",
      model: "Marine Cruising Folkboat",
      sourceSite: "theyachtmarket",
      slug: "1972-blakes-marine-cruising-folkboat-portland-marina",
    }),
    { make: "Blakes Marine", model: "Cruising Folkboat" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Blakes",
      model: "Marine Cruising Folkboat",
      sourceSite: "theyachtmarket",
      slug: "1972-blakes-cruising-folkboat-portland-marina",
    }),
    { make: "Blakes", model: "Marine Cruising Folkboat" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Shark",
      model: "Marine 50",
      sourceSite: "theyachtmarket",
      slug: "2017-shark-marine-50-marseille",
    }),
    { make: "Shark Marine", model: "50" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Shark Marine",
      model: "Marine 50",
      sourceSite: "theyachtmarket",
      slug: "2017-shark-marine-50-marseille",
    }),
    { make: "Shark Marine", model: "50" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Shark",
      model: "Marine 50",
      sourceSite: "theyachtmarket",
      slug: "2017-shark-50-marseille",
    }),
    { make: "Shark", model: "Marine 50" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Character",
      model: "Boats Lytham Pilot",
      sourceSite: "theyachtmarket",
      slug: "2021-character-boats-lytham-pilot-windermere",
    }),
    { make: "Character Boats", model: "Lytham Pilot" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Character",
      model: "Boats Lytham Pilot",
      sourceSite: "theyachtmarket",
      slug: "2021-character-lytham-pilot-windermere",
    }),
    { make: "Character", model: "Boats Lytham Pilot" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Cheverton",
      model: "Boats 40",
      sourceSite: "theyachtmarket",
      slug: "1984-cheverton-boats-40-ardrishaig",
    }),
    { make: "Cheverton Boats", model: "40" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Cheverton Boats",
      model: "Boats Crusader",
      sourceSite: "theyachtmarket",
      slug: "1962-cheverton-boats-crusader-suffolk-yacht-harbour",
    }),
    { make: "Cheverton Boats", model: "Crusader" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Cheverton",
      model: "Boats 40",
      sourceSite: "theyachtmarket",
      slug: "1984-cheverton-40-ardrishaig",
    }),
    { make: "Cheverton", model: "Boats 40" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "X Yachts",
      model: "X4 9",
      sourceSite: "theyachtmarket",
      slug: "2019-x-yachts-x4-9-en-route-barcelona-arriving-late-spring-2026",
    }),
    { make: "X-Yachts", model: "X4.9" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "X-Yachts",
      model: "X4 9 Mkii",
      sourceSite: "theyachtmarket",
      slug: "2026-x-yachts-x4-9-mkii-haderslev",
    }),
    { make: "X-Yachts", model: "X4.9 Mkii" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "X-Yachts",
      model: "X 4 6",
      sourceSite: "theyachtmarket",
      slug: "2021-x-yachts-x-4-6-boston",
    }),
    { make: "X-Yachts", model: "X 4.6" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "X-Yachts",
      model: "X 50",
      sourceSite: "theyachtmarket",
      slug: "2004-x-yachts-x-50-tyrrhenian-sea-liguria",
    }),
    { make: "X-Yachts", model: "X-50" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "X-Yachts",
      model: "Xp 44",
      sourceSite: "theyachtmarket",
      slug: "2018-x-yachts-xp-44-port-hamble-marina",
    }),
    { make: "X-Yachts", model: "Xp 44" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "X-Yachts",
      model: "X-50",
      sourceSite: "theyachtmarket",
      slug: "2005-x-yachts-x-50-contact-de-valk-istria",
    }),
    { make: "X-Yachts", model: "X-50" }
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
      make: "J Boats",
      model: "J30",
      sourceSite: "sailboatlistings",
      slug: "1981-j-boats-j30-texas",
    }),
    { make: "J/Boats", model: "J/30" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "J Boats",
      model: "J 111 J111 J/111",
      sourceSite: "sailboatlistings",
      slug: "2012-j-boats-j-111-j111-j-111-rhode-island",
    }),
    { make: "J/Boats", model: "J/111" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "J Boats",
      model: "95",
      sourceSite: "sailboatlistings",
      slug: "2012-j-boats-95-connecticut",
    }),
    { make: "J/Boats", model: "J/95" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "J Boat",
      model: "J29",
      sourceSite: "sailboatlistings",
      slug: "1986-j-boats-j29-maryland",
    }),
    { make: "J/Boats", model: "J/29" }
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
      make: "Choey",
      model: "Lee Clipper 33",
      sourceSite: "sailboatlistings",
      slug: "1970-choey-lee-clipper-33-california",
    }),
    { make: "Cheoy Lee", model: "Clipper 33" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Choey Lee",
      model: "Lee Offshore",
      sourceSite: "sailboatlistings",
      slug: "1973-choey-lee-offshore-california",
    }),
    { make: "Cheoy Lee", model: "Offshore" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Cheo",
      model: "Lee Ketch 42&711",
      sourceSite: "sailboatlistings",
      slug: "1977-cheo-lee-ketch-42-711-slovenija-piran",
    }),
    { make: "Cheoy Lee", model: "Ketch 42&711" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Choye",
      model: "Lee",
      sourceSite: "sailboatlistings",
      slug: "1979-choye-lee-maine",
    }),
    { make: "Cheoy Lee", model: "" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Cheoylee",
      model: "Ray Richards Offshore 32",
      sourceSite: "sailboatlistings",
      slug: "1978-cheoylee-ray-richards-offshore-32-florida",
    }),
    { make: "Cheoy Lee", model: "Ray Richards Offshore 32" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Cheoylee",
      model: "Lee Offshore 38",
      sourceSite: "sailboatlistings",
      slug: "1978-cheoylee-offshore-38-florida",
    }),
    { make: "Cheoy Lee", model: "Offshore 38" }
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
      make: "Pacific",
      model: "Boats Olson 30",
      sourceSite: "sailboatlistings",
      slug: "1983-pacific-boats-olson-30-new-jersey",
    }),
    { make: "Pacific Boats", model: "Olson 30" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Pacific",
      model: "Boats Inc Olson 30",
      sourceSite: "sailboatlistings",
      slug: "1980-pacific-boats-inc-olson-30-new-york",
    }),
    { make: "Pacific Boats", model: "Olson 30" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Pacific Boats",
      model: "Inc Olson 30",
      sourceSite: "sailboatlistings",
      slug: "1980-pacific-boats-inc-olson-30-new-york",
    }),
    { make: "Pacific Boats", model: "Olson 30" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Pacific",
      model: "Boats",
      sourceSite: "sailboatlistings",
      slug: "1980-pacific-boats-florida",
    }),
    { make: "Pacific Boats", model: "" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Bluewater",
      model: "Boats Ingrid 38",
      sourceSite: "sailboatlistings",
      slug: "1976-bluewater-boats-ingrid-38-florida",
    }),
    { make: "Bluewater Boats", model: "Ingrid 38" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Bluewater Boats",
      model: "Boats Ingrid 38",
      sourceSite: "sailboatlistings",
      slug: "1978-bluewater-boats-ingrid-38-maine",
    }),
    { make: "Bluewater Boats", model: "Ingrid 38" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Bluewater",
      model: "Boats",
      sourceSite: "sailboatlistings",
      slug: "1976-bluewater-boats-florida",
    }),
    { make: "Bluewater Boats", model: "" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Fabola",
      model: "Boats Diva 45",
      sourceSite: "theyachtmarket",
      slug: "1996-fabola-boats-diva-45-lefkas",
    }),
    { make: "Fabola Boats", model: "Diva 45" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Fabola Boats",
      model: "Boats Diva 45",
      sourceSite: "theyachtmarket",
      slug: "1996-fabola-boats-diva-45-lefkas",
    }),
    { make: "Fabola Boats", model: "Diva 45" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Fabola",
      model: "Diva 451",
      sourceSite: "sailboatlistings",
      slug: "1997-fabola-diva-451-washington",
    }),
    { make: "Fabola", model: "Diva 451" }
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
      make: "Trident",
      model: "Marine Voyager 38",
      sourceSite: "theyachtmarket",
      slug: "1984-trident-marine-voyager-38-coleraine",
    }),
    { make: "Trident Marine", model: "Voyager 38" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Trident Marine",
      model: "Marine Warrior 35",
      sourceSite: "theyachtmarket",
      slug: "1977-trident-marine-warrior-35-largs",
    }),
    { make: "Trident Marine", model: "Warrior 35" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Trident",
      model: "Marine",
      sourceSite: "theyachtmarket",
      slug: "1980-trident-marine-",
    }),
    { make: "Trident Marine", model: "" }
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
      make: "Holby",
      model: "Marine Tripp 37",
      sourceSite: "sailboatlistings",
      slug: "1987-holby-marine-tripp-37-michigan",
    }),
    { make: "Holby Marine", model: "Tripp 37" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Holby",
      model: "Marine 36 Clearwater Sloop",
      sourceSite: "sailboatlistings",
      slug: "1993-holby-marine-36-clearwater-sloop-florida",
    }),
    { make: "Holby Marine", model: "36 Clearwater Sloop" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Holby Marine",
      model: "Marine Tripp 37",
      sourceSite: "sailboatlistings",
      slug: "1987-holby-marine-tripp-37-connecticut",
    }),
    { make: "Holby Marine", model: "Tripp 37" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Fairways",
      model: "Marine Fisher 30",
      sourceSite: "sailboatlistings",
      slug: "1976-fairways-marine-fisher-30-maryland",
    }),
    { make: "Fairways Marine", model: "Fisher 30" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Fairways Marine",
      model: "Marine Fisher 30",
      sourceSite: "sailboatlistings",
      slug: "1973-fairways-marine-fisher-30-california",
    }),
    { make: "Fairways Marine", model: "Fisher 30" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Alliaura",
      model: "Marine Privilege 615",
      sourceSite: "sailboatlistings",
      slug: "2007-alliaura-marine-privilege-615-caribbean-saint-martin",
    }),
    { make: "Alliaura Marine", model: "Privilege 615" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Alliaura",
      model: "Marine Privilege 37",
      sourceSite: "sailboatlistings",
      slug: "1996-alliaura-marine-privilege-37-tyrell-bay-carriacou",
    }),
    { make: "Alliaura Marine", model: "Privilege 37" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Alliaura Marine",
      model: "Marine Privilege 615",
      sourceSite: "sailboatlistings",
      slug: "2007-alliaura-marine-privilege-615-caribbean-saint-martin",
    }),
    { make: "Alliaura Marine", model: "Privilege 615" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Jeantot",
      model: "Marine Privilege 39",
      sourceSite: "sailboatlistings",
      slug: "1990-jeantot-marine-privilege-39-florida",
    }),
    { make: "Jeantot Marine", model: "Privilege 39" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Jeantot",
      model: "Marine Privilege 37",
      sourceSite: "sailboatlistings",
      slug: "1999-jeantot-marine-privilege-37-france",
    }),
    { make: "Jeantot Marine", model: "Privilege 37" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Jeantot Marine",
      model: "Marine Privilege 39",
      sourceSite: "sailboatlistings",
      slug: "1990-jeantot-marine-privilege-39-florida",
    }),
    { make: "Jeantot Marine", model: "Privilege 39" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Corsair",
      model: "Marine F-31 Aft Cockpit",
      sourceSite: "sailboatlistings",
      slug: "1996-corsair-marine-f-31-aft-cockpit-california",
    }),
    { make: "Corsair Marine", model: "F-31 Aft Cockpit" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Corsair",
      model: "Marine Farrier F31rs",
      sourceSite: "sailboatlistings",
      slug: "2001-corsair-marine-farrier-f31rs-california",
    }),
    { make: "Corsair Marine", model: "Farrier F31rs" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Corsair Marine",
      model: "Marine F27 F-27",
      sourceSite: "sailboatlistings",
      slug: "1991-corsair-marine-f27-f-27-utah",
    }),
    { make: "Corsair Marine", model: "F27 F-27" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Sessa",
      model: "Marine 26",
      sourceSite: "theyachtmarket",
      slug: "2008-sessa-marine-26-palma-de-mallorca",
    }),
    { make: "Sessa Marine", model: "26" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Sessa Marine",
      model: "Marine 26",
      sourceSite: "theyachtmarket",
      slug: "2008-sessa-marine-26-palma-de-mallorca",
    }),
    { make: "Sessa Marine", model: "26" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Gilbert",
      model: "Marine Gib'Sea 92",
      sourceSite: "sailboatlistings",
      slug: "1986-gilbert-marine-gib-sea-92-northern-ireland",
    }),
    { make: "Gibsea", model: "92" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Gilbert",
      model: "Marine Gib Sea 37",
      sourceSite: "sailboatlistings",
      slug: "1985-gilbert-marine-gib-sea-37-florida",
    }),
    { make: "Gibsea", model: "37" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Gibert",
      model: "Marine France GIB SEA 402 Master Pro",
      sourceSite: "sailboatlistings",
      slug: "1987-gibert-marine-france-gib-sea-402-master-pro-spain-balearic-island-mallorca",
    }),
    { make: "Gibsea", model: "402 Master Pro" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Gibert",
      model: "Marine Gibsea402",
      sourceSite: "sailboatlistings",
      slug: "1988-gibert-marine-gibsea402-thailand",
    }),
    { make: "Gibsea", model: "402" }
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
      make: "Ice",
      model: "Yachts Ice 62 Evo",
      sourceSite: "theyachtmarket",
      slug: "2016-ice-yachts-ice-62-evo-barcelona",
    }),
    { make: "Ice Yachts", model: "Ice 62 Evo" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Ice Yachts",
      model: "Yachts Felci 71",
      sourceSite: "theyachtmarket",
      slug: "2008-ice-yachts-felci-71-gaeta",
    }),
    { make: "Ice Yachts", model: "Felci 71" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Ice",
      model: "Yachts Ice Cat 72",
      sourceSite: "theyachtmarket",
      slug: "2019-ice-yachts-ice-cat-72-gruissan",
    }),
    { make: "Ice Yachts", model: "Ice Cat 72" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Pegasus",
      model: "Yachts Pegasus 50",
      sourceSite: "theyachtmarket",
      slug: "2026-pegasus-yachts-pegasus-50-venice",
    }),
    { make: "Pegasus Yachts", model: "50" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Pegasus",
      model: "Yachts 800",
      sourceSite: "theyachtmarket",
      slug: "1979-pegasus-yachts-800-wayford",
    }),
    { make: "Pegasus Yachts", model: "800" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Pegasus Yachts",
      model: "Yachts Pegasus 50",
      sourceSite: "theyachtmarket",
      slug: "2023-pegasus-yachts-pegasus-50-marmaris",
    }),
    { make: "Pegasus Yachts", model: "50" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Sly",
      model: "Yachts Sly 42",
      sourceSite: "theyachtmarket",
      slug: "2006-sly-yachts-sly-42-italy",
    }),
    { make: "Sly Yachts", model: "42" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Sly",
      model: "Yachts 54",
      sourceSite: "theyachtmarket",
      slug: "2012-sly-yachts-54-france",
    }),
    { make: "Sly Yachts", model: "54" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Sly Yachts",
      model: "Yachts Sly 42",
      sourceSite: "theyachtmarket",
      slug: "2006-sly-yachts-sly-42-italy",
    }),
    { make: "Sly Yachts", model: "42" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Vaan",
      model: "Yachts R4",
      sourceSite: "theyachtmarket",
      slug: "2027-vaan-yachts-r4-hellevoetsluis",
    }),
    { make: "Vaan Yachts", model: "R4" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Vaan Yachts",
      model: "Yachts R5",
      sourceSite: "theyachtmarket",
      slug: "2024-vaan-yachts-r5-marseille",
    }),
    { make: "Vaan Yachts", model: "R5" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Omega",
      model: "Yachts Omega 28",
      sourceSite: "theyachtmarket",
      slug: "1979-omega-yachts-omega-28-dover",
    }),
    { make: "Omega Yachts", model: "28" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Omega",
      model: "Yachts Omega 36",
      sourceSite: "theyachtmarket",
      slug: "1990-omega-yachts-omega-36-burnham-yacht-harbour",
    }),
    { make: "Omega Yachts", model: "36" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Omega Yachts",
      model: "Yachts Omega 28",
      sourceSite: "theyachtmarket",
      slug: "1979-omega-yachts-omega-28-dover",
    }),
    { make: "Omega Yachts", model: "28" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Omega",
      model: "46",
      sourceSite: "theyachtmarket",
      slug: "2004-omega-46-blankaholm",
    }),
    { make: "Omega", model: "46" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Neo",
      model: "Yachts Neo 350",
      sourceSite: "theyachtmarket",
      slug: "2018-neo-yachts-neo-350-smiltyne",
    }),
    { make: "Neo Yachts", model: "350" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Neo",
      model: "Yachts Neo 460 Roma",
      sourceSite: "theyachtmarket",
      slug: "2024-neo-yachts-neo-460-roma-miami",
    }),
    { make: "Neo Yachts", model: "460 Roma" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Neo",
      model: "430",
      sourceSite: "theyachtmarket",
      slug: "2024-neo-430-miami",
    }),
    { make: "Neo", model: "430" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Swallow",
      model: "Yachts Coast 250",
      sourceSite: "theyachtmarket",
      slug: "2020-swallow-yachts-coast-250-totnes-south-devon",
    }),
    { make: "Swallow Yachts", model: "Coast 250" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Swallow Yachts",
      model: "Yachts Coast 250",
      sourceSite: "theyachtmarket",
      slug: "2020-swallow-yachts-coast-250-totnes-south-devon",
    }),
    { make: "Swallow Yachts", model: "Coast 250" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Swallow",
      model: "Company Scylla Ketch",
      sourceSite: "sailboatlistings",
      slug: "1985-swallow-company-scylla-ketch-florida",
    }),
    { make: "Swallow", model: "Company Scylla Ketch" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Ranger",
      model: "Yachts 37 Sloop",
      sourceSite: "theyachtmarket",
      slug: "1973-ranger-yachts-37-sloop-honolulu",
    }),
    { make: "Ranger Yachts", model: "37 Sloop" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Ranger Yachts",
      model: "Yachts 37 Sloop",
      sourceSite: "theyachtmarket",
      slug: "1973-ranger-yachts-37-sloop-honolulu",
    }),
    { make: "Ranger Yachts", model: "37 Sloop" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Ranger",
      model: "28",
      sourceSite: "sailboatlistings",
      slug: "1976-ranger-28-florida",
    }),
    { make: "Ranger", model: "28" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Ksenia",
      model: "Yachts 149",
      sourceSite: "theyachtmarket",
      slug: "2010-ksenia-yachts-149-le-marin",
    }),
    { make: "Ksenia Yachts", model: "149" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Ksenia Yachts",
      model: "Yachts 149",
      sourceSite: "theyachtmarket",
      slug: "2010-ksenia-yachts-149-le-marin",
    }),
    { make: "Ksenia Yachts", model: "149" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Ksenia",
      model: "149",
      sourceSite: "theyachtmarket",
      slug: "2010-ksenia-149-le-marin",
    }),
    { make: "Ksenia", model: "149" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Alloy",
      model: "Yachts 53m Ketch",
      sourceSite: "theyachtmarket",
      slug: "2002-alloy-yachts-53m-ketch-french-riviera",
    }),
    { make: "Alloy Yachts", model: "53m Ketch" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Alloy Yachts",
      model: "Yachts 53m Ketch",
      sourceSite: "theyachtmarket",
      slug: "2002-alloy-yachts-53m-ketch-french-riviera",
    }),
    { make: "Alloy Yachts", model: "53m Ketch" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Alloy",
      model: "Custom 42",
      sourceSite: "theyachtmarket",
      slug: "1990-alloy-custom-42-french-riviera",
    }),
    { make: "Alloy", model: "Custom 42" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Adventure",
      model: "Yachts 55",
      sourceSite: "theyachtmarket",
      slug: "2015-adventure-yachts-55-denmark",
    }),
    { make: "Adventure Yachts", model: "55" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Adventure Yachts",
      model: "Yachts 55",
      sourceSite: "theyachtmarket",
      slug: "2015-adventure-yachts-55-denmark",
    }),
    { make: "Adventure Yachts", model: "55" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Adventure",
      model: "40",
      sourceSite: "theyachtmarket",
      slug: "2015-adventure-40-denmark",
    }),
    { make: "Adventure", model: "40" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Discovery",
      model: "Yachts 58",
      sourceSite: "theyachtmarket",
      slug: "2015-discovery-yachts-58-cartagena",
    }),
    { make: "Discovery Yachts", model: "58" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Discovery Yachts",
      model: "Yachts 58",
      sourceSite: "theyachtmarket",
      slug: "2021-discovery-yachts-58-valencia",
    }),
    { make: "Discovery Yachts", model: "58" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Discovery",
      model: "55 Mk II",
      sourceSite: "sailboatlistings",
      slug: "2017-discovery-55-mk-ii-southampton",
    }),
    { make: "Discovery", model: "55 Mk II" }
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
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Gilbert",
      model: "Karoff Chatam 33",
      sourceSite: "sailboatlistings",
      slug: "1985-gilbert-karoff-chatam-33-roatan",
    }),
    { make: "Gilbert", model: "Karoff Chatam 33" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Dufour",
      model: "Gibsea 43",
      sourceSite: "sailboatlistings",
      slug: "2003-dufour-gibsea-43-new-york",
    }),
    { make: "Dufour", model: "Gibsea 43" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Character",
      model: "Boats Lytham Pilot",
      sourceSite: "boatshop24",
      slug: "2021-character-boats-lytham-pilot-windermere",
    }),
    { make: "Character", model: "Boats Lytham Pilot" }
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
  assert.deepEqual(
    normalizeImportedMakeModel({
      year: 1975,
      make: "Ranger",
      model: "Pending 29",
      sourceSite: "sailboatlistings",
      slug: "1975-ranger-pending-29-virginia",
    }),
    { make: "Ranger", model: "29" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      year: 1997,
      make: "Hunter",
      model: "310-Sale Pending",
      sourceSite: "sailboatlistings",
      slug: "1997-hunter-310-sale-pending-new-york",
    }),
    { make: "Hunter", model: "310" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      year: 1997,
      make: "Hunter",
      model: "310-Sale",
      sourceSite: "sailboatlistings",
      slug: "1997-hunter-310-sale-new-york",
    }),
    { make: "Hunter", model: "310" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      year: 1978,
      make: "Sale",
      model: "Pending Catalina 30",
      sourceSite: "sailboatlistings",
      slug: "1978-sale-pending-catalina-30-michigan",
    }),
    { make: "Catalina", model: "30" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      year: 1978,
      make: "Pearsonsold",
      model: "365",
      sourceSite: "sailboatlistings",
      slug: "1978-pearsonsold-365-abaco",
    }),
    { make: "Pearson", model: "365" }
  );
});

test("normalizeImportedMakeModel backfills missing Sailboat Listings models from LOA", () => {
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Hunter",
      model: "",
      sourceSite: "sailboatlistings",
      slug: "1981-hunter-new-jersey",
      loa: 30,
    }),
    { make: "Hunter", model: "30" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Cabo Rico",
      model: "Sailboat",
      sourceSite: "sailboatlistings",
      slug: "1989-cabo-rico-mississippi",
      loa: 34,
    }),
    { make: "Cabo Rico", model: "34" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Catalina",
      model: "",
      sourceSite: "sailboatlistings",
      slug: "1978-catalina-puerto-rico",
      loa: 26.8,
    }),
    { make: "Catalina", model: "26.8" }
  );
  assert.deepEqual(
    normalizeImportedMakeModel({
      make: "Hunter",
      model: "",
      sourceSite: "theyachtmarket",
      slug: "1981-hunter-",
      loa: 30,
    }),
    { make: "Hunter", model: "" }
  );
});

test("hasImportedSaleStatusMarker catches sold and pending imported listings", () => {
  assert.equal(
    hasImportedSaleStatusMarker({
      make: "Sold",
      model: "South",
      slug: "1989-sold-south-south-carolina",
    }),
    true
  );
  assert.equal(
    hasImportedSaleStatusMarker({
      make: "Hunter",
      model: "310-Sale Pending",
      slug: "1997-hunter-310-sale-pending-new-york",
    }),
    true
  );
  assert.equal(
    hasImportedSaleStatusMarker({
      make: "Ranger",
      model: "Pending 29",
      slug: "1975-ranger-pending-29-virginia",
    }),
    true
  );
  assert.equal(
    hasImportedSaleStatusMarker({
      make: "Pearsonsold",
      model: "365",
      slug: "1978-pearsonsold-365-abaco",
    }),
    true
  );
  assert.equal(
    hasImportedSaleStatusMarker({
      make: "Beneteau",
      model: "Oceanis 45",
      slug: "2012-beneteau-oceanis-45-catalonia",
    }),
    false
  );
});

test("buildImportQualityFlags hides sold imports even when the normalized model looks clean", () => {
  assert.deepEqual(
    buildImportQualityFlags({
      make: "Beneteau",
      model: "473",
      slug: "2004-beneteau-sold-473-texas",
      locationText: "Kemah, Texas",
      imageCount: 4,
      priceUsd: 125000,
      summary: "This imported listing has enough summary detail to clear the normal quality checks.",
    }),
    ["sale_status"]
  );
  assert.deepEqual(
    buildImportQualityFlags({
      make: "Pearsonsold",
      model: "365",
      slug: "1978-pearsonsold-365-abaco",
      locationText: "Abaco, Bahamas",
      imageCount: 17,
      priceUsd: 34000,
      summary: "This imported listing has enough summary detail to clear the normal quality checks.",
    }),
    ["sale_status"]
  );
});

test("mergeStickyImportQualityFlags preserves sale_status once cleanup has hidden a listing", () => {
  assert.deepEqual(
    mergeStickyImportQualityFlags({
      currentFlags: [],
      existingFlags: ["sale_status"],
    }),
    ["sale_status"]
  );
  assert.deepEqual(
    mergeStickyImportQualityFlags({
      currentFlags: ["missing_model"],
      existingFlags: ["sale_status"],
    }).sort(),
    ["missing_model", "sale_status"]
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

test("sanitizeImportedBoatRecord rewrites summary lead text when make/model normalization changes", () => {
  const choeyLee = sanitizeImportedBoatRecord({
    year: 1970,
    make: "Choey",
    model: "Lee Clipper 33",
    slug: "1970-choey-lee-clipper-33-california",
    source_site: "sailboatlistings",
    location_text: "California",
    ai_summary: "1970 Choey Lee Clipper 33 in California. 33ft LOA, ketch rig, monohull.",
    specs: {
      loa: 33,
      rig_type: "ketch",
    },
  });

  assert.equal(choeyLee.make, "Cheoy Lee");
  assert.equal(choeyLee.model, "Clipper 33");
  assert.equal(
    choeyLee.ai_summary,
    "1970 Cheoy Lee Clipper 33 in California. 33ft LOA, ketch rig, monohull."
  );

  const choyeLee = sanitizeImportedBoatRecord({
    year: 1979,
    make: "Choye",
    model: "Lee",
    slug: "1979-choye-lee-maine",
    source_site: "sailboatlistings",
    location_text: "Maine",
    ai_summary: "1979 Choye Lee in Maine. 35ft LOA, masthead sloop rig, monohull.",
    specs: {
      loa: 35,
      rig_type: "masthead sloop",
    },
  });

  assert.equal(choyeLee.make, "Cheoy Lee");
  assert.equal(choyeLee.model, "");
  assert.equal(
    choyeLee.ai_summary,
    "1979 Cheoy Lee in Maine. 35ft LOA, masthead sloop rig, monohull."
  );

  const omega = sanitizeImportedBoatRecord({
    year: 1979,
    make: "Omega",
    model: "Yachts Omega 28",
    slug: "1979-omega-yachts-omega-28-dover",
    source_site: "theyachtmarket",
    location_text: "Dover",
    ai_summary:
      "1979 Omega Yachts Omega 28 in Dover. 28ft LOA, monohull, well maintained.",
    specs: {
      loa: 28,
    },
  });

  assert.equal(omega.make, "Omega Yachts");
  assert.equal(omega.model, "28");
  assert.equal(
    omega.ai_summary,
    "1979 Omega Yachts 28 in Dover. 28ft LOA, monohull, well maintained."
  );

  const neo = sanitizeImportedBoatRecord({
    year: 2018,
    make: "Neo",
    model: "Yachts Neo 350",
    slug: "2018-neo-yachts-neo-350-smiltyne",
    source_site: "theyachtmarket",
    location_text: "Smiltyne",
    ai_summary: "2018 Neo Yachts Neo 350 in Smiltyne. 35.4ft LOA, monohull, race-ready.",
    specs: {
      loa: 35.4,
    },
  });

  assert.equal(neo.make, "Neo Yachts");
  assert.equal(neo.model, "350");
  assert.equal(
    neo.ai_summary,
    "2018 Neo Yachts 350 in Smiltyne. 35.4ft LOA, monohull, race-ready."
  );

  const gibsea = sanitizeImportedBoatRecord({
    year: 1986,
    make: "Gilbert",
    model: "Marine Gib'Sea 92",
    slug: "1986-gilbert-marine-gib-sea-92-northern-ireland",
    source_site: "sailboatlistings",
    location_text: "Northern Ireland",
    ai_summary: "1986 Gilbert Marine Gib'Sea 92 in Northern Ireland. 30ft LOA, masthead sloop rig, monohull.",
    specs: {
      loa: 30,
      rig_type: "masthead sloop",
    },
  });

  assert.equal(gibsea.make, "Gibsea");
  assert.equal(gibsea.model, "92");
  assert.equal(
    gibsea.ai_summary,
    "1986 Gibsea 92 in Northern Ireland. 30ft LOA, masthead sloop rig, monohull."
  );

  const rossiter = sanitizeImportedBoatRecord({
    year: 1984,
    make: "Rossiter",
    model: "Yachts Curlew 32",
    slug: "1984-rossiter-yachts-curlew-32-falmouth",
    source_site: "theyachtmarket",
    location_text: "Falmouth",
    ai_summary: "1984 Rossiter Yachts Curlew 32 in Falmouth. 32ft LOA, monohull, classic lines.",
    specs: {
      loa: 32,
    },
  });

  assert.equal(rossiter.make, "Rossiter Yachts");
  assert.equal(rossiter.model, "Curlew 32");
  assert.equal(
    rossiter.ai_summary,
    "1984 Rossiter Yachts Curlew 32 in Falmouth. 32ft LOA, monohull, classic lines."
  );

  const comuzzi = sanitizeImportedBoatRecord({
    year: 2024,
    make: "Comuzzi",
    model: "Yachts C32 Sport",
    slug: "2024-comuzzi-yachts-c32-sport-adriatic-sea",
    source_site: "theyachtmarket",
    location_text: "Adriatic Sea",
    ai_summary:
      "2024 Comuzzi Yachts C32 Sport in Adriatic Sea. 35.8ft LOA, monohull, day cruiser.",
    specs: {
      loa: 35.8,
    },
  });

  assert.equal(comuzzi.make, "Comuzzi Yachts");
  assert.equal(comuzzi.model, "C32 Sport");
  assert.equal(
    comuzzi.ai_summary,
    "2024 Comuzzi Yachts C32 Sport in Adriatic Sea. 35.8ft LOA, monohull, day cruiser."
  );

  const oqs = sanitizeImportedBoatRecord({
    year: 2019,
    make: "Oqs",
    model: "Yachts Ocean Explorer 60",
    slug: "2019-oqs-yachts-ocean-explorer-60-fort-lauderdale",
    source_site: "theyachtmarket",
    location_text: "Fort Lauderdale, Florida",
    ai_summary:
      "2019 Oqs Yachts Ocean Explorer 60 in Fort Lauderdale, Florida. 60.7ft LOA, catamaran, expedition-ready.",
    specs: {
      loa: 60.7,
      vessel_type: "catamaran",
    },
  });

  assert.equal(oqs.make, "OQS Yachts");
  assert.equal(oqs.model, "Ocean Explorer 60");
  assert.equal(
    oqs.ai_summary,
    "2019 OQS Yachts Ocean Explorer 60 in Fort Lauderdale, Florida. 60.7ft LOA, catamaran, expedition-ready."
  );

  const magic = sanitizeImportedBoatRecord({
    year: 2015,
    make: "Magic",
    model: "Yachts 96 Catamaran",
    slug: "2015-magic-yachts-96-catamaran-french-riviera",
    source_site: "theyachtmarket",
    location_text: "French Riviera",
    ai_summary:
      "2015 Magic Yachts 96 Catamaran in French Riviera. 96.8ft LOA, catamaran, premium family cruiser.",
    specs: {
      loa: 96.8,
      vessel_type: "catamaran",
    },
  });

  assert.equal(magic.make, "Magic Yachts");
  assert.equal(magic.model, "96 Catamaran");
  assert.equal(
    magic.ai_summary,
    "2015 Magic Yachts 96 Catamaran in French Riviera. 96.8ft LOA, catamaran, premium family cruiser."
  );

  const fastYachts = sanitizeImportedBoatRecord({
    year: 2002,
    make: "Fast",
    model: "Yachts 42",
    slug: "2002-fast-yachts-42-d-n-laoghaire",
    source_site: "theyachtmarket",
    location_text: "Dún Laoghaire",
    ai_summary: "2002 Fast Yachts 42 in Dún Laoghaire. 42.2ft LOA, monohull, offshore-ready.",
    specs: {
      loa: 42.2,
      vessel_type: "monohull",
    },
  });

  assert.equal(fastYachts.make, "Fast Yachts");
  assert.equal(fastYachts.model, "42");
  assert.equal(
    fastYachts.ai_summary,
    "2002 Fast Yachts 42 in Dún Laoghaire. 42.2ft LOA, monohull, offshore-ready."
  );

  const matYachts = sanitizeImportedBoatRecord({
    year: 2023,
    make: "M A",
    model: "T Yachts 1220",
    slug: "2023-m-a-t-yachts-1220-bulgaria",
    source_site: "theyachtmarket",
    location_text: "Bulgaria",
    ai_summary: "2023 M A T Yachts 1220 in Bulgaria. 40ft LOA, monohull, bluewater-capable.",
    specs: {
      loa: 40,
      vessel_type: "monohull",
    },
  });

  assert.equal(matYachts.make, "M A T Yachts");
  assert.equal(matYachts.model, "1220");
  assert.equal(
    matYachts.ai_summary,
    "2023 M A T Yachts 1220 in Bulgaria. 40ft LOA, monohull, bluewater-capable."
  );

  const chevertonBoats = sanitizeImportedBoatRecord({
    year: 1984,
    make: "Cheverton",
    model: "Boats 40",
    slug: "1984-cheverton-boats-40-ardrishaig",
    source_site: "theyachtmarket",
    location_text: "Ardrishaig, Argyll And Bute",
    ai_summary: "1984 Cheverton Boats 40 in Ardrishaig, Argyll And Bute. 44.9ft LOA, monohull, classic offshore cruiser.",
    specs: {
      loa: 44.9,
      vessel_type: "monohull",
    },
  });

  assert.equal(chevertonBoats.make, "Cheverton Boats");
  assert.equal(chevertonBoats.model, "40");
  assert.equal(
    chevertonBoats.ai_summary,
    "1984 Cheverton Boats 40 in Ardrishaig, Argyll And Bute. 44.9ft LOA, monohull, classic offshore cruiser."
  );

  const characterBoats = sanitizeImportedBoatRecord({
    year: 2021,
    make: "Character",
    model: "Boats Lytham Pilot",
    slug: "2021-character-boats-lytham-pilot-windermere",
    source_site: "theyachtmarket",
    location_text: "Windermere, Cumbria",
    ai_summary:
      "2021 Character Boats Lytham Pilot in Windermere, Cumbria. 12.5ft LOA, monohull, traditional day-sailer.",
    specs: {
      loa: 12.5,
      vessel_type: "monohull",
    },
  });

  assert.equal(characterBoats.make, "Character Boats");
  assert.equal(characterBoats.model, "Lytham Pilot");
  assert.equal(
    characterBoats.ai_summary,
    "2021 Character Boats Lytham Pilot in Windermere, Cumbria. 12.5ft LOA, monohull, traditional day-sailer."
  );

  const moreBoats = sanitizeImportedBoatRecord({
    year: 2016,
    make: "More",
    model: "Boats 55",
    slug: "2016-more-boats-55-at-request",
    source_site: "theyachtmarket",
    location_text: "At Request",
    ai_summary: "2016 More Boats 55 in At Request. 54.8ft LOA, monohull, premium cruiser.",
    specs: {
      loa: 54.8,
      vessel_type: "monohull",
    },
  });

  assert.equal(moreBoats.make, "More Boats");
  assert.equal(moreBoats.model, "55");
  assert.equal(
    moreBoats.ai_summary,
    "2016 More Boats 55 in At Request. 54.8ft LOA, monohull, premium cruiser."
  );

  const caledoniaMarineSystems = sanitizeImportedBoatRecord({
    year: 2019,
    make: "Caledonia",
    model: "Marine Systems Halifax 37",
    slug: "2019-caledonia-marine-systems-halifax-37-vieques",
    source_site: "sailboatlistings",
    location_text: "Vieques, Puerto Rico",
    ai_summary:
      "2019 Caledonia Marine Systems Halifax 37 in Vieques, Puerto Rico. 37ft LOA, fractional sloop rig, catamaran.",
    specs: {
      loa: 37,
      rig_type: "fractional sloop",
      vessel_type: "monohull",
    },
  });

  assert.equal(caledoniaMarineSystems.make, "Caledonia Marine Systems");
  assert.equal(caledoniaMarineSystems.model, "Halifax 37");
  assert.equal(
    caledoniaMarineSystems.ai_summary,
    "2019 Caledonia Marine Systems Halifax 37 in Vieques, Puerto Rico. 37ft LOA, fractional sloop rig, catamaran."
  );

  const traditionMarine = sanitizeImportedBoatRecord({
    year: 2001,
    make: "Tradition",
    model: "Marine Tm 42",
    slug: "2001-tradition-marine-tm-42-barcelona",
    source_site: "theyachtmarket",
    location_text: "Barcelona, Catalonia",
    ai_summary: "2001 Tradition Marine Tm 42 in Barcelona, Catalonia. 42.2ft LOA, monohull, classic cruiser.",
    specs: {
      loa: 42.2,
      vessel_type: "monohull",
    },
  });

  assert.equal(traditionMarine.make, "Tradition Marine");
  assert.equal(traditionMarine.model, "Tm 42");
  assert.equal(
    traditionMarine.ai_summary,
    "2001 Tradition Marine Tm 42 in Barcelona, Catalonia. 42.2ft LOA, monohull, classic cruiser."
  );

  const nortechMarine = sanitizeImportedBoatRecord({
    year: 1993,
    make: "Nortech",
    model: "Marine Hood 50",
    slug: "1993-nortech-marine-hood-50-sotogrande",
    source_site: "theyachtmarket",
    location_text: "Sotogrande, Andalusia",
    ai_summary: "1993 Nortech Marine Hood 50 in Sotogrande, Andalusia. 49.7ft LOA, monohull, classic bluewater cruiser.",
    specs: {
      loa: 49.7,
      vessel_type: "monohull",
    },
  });

  assert.equal(nortechMarine.make, "Nortech Marine");
  assert.equal(nortechMarine.model, "Hood 50");
  assert.equal(
    nortechMarine.ai_summary,
    "1993 Nortech Marine Hood 50 in Sotogrande, Andalusia. 49.7ft LOA, monohull, classic bluewater cruiser."
  );

  const kingMarine = sanitizeImportedBoatRecord({
    year: 2017,
    make: "King",
    model: "Marine Nmyd Irc One Off 54",
    slug: "2017-king-marine-nmyd-irc-one-off-54-hamble",
    source_site: "theyachtmarket",
    location_text: "Hamble, United Kingdom",
    ai_summary: "2017 King Marine Nmyd Irc One Off 54 in Hamble, United Kingdom. 54ft LOA, monohull, racing yacht.",
    specs: {
      loa: 54,
      vessel_type: "monohull",
    },
  });

  assert.equal(kingMarine.make, "King Marine");
  assert.equal(kingMarine.model, "Nmyd Irc One Off 54");
  assert.equal(
    kingMarine.ai_summary,
    "2017 King Marine Nmyd Irc One Off 54 in Hamble, United Kingdom. 54ft LOA, monohull, racing yacht."
  );

  const squaltMarine = sanitizeImportedBoatRecord({
    year: 2019,
    make: "Squalt",
    model: "Marine Ck 64",
    slug: "2019-squalt-marine-ck-64-le-marin",
    source_site: "theyachtmarket",
    location_text: "Le Marin, Martinique",
    ai_summary: "2019 Squalt Marine Ck 64 in Le Marin, Martinique. 64.2ft LOA, monohull, center-cockpit cruiser.",
    specs: {
      loa: 64.2,
      vessel_type: "monohull",
    },
  });

  assert.equal(squaltMarine.make, "Squalt Marine");
  assert.equal(squaltMarine.model, "Ck 64");
  assert.equal(
    squaltMarine.ai_summary,
    "2019 Squalt Marine Ck 64 in Le Marin, Martinique. 64.2ft LOA, monohull, center-cockpit cruiser."
  );

  const greenMarine = sanitizeImportedBoatRecord({
    year: 2014,
    make: "Green",
    model: "Marine Volvo 65",
    slug: "2014-green-marine-volvo-65-lisbon",
    source_site: "theyachtmarket",
    location_text: "Lisbon, Portugal",
    ai_summary: "2014 Green Marine Volvo 65 in Lisbon, Portugal. 66.9ft LOA, monohull, racing yacht.",
    specs: {
      loa: 66.9,
      vessel_type: "monohull",
    },
  });

  assert.equal(greenMarine.make, "Green Marine");
  assert.equal(greenMarine.model, "Volvo 65");
  assert.equal(
    greenMarine.ai_summary,
    "2014 Green Marine Volvo 65 in Lisbon, Portugal. 66.9ft LOA, monohull, racing yacht."
  );

  const fastnetMarine = sanitizeImportedBoatRecord({
    year: 1988,
    make: "Fastnet",
    model: "Marine Fastnet 34",
    slug: "1988-fastnet-marine-fastnet-34-southampton",
    source_site: "theyachtmarket",
    location_text: "Southampton, United Kingdom",
    ai_summary: "1988 Fastnet Marine Fastnet 34 in Southampton, United Kingdom. 34ft LOA, monohull, classic cruiser-racer.",
    specs: {
      loa: 34,
      vessel_type: "monohull",
    },
  });

  assert.equal(fastnetMarine.make, "Fastnet Marine");
  assert.equal(fastnetMarine.model, "Fastnet 34");
  assert.equal(
    fastnetMarine.ai_summary,
    "1988 Fastnet Marine Fastnet 34 in Southampton, United Kingdom. 34ft LOA, monohull, classic cruiser-racer."
  );

  const blakesMarine = sanitizeImportedBoatRecord({
    year: 1972,
    make: "Blakes",
    model: "Marine Cruising Folkboat",
    slug: "1972-blakes-marine-cruising-folkboat-portland-marina",
    source_site: "theyachtmarket",
    location_text: "Portland Marina, United Kingdom",
    ai_summary: "1972 Blakes Marine Cruising Folkboat in Portland Marina, United Kingdom. 26.2ft LOA, monohull, budget-friendly weekender.",
    specs: {
      loa: 26.2,
      vessel_type: "monohull",
    },
  });

  assert.equal(blakesMarine.make, "Blakes Marine");
  assert.equal(blakesMarine.model, "Cruising Folkboat");
  assert.equal(
    blakesMarine.ai_summary,
    "1972 Blakes Marine Cruising Folkboat in Portland Marina, United Kingdom. 26.2ft LOA, monohull, budget-friendly weekender."
  );

  const sharkMarine = sanitizeImportedBoatRecord({
    year: 2017,
    make: "Shark",
    model: "Marine 50",
    slug: "2017-shark-marine-50-marseille",
    source_site: "theyachtmarket",
    location_text: "Marseille, France",
    ai_summary: "2017 Shark Marine 50 in Marseille, France. 50ft LOA, catamaran, performance-oriented sailing catamaran.",
    specs: {
      loa: 50,
      vessel_type: "catamaran",
    },
  });

  assert.equal(sharkMarine.make, "Shark Marine");
  assert.equal(sharkMarine.model, "50");
  assert.equal(
    sharkMarine.ai_summary,
    "2017 Shark Marine 50 in Marseille, France. 50ft LOA, catamaran, performance-oriented sailing catamaran."
  );

  const jBoats = sanitizeImportedBoatRecord({
    year: 1981,
    make: "J Boats",
    model: "J30",
    slug: "1981-j-boats-j30-texas",
    source_site: "sailboatlistings",
    location_text: "Texas",
    ai_summary: "1981 J Boats J30 in Texas. 30ft LOA, masthead sloop rig, monohull.",
    specs: {
      loa: 30,
      rig_type: "masthead sloop",
    },
  });

  assert.equal(jBoats.make, "J/Boats");
  assert.equal(jBoats.model, "J/30");
  assert.equal(
    jBoats.ai_summary,
    "1981 J/Boats J/30 in Texas. 30ft LOA, masthead sloop rig, monohull."
  );
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

test("buildImportedSummary avoids price and source boilerplate", () => {
  assert.equal(
    buildImportedSummary({
      year: 2010,
      make: "Robertson and Caine",
      model: "Leopard 38",
      locationText: "Nassau, Bahamas",
      loa: 38,
      rigType: "masthead sloop",
      hullMaterial: "catamaran",
    }),
    "2010 Robertson and Caine Leopard 38 listed in Nassau, Bahamas. Key specs include 38ft LOA, masthead sloop rig, catamaran hull."
  );
});
