import test from "node:test";
import assert from "node:assert/strict";

import {
  buildGeocodeQuery,
  deriveCountryGeocodeResult,
  geocodeWithOpenCage,
  geocodeWithNominatim,
  getGeocodeCandidateReason,
  getGeocodingConfig,
  promoteVerifiedPublicPinAliasPrecision,
  reviewGeocodeResultQuality,
  type GeocodingConfig,
} from "../../src/lib/locations/geocoding";
import { classifyGeocodeReviewIssue } from "../../src/lib/locations/geocode-triage";

const baseConfig: GeocodingConfig = {
  provider: "nominatim",
  enabled: true,
  apiKey: null,
  baseUrl: "https://geocode.test/search",
  userAgent: "OnlyHulls test",
  email: null,
  delayMs: 0,
  timeoutMs: 1000,
};

const openCageConfig: GeocodingConfig = {
  ...baseConfig,
  provider: "opencage",
  apiKey: "test-open-cage-key",
  baseUrl: "https://opencage.test/geocode/v1/json",
  delayMs: 0,
};

test("buildGeocodeQuery prepares specific city queries with country hints", () => {
  const query = buildGeocodeQuery({
    locationText: "Cannes",
    country: "France",
    confidence: "city",
  });

  assert.deepEqual(query, {
    queryText: "Cannes, France",
    queryKey: "cannes france",
    countryHint: "fr",
  });
});

test("buildGeocodeQuery uses corrected country hints for ambiguous boat locations", () => {
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Parlin, New Jersey",
      country: "United States",
      confidence: "city",
    }),
    {
      queryText: "Parlin, New Jersey, United States",
      queryKey: "parlin new jersey united states",
      countryHint: "us",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Cartagena De Indias Colombia",
      country: "Colombia",
      confidence: "city",
    }),
    {
      queryText: "Cartagena De Indias, Colombia",
      queryKey: "cartagena de indias colombia",
      countryHint: "co",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Aegean, Turkey",
      country: "Turkey",
      confidence: "city",
    }),
    {
      queryText: "Aegean, Turkey",
      queryKey: "aegean turkey",
      countryHint: "tr",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Tortola (Caribbean)",
      country: "British Virgin Islands",
      confidence: "city",
    }),
    {
      queryText: "Tortola, British Virgin Islands",
      queryKey: "tortola british virgin islands",
      countryHint: "vg",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Tortola, Virgin Islands, British",
      country: "British Virgin Islands",
      confidence: "city",
    }),
    {
      queryText: "Tortola, British Virgin Islands",
      queryKey: "tortola british virgin islands",
      countryHint: "vg",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "St. Thomas, US Virgin Islands",
      country: "United States Virgin Islands",
      confidence: "city",
    }),
    {
      queryText: "St. Thomas, US Virgin Islands",
      queryKey: "st thomas us virgin islands",
      countryHint: "vi",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Green Cay Marina, St Croix, Virgin Islands (US) (USVI)",
      country: "United States Virgin Islands",
      confidence: "city",
    }),
    {
      // Round 23: this reviewed source text canonicalizes to the facility-grade
      // OpenCage query so the verified Green Cay Marina alias anchor can promote
      // the row. The `green cay marina` alias spans us+vi (USVI facilities are
      // tagged country_code=us by OpenCage), so providerCountryCodes widens the
      // provider-side filter to prevent Christiansted city from out-ranking the
      // marina under a `vi`-only filter. See documents/public-pin-aliases.md.
      queryText: "Green Cay Marina, Christiansted, US Virgin Islands",
      queryKey: "green cay marina christiansted us virgin islands",
      countryHint: "vi",
      providerCountryCodes: ["us", "vi"],
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "St. Thomas, Virgin Islands",
      country: "United States Virgin Islands",
      confidence: "city",
    }),
    {
      queryText: "St. Thomas, US Virgin Islands",
      queryKey: "st thomas us virgin islands",
      countryHint: "vi",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "St. Thomas",
      country: "United States Virgin Islands",
      confidence: "city",
    }),
    {
      queryText: "St. Thomas, US Virgin Islands",
      queryKey: "st thomas us virgin islands",
      countryHint: "vi",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "St. John Us, Virgin Islands",
      country: "United States Virgin Islands",
      confidence: "city",
    }),
    {
      queryText: "St. John, US Virgin Islands",
      queryKey: "st john us virgin islands",
      countryHint: "vi",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Virgin Gorda Boatyard, Virgin Islands (British) (BVI)",
      country: "British Virgin Islands",
      confidence: "city",
    }),
    {
      queryText: "Virgin Gorda Boatyard, British Virgin Islands",
      queryKey: "virgin gorda boatyard british virgin islands",
      countryHint: "vg",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "&#8239;Shoreline&#8239;Marina, &#8239;Long&#8239;Beach, &#8239;California Price:&#8239;$52, 500",
      country: "United States",
      confidence: "city",
    }),
    {
      queryText: "Shoreline Marina, Long Beach, California, United States",
      queryKey: "shoreline marina long beach california united states",
      countryHint: "us",
    }
  );
});

test("buildGeocodeQuery removes broad cruising-region noise and prioritizes marina text", () => {
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Athens, Alimos Marina, Mediterranean",
      country: "Greece",
      confidence: "city",
    }),
    {
      queryText: "Alimos Marina, Athens, Greece",
      queryKey: "alimos marina athens greece",
      countryHint: "gr",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Grenada, Port Louis Marina, Caribbean",
      country: "Grenada",
      confidence: "city",
    }),
    {
      queryText: "Port Louis Marina, Grenada",
      queryKey: "port louis marina grenada",
      countryHint: "gd",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Clarke's Court Boatyard & Marina",
      country: "Grenada",
      confidence: "city",
    }),
    {
      queryText: "Clarkes Court Boatyard and Marina, Grenada",
      queryKey: "clarkes court boatyard and marina grenada",
      countryHint: "gd",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "British Virgin Islands, Hodge's Creek Marina, Caribbean",
      country: "British Virgin Islands",
      confidence: "city",
    }),
    {
      queryText: "Hodge's Creek Marina, British Virgin Islands",
      queryKey: "hodge s creek marina british virgin islands",
      countryHint: "vg",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Dubrovnik, Komolac, ACI Marina Dubrovnik",
      country: "Croatia",
      confidence: "city",
    }),
    {
      queryText: "ACI Marina Dubrovnik, Komolac, Croatia",
      queryKey: "aci marina dubrovnik komolac croatia",
      countryHint: "hr",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Šibenik, Marina Zaton, Mediterranean",
      country: "Croatia",
      confidence: "city",
    }),
    {
      queryText: "Marina Zaton, Sibenik, Croatia",
      queryKey: "marina zaton sibenik croatia",
      countryHint: "hr",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Kos, Kos Marina, Mediterranean",
      country: "Greece",
      confidence: "city",
    }),
    {
      queryText: "Kos Marina, Kos, Greece",
      queryKey: "kos marina kos greece",
      countryHint: "gr",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Marsh Harbour, Conch Inn Marina, Bahamas",
      country: "Bahamas",
      confidence: "city",
    }),
    {
      queryText: "Conch Inn Marina, Marsh Harbour, Bahamas",
      queryKey: "conch inn marina marsh harbour bahamas",
      countryHint: "bs",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Trogir, Yachtclub Seget (Marina Baotić), Mediterranean",
      country: "Croatia",
      confidence: "city",
    }),
    {
      queryText: "Marina Baotic, Seget Donji, Croatia",
      queryKey: "marina baotic seget donji croatia",
      countryHint: "hr",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Nanny Cay British Virgin Islands Caribbean",
      country: "British Virgin Islands",
      confidence: "city",
    }),
    {
      queryText: "Nanny Cay Marina, Tortola, British Virgin Islands",
      queryKey: "nanny cay marina tortola british virgin islands",
      countryHint: "vg",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Preveza Ionian Sea, Greece",
      country: "Greece",
      confidence: "city",
    }),
    {
      queryText: "Preveza, Greece",
      queryKey: "preveza greece",
      countryHint: "gr",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Marina De L'Anse Marcel, St. Martin, Sint Maarten",
      country: "Sint Maarten",
      confidence: "city",
    }),
    {
      queryText: "Marina Anse Marcel, Saint Martin",
      queryKey: "marina anse marcel saint martin",
      countryHint: "mf",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Almerimar, Spain Us Flag",
      country: "Spain",
      confidence: "city",
    }),
    {
      queryText: "Almerimar, Spain",
      queryKey: "almerimar spain",
      countryHint: "es",
    }
  );
});

test("buildGeocodeQuery cleans live review-queue source text before paid geocoding", () => {
  assert.equal(
    buildGeocodeQuery({
      locationText: "Saint Martin, Sint Maarten",
      country: "Sint Maarten",
      confidence: "city",
    }),
    null
  );
  assert.equal(
    buildGeocodeQuery({
      locationText: "Caribbean Saint Martin",
      country: "Sint Maarten",
      confidence: "city",
    }),
    null
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Marigot, Saint Martin (French Part), Sint Maarten",
      country: "Sint Maarten",
      confidence: "city",
    }),
    {
      queryText: "Marigot, Saint Martin",
      queryKey: "marigot saint martin",
      countryHint: "mf",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "St. Thomas Vi",
      country: "United States Virgin Islands",
      confidence: "city",
    }),
    {
      queryText: "St. Thomas, US Virgin Islands",
      queryKey: "st thomas us virgin islands",
      countryHint: "vi",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "St. Thomas Usvis",
      country: "United States Virgin Islands",
      confidence: "city",
    }),
    {
      queryText: "St. Thomas, US Virgin Islands",
      queryKey: "st thomas us virgin islands",
      countryHint: "vi",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "St. Thomas, US Virgin Islands, United States Virgin Islands",
      country: "United States Virgin Islands",
      confidence: "city",
    }),
    {
      queryText: "St. Thomas, US Virgin Islands",
      queryKey: "st thomas us virgin islands",
      countryHint: "vi",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Genoa, Italyn / A",
      country: "Italy",
      confidence: "city",
    }),
    {
      queryText: "Genoa, Italy",
      queryKey: "genoa italy",
      countryHint: "it",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Cartagena De Indias Colombia, Spain",
      country: "Spain",
      confidence: "city",
    }),
    {
      queryText: "Cartagena De Indias, Colombia",
      queryKey: "cartagena de indias colombia",
      countryHint: "co",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Ensenada Mexico Baja, California, United States",
      country: "United States",
      confidence: "city",
    }),
    {
      queryText: "Ensenada, Baja California, Mexico",
      queryKey: "ensenada baja california mexico",
      countryHint: "mx",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "La Paz Baja California Sur, Mexico, United States",
      country: "United States",
      confidence: "city",
    }),
    {
      queryText: "La Paz, Baja California Sur, Mexico",
      queryKey: "la paz baja california sur mexico",
      countryHint: "mx",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Rodney Bay Marina Gros Islet St Lucia Available In Martinique Upon Request",
      country: "Saint Lucia",
      confidence: "city",
    }),
    {
      queryText: "Rodney Bay Marina Gros Islet Saint Lucia",
      queryKey: "rodney bay marina gros islet saint lucia",
      countryHint: "lc",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Luperon Dominican Republic",
      country: "Dominican Republic",
      confidence: "city",
    }),
    {
      queryText: "Luperon Dominican Republic",
      queryKey: "luperon dominican republic",
      countryHint: "do",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Roatan Honduras Caribeann",
      country: "Honduras",
      confidence: "city",
    }),
    {
      queryText: "Roatan Honduras",
      queryKey: "roatan honduras",
      countryHint: "hn",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Tivat Montenegro Europe",
      country: "Montenegro",
      confidence: "city",
    }),
    {
      queryText: "Tivat Montenegro",
      queryKey: "tivat montenegro",
      countryHint: "me",
    }
  );
  assert.equal(
    buildGeocodeQuery({
      locationText: "Saint Martin Caraibi",
      country: "Sint Maarten",
      confidence: "city",
    }),
    null
  );
  assert.equal(
    buildGeocodeQuery({
      locationText: "St Maarten, Dutch Antilles",
      country: "Sint Maarten",
      confidence: "city",
    }),
    null
  );
  assert.equal(
    buildGeocodeQuery({
      locationText: "St Maarten Na",
      country: "Sint Maarten",
      confidence: "city",
    }),
    null
  );
  assert.equal(
    buildGeocodeQuery({
      locationText: "St Maarten Caribbean",
      country: "Sint Maarten",
      confidence: "city",
    }),
    null
  );
  assert.equal(
    buildGeocodeQuery({
      locationText: "St Martin French, West Indies",
      country: "Sint Maarten",
      confidence: "city",
    }),
    null
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Aan Verkoopsteiger In Lelystad",
      country: "Netherlands",
      confidence: "city",
    }),
    {
      queryText: "Lelystad, Netherlands",
      queryKey: "lelystad netherlands",
      countryHint: "nl",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Aaan Verkoopsteiger In Lelystad",
      country: "Netherlands",
      confidence: "city",
    }),
    {
      queryText: "Lelystad, Netherlands",
      queryKey: "lelystad netherlands",
      countryHint: "nl",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Aan Verkoopsteiger In Lelystad, Deko Marina",
      country: "Netherlands",
      confidence: "city",
    }),
    {
      queryText: "Deko Marina, Lelystad, Netherlands",
      queryKey: "deko marina lelystad netherlands",
      countryHint: "nl",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Port De Gallician Aigues-Mortes South Of, France",
      country: "France",
      confidence: "city",
    }),
    {
      queryText: "Port De Gallician Aigues-Mortes, France",
      queryKey: "port de gallician aigues mortes france",
      countryHint: "fr",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Georgetown Exuma Bahmas",
      country: "Bahamas",
      confidence: "city",
    }),
    {
      queryText: "Georgetown Exuma Bahamas",
      queryKey: "georgetown exuma bahamas",
      countryHint: "bs",
    }
  );
  assert.equal(
    buildGeocodeQuery({
      locationText: "Grenade Caribbean",
      country: "Grenada",
      confidence: "city",
    }),
    null
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Santantioco Sardinia, Italy",
      country: "Italy",
      confidence: "city",
    }),
    {
      queryText: "Sant'Antioco Sardinia, Italy",
      queryKey: "sant antioco sardinia italy",
      countryHint: "it",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Canary Islands El Hiero",
      country: "Spain",
      confidence: "city",
    }),
    {
      queryText: "Canary Islands El Hierro, Spain",
      queryKey: "canary islands el hierro spain",
      countryHint: "es",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Sarnia Ont Lake Huron",
      country: "Canada",
      confidence: "city",
    }),
    {
      queryText: "Sarnia, Ontario, Canada",
      queryKey: "sarnia ontario canada",
      countryHint: "ca",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Goderich Ontario - Lake Huron",
      country: "Canada",
      confidence: "city",
    }),
    {
      queryText: "Goderich, Ontario, Canada",
      queryKey: "goderich ontario canada",
      countryHint: "ca",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Osoyoos Bc 6 Miles North Of Oroville Wa",
      country: "Canada",
      confidence: "city",
    }),
    {
      queryText: "Osoyoos, BC, Canada",
      queryKey: "osoyoos bc canada",
      countryHint: "ca",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Trogir, Yachtclub Seget (Marina Baotić)",
      country: "Croatia",
      confidence: "city",
    }),
    {
      queryText: "Marina Baotic, Seget Donji, Croatia",
      queryKey: "marina baotic seget donji croatia",
      countryHint: "hr",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Trogir, Yachtclub Seget (Marina Baotić), Mediterranean",
      country: "Croatia",
      confidence: "city",
    }),
    {
      queryText: "Marina Baotic, Seget Donji, Croatia",
      queryKey: "marina baotic seget donji croatia",
      countryHint: "hr",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Yachtclub Seget (Marina Baotic), Trogir",
      country: "Croatia",
      confidence: "city",
    }),
    {
      queryText: "Marina Baotic, Seget Donji, Croatia",
      queryKey: "marina baotic seget donji croatia",
      countryHint: "hr",
    }
  );
  assert.equal(
    buildGeocodeQuery({
      locationText: "Canada West Coast Just North Of Seattle",
      country: "Canada",
      confidence: "city",
    }),
    null
  );
  assert.equal(
    buildGeocodeQuery({
      locationText: "North East Of, Italy",
      country: "Italy",
      confidence: "city",
    }),
    null
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Grenade, Haute-Garonne",
      country: "France",
      confidence: "city",
    }),
    {
      queryText: "Grenade, Haute-Garonne, France",
      queryKey: "grenade haute garonne france",
      countryHint: "fr",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Lake Ontario Kingston Area",
      country: "Canada",
      confidence: "city",
    }),
    {
      queryText: "Lake Ontario Kingston Area, Canada",
      queryKey: "lake ontario kingston area canada",
      countryHint: "ca",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Bayfield - Lake Huron",
      country: "Canada",
      confidence: "city",
    }),
    {
      queryText: "Bayfield - Lake Huron, Canada",
      queryKey: "bayfield lake huron canada",
      countryHint: "ca",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Jolly Harbour Antigua Barbuda",
      country: "Antigua and Barbuda",
      confidence: "city",
    }),
    {
      queryText: "Jolly Harbour, Antigua and Barbuda",
      queryKey: "jolly harbour antigua and barbuda",
      countryHint: "ag",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Guadeloupe, La Marina Bas Du Fort, Caribbean",
      country: "Guadeloupe",
      confidence: "city",
    }),
    {
      queryText: "Marina Bas du Fort, Le Gosier, Guadeloupe",
      queryKey: "marina bas du fort le gosier guadeloupe",
      countryHint: "gp",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Marina Bas-Du-Fort (Pointe-à-Pitre / Le Gosier)",
      country: "Guadeloupe",
      confidence: "city",
    }),
    {
      queryText: "Marina Bas du Fort, Le Gosier, Guadeloupe",
      queryKey: "marina bas du fort le gosier guadeloupe",
      countryHint: "gp",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Nanny Cay Boatyard",
      country: "British Virgin Islands",
      confidence: "city",
    }),
    {
      queryText: "Nanny Cay Marina, Tortola, British Virgin Islands",
      queryKey: "nanny cay marina tortola british virgin islands",
      countryHint: "vg",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Nanny Cay Tortola, British Virgin Islands",
      country: "British Virgin Islands",
      confidence: "city",
    }),
    {
      queryText: "Nanny Cay Marina, Tortola, British Virgin Islands",
      queryKey: "nanny cay marina tortola british virgin islands",
      countryHint: "vg",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Nanny Cay",
      country: "British Virgin Islands",
      confidence: "city",
    }),
    {
      queryText: "Nanny Cay Marina, Tortola, British Virgin Islands",
      queryKey: "nanny cay marina tortola british virgin islands",
      countryHint: "vg",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Nanny Cay, Virgin Islands (British)",
      country: "British Virgin Islands",
      confidence: "city",
    }),
    {
      queryText: "Nanny Cay Marina, Tortola, British Virgin Islands",
      queryKey: "nanny cay marina tortola british virgin islands",
      countryHint: "vg",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Corsica, Ajaccio, Port Tino Rossi, Mediterranean",
      country: "France",
      confidence: "city",
    }),
    {
      queryText: "Port Tino Rossi, Ajaccio, France",
      queryKey: "port tino rossi ajaccio france",
      countryHint: "fr",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Cote D'Azur, Port Pin Rolland, Mediterranean",
      country: "France",
      confidence: "city",
    }),
    {
      queryText: "Port Pin Rolland, Saint-Mandrier-sur-Mer, France",
      queryKey: "port pin rolland saint mandrier sur mer france",
      countryHint: "fr",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Hodge's Creek Marina Hotel, Parham Town, British Virgin Islands",
      country: "British Virgin Islands",
      confidence: "city",
    }),
    {
      queryText: "Hodge's Creek Marina, British Virgin Islands",
      queryKey: "hodge s creek marina british virgin islands",
      countryHint: "vg",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "La Paz, Costa Baja Marina, Americas",
      country: "Mexico",
      confidence: "city",
    }),
    {
      queryText: "Costa Baja Marina, La Paz, Mexico",
      queryKey: "costa baja marina la paz mexico",
      countryHint: "mx",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "La Cruz Marina Near Puerto Vallarta, Mexico",
      country: "Mexico",
      confidence: "city",
    }),
    {
      queryText: "Marina La Cruz, La Cruz de Huanacaxtle, Nayarit, Mexico",
      queryKey: "marina la cruz la cruz de huanacaxtle nayarit mexico",
      countryHint: "mx",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Panama - Shelter Bay Marina Atlantic Side Of Canal",
      country: "Panama",
      confidence: "city",
    }),
    {
      queryText: "Shelter Bay Marina, Colon, Panama",
      queryKey: "shelter bay marina colon panama",
      countryHint: "pa",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Shelter Bay Marina Colon Panama Sa",
      country: "Panama",
      confidence: "city",
    }),
    {
      queryText: "Shelter Bay Marina, Colon, Panama",
      queryKey: "shelter bay marina colon panama",
      countryHint: "pa",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Linton Bay Marina Garrote Coln, Panama",
      country: "Panama",
      confidence: "city",
    }),
    {
      queryText: "Linton Bay Marina, Panama",
      queryKey: "linton bay marina panama",
      countryHint: "pa",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Verkoophaven Delta Marina, Kortgene (Nederland)",
      country: "Netherlands",
      confidence: "city",
    }),
    {
      queryText: "Delta Marina, Kortgene, Netherlands",
      queryKey: "delta marina kortgene netherlands",
      countryHint: "nl",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Verkoophaven Schepenkring - Delta Marina Kortgene Nederland",
      country: "Netherlands",
      confidence: "city",
    }),
    {
      queryText: "Delta Marina, Kortgene, Netherlands",
      queryKey: "delta marina kortgene netherlands",
      countryHint: "nl",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Verkoophaven Schepenkring Delta Marina - Nederland",
      country: "Netherlands",
      confidence: "city",
    }),
    {
      queryText: "Delta Marina, Kortgene, Netherlands",
      queryKey: "delta marina kortgene netherlands",
      countryHint: "nl",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Delta Marina Kortgene - Nederland",
      country: "Netherlands",
      confidence: "city",
    }),
    {
      queryText: "Delta Marina, Kortgene, Netherlands",
      queryKey: "delta marina kortgene netherlands",
      countryHint: "nl",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Verkoophaven Delta Marina",
      country: "Netherlands",
      confidence: "city",
    }),
    {
      queryText: "Delta Marina, Kortgene, Netherlands",
      queryKey: "delta marina kortgene netherlands",
      countryHint: "nl",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Marina Vaiare, Moorea, Tahiti",
      country: "French Polynesia",
      confidence: "city",
    }),
    {
      queryText: "Marina Vaiare, Moorea, French Polynesia",
      queryKey: "marina vaiare moorea french polynesia",
      countryHint: "pf",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Chiapas Marina, Mexico",
      country: "Mexico",
      confidence: "city",
    }),
    {
      queryText: "Marina Chiapas, Chiapas, Mexico",
      queryKey: "marina chiapas chiapas mexico",
      countryHint: "mx",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Puerto Escondido Loreto Marina, BCS",
      country: null,
      confidence: "unknown",
    }),
    {
      queryText: "Marina Puerto Escondido, Loreto, Baja California Sur, Mexico",
      queryKey: "marina puerto escondido loreto baja california sur mexico",
      countryHint: "mx",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Marmaris Yacht Marine, Turkey",
      country: "Turkey",
      confidence: "city",
    }),
    {
      queryText: "Marmaris Yacht Marina, Turkey",
      queryKey: "marmaris yacht marina turkey",
      countryHint: "tr",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Le Marin Martiniqe, Martinique",
      country: "Martinique",
      confidence: "city",
    }),
    {
      queryText: "Marina du Marin, Martinique",
      queryKey: "marina du marin martinique",
      countryHint: "mq",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Bizerte Tunis, Tunisia",
      country: "Tunisia",
      confidence: "city",
    }),
    {
      queryText: "Bizerte, Tunisia",
      queryKey: "bizerte tunisia",
      countryHint: "tn",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Road Town Totola, British Virgin Islands",
      country: "British Virgin Islands",
      confidence: "city",
    }),
    {
      queryText: "Road Town, Tortola, British Virgin Islands",
      queryKey: "road town tortola british virgin islands",
      countryHint: "vg",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Croatiaistrien",
      country: "Croatia",
      confidence: "city",
    }),
    {
      queryText: "Istria, Croatia",
      queryKey: "istria croatia",
      countryHint: "hr",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Peloponesse, Greece",
      country: "Greece",
      confidence: "city",
    }),
    {
      queryText: "Peloponnese, Greece",
      queryKey: "peloponnese greece",
      countryHint: "gr",
    }
  );
  assert.equal(
    buildGeocodeQuery({
      locationText: "North, Italy",
      country: "Italy",
      confidence: "city",
    }),
    null
  );
  assert.equal(
    buildGeocodeQuery({
      locationText: "Hrvatska, Croatia",
      country: "Croatia",
      confidence: "city",
    }),
    null
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "** Bluffers Park Yacht Club, Live Aboard Marina!",
      country: null,
      confidence: "unknown",
    }),
    {
      queryText: "Bluffer's Park Yacht Club, Toronto, Canada",
      queryKey: "bluffer s park yacht club toronto canada",
      countryHint: "ca",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Foxs Marina, Ipswich",
      country: "United Kingdom",
      confidence: "city",
    }),
    {
      queryText: "Fox's Marina, Ipswich, United Kingdom",
      queryKey: "fox s marina ipswich united kingdom",
      countryHint: "gb",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Penarth Marina Cardiff",
      country: "United Kingdom",
      confidence: "city",
    }),
    {
      queryText: "Penarth Marina, United Kingdom",
      queryKey: "penarth marina united kingdom",
      countryHint: "gb",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Greystones Harbour Marina",
      country: "Ireland",
      confidence: "city",
    }),
    {
      queryText: "Greystones Marina, Greystones, Ireland",
      queryKey: "greystones marina greystones ireland",
      countryHint: "ie",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Northern Ireland, Carrickfergus Marina",
      country: null,
      confidence: "unknown",
    }),
    {
      queryText: "Carrickfergus Marina, Carrickfergus, County Antrim, United Kingdom",
      queryKey: "carrickfergus marina carrickfergus county antrim united kingdom",
      countryHint: "gb",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Camper & Nicholsons Port Louis Marina, Saint-Georges, Grenade",
      country: "Grenada",
      confidence: "city",
    }),
    {
      queryText: "Port Louis Marina, Grenada",
      queryKey: "port louis marina grenada",
      countryHint: "gd",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Piraeus (Zea Marina)",
      country: "Greece",
      confidence: "city",
    }),
    {
      queryText: "Zea Marina, Piraeus, Greece",
      queryKey: "zea marina piraeus greece",
      countryHint: "gr",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Zea Marina, Athens",
      country: "Greece",
      confidence: "city",
    }),
    {
      queryText: "Zea Marina, Piraeus, Greece",
      queryKey: "zea marina piraeus greece",
      countryHint: "gr",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Marina Di Ragusa, Southern Sicily",
      country: "Italy",
      confidence: "city",
    }),
    {
      queryText: "Marina Di Ragusa, Southern Sicily, Italy",
      queryKey: "marina di ragusa southern sicily italy",
      countryHint: "it",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Linton Bay Marina",
      country: null,
      confidence: "unknown",
    }),
    {
      queryText: "Linton Bay Marina",
      queryKey: "linton bay marina",
      countryHint: null,
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Red Frog Marina Bocas Del Toro, Panama",
      country: "Panama",
      confidence: "city",
    }),
    {
      queryText: "Red Frog Marina Bocas Del Toro, Panama",
      queryKey: "red frog marina bocas del toro panama",
      countryHint: "pa",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Thailand Ocean Marina Pattaya",
      country: "Thailand",
      confidence: "city",
    }),
    {
      queryText: "Thailand Ocean Marina Pattaya",
      queryKey: "thailand ocean marina pattaya",
      countryHint: "th",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Marina Riviera Nayarit, Mexico",
      country: "Mexico",
      confidence: "city",
    }),
    {
      queryText: "Marina Riviera Nayarit, Mexico",
      queryKey: "marina riviera nayarit mexico",
      countryHint: "mx",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Marina Guaymas Sonora, Mexico",
      country: "Mexico",
      confidence: "city",
    }),
    {
      queryText: "Marina Guaymas Sonora, Mexico",
      queryKey: "marina guaymas sonora mexico",
      countryHint: "mx",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Swanwick Marina, Southampton",
      country: "United Kingdom",
      confidence: "city",
    }),
    {
      queryText: "Swanwick Marina, Southampton, United Kingdom",
      queryKey: "swanwick marina southampton united kingdom",
      countryHint: "gb",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Conwy Marina",
      country: "United Kingdom",
      confidence: "city",
    }),
    {
      queryText: "Conwy Marina, United Kingdom",
      queryKey: "conwy marina united kingdom",
      countryHint: "gb",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Chichester Marina",
      country: "United Kingdom",
      confidence: "city",
    }),
    {
      queryText: "Chichester Marina, United Kingdom",
      queryKey: "chichester marina united kingdom",
      countryHint: "gb",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Dover Marina, Kent",
      country: "United Kingdom",
      confidence: "city",
    }),
    {
      queryText: "Dover Marina, Kent, United Kingdom",
      queryKey: "dover marina kent united kingdom",
      countryHint: "gb",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Dover, Marina",
      country: "United Kingdom",
      confidence: "city",
    }),
    {
      queryText: "Marina, Dover, United Kingdom",
      queryKey: "marina dover united kingdom",
      countryHint: "gb",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Chatham Marina, Chatham Kent",
      country: "United Kingdom",
      confidence: "city",
    }),
    {
      queryText: "MDL Chatham Maritime Marina Boatyard, Chatham, United Kingdom",
      queryKey: "mdl chatham maritime marina boatyard chatham united kingdom",
      countryHint: "gb",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Chatham Marina, Kent",
      country: "United Kingdom",
      confidence: "city",
    }),
    {
      queryText: "MDL Chatham Maritime Marina Boatyard, Chatham, United Kingdom",
      queryKey: "mdl chatham maritime marina boatyard chatham united kingdom",
      countryHint: "gb",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Chatham Marina, Kent Coast",
      country: "United Kingdom",
      confidence: "city",
    }),
    {
      queryText: "Chatham Marina, Kent Coast, United Kingdom",
      queryKey: "chatham marina kent coast united kingdom",
      countryHint: "gb",
    }
  );
  assert.equal(
    buildGeocodeQuery({
      locationText: "Chatham Marina",
      country: null,
      confidence: "unknown",
    }),
    null
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Medway Yacht Club, Kent",
      country: "United Kingdom",
      confidence: "city",
    }),
    {
      queryText: "Medway Yacht Club, Kent, United Kingdom",
      queryKey: "medway yacht club kent united kingdom",
      countryHint: "gb",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Port Solent Marina, Portsmouth",
      country: "United Kingdom",
      confidence: "city",
    }),
    {
      queryText: "Port Solent Marina, Portsmouth, United Kingdom",
      queryKey: "port solent marina portsmouth united kingdom",
      countryHint: "gb",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Deko Marina",
      country: "Netherlands",
      confidence: "city",
    }),
    {
      queryText: "Deko Marina, Netherlands",
      queryKey: "deko marina netherlands",
      countryHint: "nl",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Carrickfergus Harbour Marina",
      country: "United Kingdom",
      confidence: "city",
    }),
    {
      queryText: "Carrickfergus Harbour Marina, United Kingdom",
      queryKey: "carrickfergus harbour marina united kingdom",
      countryHint: "gb",
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Shotley Marina, Ip9 1qj",
      country: null,
      confidence: "unknown",
    }),
    {
      queryText: "Shotley Marina, Ip9 1qj",
      queryKey: "shotley marina ip9 1qj",
      countryHint: null,
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Lagoon Marina, Cole Bay",
      country: null,
      confidence: "unknown",
    }),
    {
      queryText: "Lagoon Marina, Cole Bay",
      queryKey: "lagoon marina cole bay",
      countryHint: null,
      // Round 23: the `lagoon marina` alias spans nl+sx (Sint Maarten provider
      // code nuance), so buildGeocodeQuery widens the provider-side country
      // filter. The anchor country check at isVerifiedPublicPinAliasAnchorMatch
      // still enforces the alias countryCodes list on the real result.
      providerCountryCodes: ["nl", "sx"],
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Carlyle West Access Marina, Illinois",
      country: null,
      confidence: "unknown",
    }),
    {
      queryText: "Carlyle West Access Marina, Illinois",
      queryKey: "carlyle west access marina illinois",
      countryHint: null,
    }
  );
  assert.deepEqual(
    buildGeocodeQuery({
      locationText: "Shores Of Leech Lake Marina, Minnesota",
      country: null,
      confidence: "unknown",
    }),
    {
      queryText: "Shores Of Leech Lake Marina, Minnesota",
      queryKey: "shores of leech lake marina minnesota",
      countryHint: null,
    }
  );
});

test("buildGeocodeQuery rejects generic or region-only locations", () => {
  assert.equal(
    buildGeocodeQuery({
      locationText: "West Coast",
      country: "United States",
      confidence: "region",
    }),
    null
  );
  assert.equal(
    buildGeocodeQuery({
      locationText: "Mediterranean",
      confidence: "region",
    }),
    null
  );
  assert.equal(
    buildGeocodeQuery({
      locationText: "South Of, France",
      country: "France",
      confidence: "city",
    }),
    null
  );
  assert.equal(
    buildGeocodeQuery({
      locationText: "Grenada, West Indies",
      country: "Grenada",
      confidence: "city",
    }),
    null
  );
  assert.equal(getGeocodeCandidateReason({ locationText: "", confidence: "unknown" }), "missing_location");
  assert.equal(
    getGeocodeCandidateReason({
      locationText: "Cannes",
      country: "France",
      confidence: "city",
    }),
    "ready"
  );
  assert.equal(
    buildGeocodeQuery({
      locationText: "Maryland",
      country: "United States",
      confidence: "region",
    }),
    null
  );
  assert.equal(
    getGeocodeCandidateReason({
      locationText: "Maryland",
      country: "United States",
      confidence: "region",
    }),
    "needs_more_specific_location"
  );
  assert.equal(
    buildGeocodeQuery({
      locationText: "France",
      country: "France",
      confidence: "city",
    }),
    null
  );
  assert.equal(
    getGeocodeCandidateReason({
      locationText: "France",
      country: "France",
      confidence: "city",
    }),
    "needs_more_specific_location"
  );
});

test("geocodeWithNominatim requires an identifying user agent", async () => {
  const result = await geocodeWithNominatim(
    { queryText: "Cannes, France", queryKey: "cannes france", countryHint: "fr" },
    { ...baseConfig, userAgent: null }
  );

  assert.equal(result.status, "skipped");
  assert.equal(result.error, "missing_user_agent");
});

test("geocode review triage separates enrichment work from provider retries", () => {
  assert.deepEqual(classifyGeocodeReviewIssue({ status: "review", error: "no_result" }), {
    category: "cleanup_source_text",
    action: "Improve the source location with a city, marina, or country before retrying.",
    retryable: false,
    blocksMap: true,
  });
  assert.deepEqual(classifyGeocodeReviewIssue({ status: "failed", error: "This operation was aborted" }), {
    category: "provider_health",
    action: "Retry after provider health, quota, or network issue is resolved.",
    retryable: true,
    blocksMap: true,
  });
  assert.deepEqual(classifyGeocodeReviewIssue({ status: "review", error: "low_precision", precision: "region" }), {
    category: "manual_enrichment",
    action: "Add more specific location detail; broad regional results must stay off the public map.",
    retryable: false,
    blocksMap: true,
  });
  assert.deepEqual(classifyGeocodeReviewIssue({ status: "review", countryHintMismatch: true }), {
    category: "cleanup_source_text",
    action: "Fix the stored country or source location before paid geocoding.",
    retryable: false,
    blocksMap: true,
  });
});

test("getGeocodingConfig enables OpenCage only when an api key is present", () => {
  const originalProvider = process.env.LOCATION_GEOCODING_PROVIDER;
  const originalApiKey = process.env.LOCATION_GEOCODING_API_KEY;
  const originalLegacyApiKey = process.env.GEOCODING_API_KEY;
  const originalOpenCageKey = process.env.OPENCAGE_API_KEY;
  const originalDelay = process.env.LOCATION_GEOCODING_DELAY_MS;
  const originalBaseUrl = process.env.LOCATION_GEOCODING_BASE_URL;

  try {
    delete process.env.LOCATION_GEOCODING_API_KEY;
    delete process.env.GEOCODING_API_KEY;
    delete process.env.OPENCAGE_API_KEY;
    delete process.env.LOCATION_GEOCODING_DELAY_MS;
    delete process.env.LOCATION_GEOCODING_BASE_URL;
    process.env.LOCATION_GEOCODING_PROVIDER = "opencage";

    const missingKey = getGeocodingConfig();
    assert.equal(missingKey.provider, "opencage");
    assert.equal(missingKey.enabled, false);
    assert.equal(missingKey.delayMs, 200);

    process.env.LOCATION_GEOCODING_API_KEY = "configured-key";
    const configured = getGeocodingConfig();
    assert.equal(configured.provider, "opencage");
    assert.equal(configured.enabled, true);
    assert.equal(configured.apiKey, "configured-key");
    assert.equal(configured.baseUrl, "https://api.opencagedata.com/geocode/v1/json");
  } finally {
    if (originalProvider === undefined) delete process.env.LOCATION_GEOCODING_PROVIDER;
    else process.env.LOCATION_GEOCODING_PROVIDER = originalProvider;
    if (originalApiKey === undefined) delete process.env.LOCATION_GEOCODING_API_KEY;
    else process.env.LOCATION_GEOCODING_API_KEY = originalApiKey;
    if (originalLegacyApiKey === undefined) delete process.env.GEOCODING_API_KEY;
    else process.env.GEOCODING_API_KEY = originalLegacyApiKey;
    if (originalOpenCageKey === undefined) delete process.env.OPENCAGE_API_KEY;
    else process.env.OPENCAGE_API_KEY = originalOpenCageKey;
    if (originalDelay === undefined) delete process.env.LOCATION_GEOCODING_DELAY_MS;
    else process.env.LOCATION_GEOCODING_DELAY_MS = originalDelay;
    if (originalBaseUrl === undefined) delete process.env.LOCATION_GEOCODING_BASE_URL;
    else process.env.LOCATION_GEOCODING_BASE_URL = originalBaseUrl;
  }
});

test("geocodeWithNominatim parses a city result without network access", async () => {
  const originalFetch = globalThis.fetch;
  const requested: Array<{ url: string; userAgent: string | null }> = [];

  globalThis.fetch = (async (url, init) => {
    const requestUrl = url instanceof URL ? url : new URL(String(url));
    requested.push({
      url: requestUrl.toString(),
      userAgent: init?.headers instanceof Headers
        ? init.headers.get("User-Agent")
        : (init?.headers as Record<string, string> | undefined)?.["User-Agent"] || null,
    });

    return new Response(
      JSON.stringify([
        {
          lat: "43.5528",
          lon: "7.0174",
          display_name: "Cannes, Alpes-Maritimes, France",
          addresstype: "city",
          type: "city",
          class: "boundary",
          place_rank: 16,
          importance: 0.61,
        },
      ]),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }) as typeof fetch;

  try {
    const result = await geocodeWithNominatim(
      { queryText: "Cannes, France", queryKey: "cannes france", countryHint: "fr" },
      baseConfig
    );

    assert.equal(result.status, "geocoded");
    assert.equal(result.precision, "city");
    assert.equal(result.latitude, 43.5528);
    assert.equal(result.longitude, 7.0174);
    assert.equal(requested.length, 1);
    assert.match(requested[0].url, /q=Cannes%2C\+France/);
    assert.match(requested[0].url, /countrycodes=fr/);
    assert.equal(requested[0].userAgent, "OnlyHulls test");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithNominatim does not treat county boundaries as city precision", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify([
        {
          lat: "35.8725573",
          lon: "-76.6215245",
          display_name: "Washington County, North Carolina, United States",
          addresstype: "county",
          type: "administrative",
          class: "boundary",
          place_rank: 12,
          importance: 0.55,
        },
      ]),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    const result = await geocodeWithNominatim(
      {
        queryText: "Washington, North Carolina, United States",
        queryKey: "washington north carolina united states",
        countryHint: "us",
      },
      baseConfig
    );

    assert.equal(result.status, "geocoded");
    assert.equal(result.precision, "region");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage requires an api key", async () => {
  const result = await geocodeWithOpenCage(
    { queryText: "Cannes, France", queryKey: "cannes france", countryHint: "fr" },
    { ...openCageConfig, apiKey: null }
  );

  assert.equal(result.status, "skipped");
  assert.equal(result.error, "missing_api_key");
});

test("geocodeWithOpenCage parses a city result and sends scoped request params", async () => {
  const originalFetch = globalThis.fetch;
  const requested: string[] = [];

  globalThis.fetch = (async (url) => {
    const requestUrl = url instanceof URL ? url : new URL(String(url));
    requested.push(requestUrl.toString());

    return new Response(
      JSON.stringify({
        results: [
          {
            formatted: "Cannes, Alpes-Maritimes, France",
            geometry: { lat: 43.5528, lng: 7.0174 },
            confidence: 7,
            components: {
              _type: "city",
              city: "Cannes",
              country: "France",
              country_code: "fr",
              state: "Provence-Alpes-Cote d'Azur",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }) as typeof fetch;

  try {
    const result = await geocodeWithOpenCage(
      { queryText: "Cannes, France", queryKey: "cannes france", countryHint: "fr" },
      openCageConfig
    );

    assert.equal(result.status, "geocoded");
    assert.equal(result.precision, "city");
    assert.equal(result.latitude, 43.5528);
    assert.equal(result.longitude, 7.0174);
    assert.equal(result.placeName, "Cannes, Alpes-Maritimes, France");
    assert.equal(requested.length, 1);
    assert.match(requested[0], /key=test-open-cage-key/);
    assert.match(requested[0], /q=Cannes%2C\+France/);
    assert.match(requested[0], /limit=1/);
    assert.match(requested[0], /no_annotations=1/);
    assert.match(requested[0], /countrycode=fr/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage accepts exact confidence-three city-country results for search coverage", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "Lelystad, Flevoland, Netherlands",
            geometry: { lat: 52.5150949, lng: 5.4768915 },
            confidence: 3,
            components: {
              _type: "city",
              city: "Lelystad",
              country: "Netherlands",
              country_code: "nl",
              state: "Flevoland",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    const result = await geocodeWithOpenCage(
      {
        queryText: "Lelystad, Netherlands",
        queryKey: "lelystad netherlands",
        countryHint: "nl",
      },
      openCageConfig
    );

    assert.equal(result.status, "geocoded");
    assert.equal(result.precision, "city");
    assert.equal(result.error, null);
    assert.equal(result.score, 0.42);
    assert.equal(result.latitude, 52.5150949);
    assert.equal(result.longitude, 5.4768915);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage keeps unsafe confidence-three city-like results in review", async () => {
  const originalFetch = globalThis.fetch;
  const cases = [
    {
      name: "confidence below floor",
      query: {
        queryText: "Lelystad, Netherlands",
        queryKey: "lelystad netherlands",
        countryHint: "nl",
      },
      result: {
        // Round 32 adjusted the `exact City, Country` exception to accept
        // confidence=2 when the primary city component exactly matches the
        // queried city part. Dropping the confidence to 1 keeps this case in
        // the "still unsafe" test bucket — truly low-confidence results must
        // remain in review regardless of how clean the component is.
        formatted: "Lelystad, Flevoland, Netherlands",
        geometry: { lat: 52.5150949, lng: 5.4768915 },
        confidence: 1,
        components: {
          _type: "city",
          city: "Lelystad",
          country: "Netherlands",
          country_code: "nl",
        },
      },
      precision: "city",
      error: "low_confidence",
    },
    {
      // Round 34 extended the exception to 3-part City,Region,Country. To
      // preserve "unsafe" test coverage, replace this 3-part case with a
      // 4-part query which the exception still rejects.
      name: "four-part city-region-region-country query",
      query: {
        queryText: "Cannes, Alpes-Maritimes, Provence, France",
        queryKey: "cannes alpes maritimes provence france",
        countryHint: "fr",
      },
      result: {
        formatted: "Cannes, Alpes-Maritimes, France",
        geometry: { lat: 43.5528, lng: 7.0174 },
        confidence: 3,
        components: {
          _type: "city",
          city: "Cannes",
          country: "France",
          country_code: "fr",
          state: "Provence-Alpes-Cote d'Azur",
        },
      },
      precision: "city",
      error: "low_confidence",
    },
    {
      name: "country hint mismatch",
      query: {
        queryText: "Lelystad, Netherlands",
        queryKey: "lelystad netherlands",
        countryHint: "nl",
      },
      result: {
        formatted: "Lelystad, Belgium",
        geometry: { lat: 50.9, lng: 4.4 },
        confidence: 3,
        components: {
          _type: "city",
          city: "Lelystad",
          country: "Belgium",
          country_code: "be",
        },
      },
      precision: "city",
      error: "low_confidence",
    },
    {
      name: "formatted result missing queried city",
      query: {
        queryText: "Lelystad, Netherlands",
        queryKey: "lelystad netherlands",
        countryHint: "nl",
      },
      result: {
        formatted: "Almere, Flevoland, Netherlands",
        geometry: { lat: 52.3508, lng: 5.2647 },
        confidence: 3,
        components: {
          _type: "city",
          city: "Almere",
          country: "Netherlands",
          country_code: "nl",
        },
      },
      precision: "city",
      error: "low_confidence",
    },
    {
      name: "street component on city-typed result",
      query: {
        queryText: "Lelystad, Netherlands",
        queryKey: "lelystad netherlands",
        countryHint: "nl",
      },
      result: {
        formatted: "Station Road, Lelystad, Flevoland, Netherlands",
        geometry: { lat: 52.51, lng: 5.47 },
        confidence: 3,
        components: {
          _type: "city",
          city: "Lelystad",
          road: "Station Road",
          country: "Netherlands",
          country_code: "nl",
        },
      },
      precision: "city",
      error: "low_confidence",
    },
  ] as const;

  try {
    for (const item of cases) {
      globalThis.fetch = (async () =>
        new Response(JSON.stringify({ results: [item.result] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })) as typeof fetch;

      const result = await geocodeWithOpenCage(item.query, openCageConfig);
      assert.equal(result.status, "review", item.name);
      assert.equal(result.precision, item.precision, item.name);
      assert.equal(result.error, item.error, item.name);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage routes county boundaries to reviewable region precision", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "Washington County, North Carolina, United States",
            geometry: { lat: 35.8725573, lng: -76.6215245 },
            confidence: 3,
            components: {
              _type: "county",
              county: "Washington County",
              state: "North Carolina",
              country: "United States",
              country_code: "us",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    const result = await geocodeWithOpenCage(
      {
        queryText: "Washington, North Carolina, United States",
        queryKey: "washington north carolina united states",
        countryHint: "us",
      },
      openCageConfig
    );

    assert.equal(result.status, "review");
    assert.equal(result.precision, "region");
    assert.equal(result.error, "low_confidence");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage rejects low-confidence marine pins", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "Cannes Marina Road, France",
            geometry: { lat: 43.5528, lng: 7.0174 },
            confidence: 5,
            components: {
              _type: "road",
              road: "Marina Road",
              city: "Cannes",
              country: "France",
              country_code: "fr",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    const result = await geocodeWithOpenCage(
      { queryText: "Cannes Marina, France", queryKey: "cannes marina france", countryHint: "fr" },
      openCageConfig
    );

    assert.equal(result.status, "review");
    assert.equal(result.precision, "marina");
    assert.equal(result.error, "low_confidence");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage holds POI results for city-level queries", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "Vancouver Island Regional Library - Nanaimo North Branch, 6250 Hammond Bay Road, Nanaimo, BC V9T, Canada",
            geometry: { lat: 49.2350034, lng: -124.0384586 },
            confidence: 10,
            components: {
              _type: "road",
              road: "Hammond Bay Road",
              city: "Nanaimo",
              state: "British Columbia",
              country: "Canada",
              country_code: "ca",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    const result = await geocodeWithOpenCage(
      {
        queryText: "Nanaimo Vancouver Island, Canada",
        queryKey: "nanaimo vancouver island canada",
        countryHint: "ca",
      },
      openCageConfig
    );

    assert.equal(result.status, "review");
    assert.equal(result.precision, "unknown");
    assert.equal(result.error, "low_precision");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage holds degenerate one-token import fragments for review", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "s, 84600 Grillon, France",
            geometry: { lat: 44.3901329, lng: 4.9497074 },
            confidence: 10,
            components: {
              _type: "hamlet",
              hamlet: "s",
              country: "France",
              country_code: "fr",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    const result = await geocodeWithOpenCage(
      { queryText: "S, France", queryKey: "s france", countryHint: "fr" },
      openCageConfig
    );

    assert.equal(result.status, "review");
    assert.equal(result.error, "degenerate_query");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage holds broad waterbody queries that resolve to businesses", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "Ionian Sea Hotel, Mantzavinata - Favata, 282 00 Paliki Municipal Unit, Greece",
            geometry: { lat: 38.1557011, lng: 20.3860003 },
            confidence: 10,
            components: {
              _type: "hotel",
              _category: "accommodation",
              tourism: "hotel",
              country: "Greece",
              country_code: "gr",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    const result = await geocodeWithOpenCage(
      { queryText: "Ionian Sea, Greece", queryKey: "ionian sea greece", countryHint: "gr" },
      openCageConfig
    );

    assert.equal(result.status, "review");
    assert.equal(result.error, "waterbody_poi_mismatch");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("cached geocode quality review reclassifies stale accepted bad rows", () => {
  const result = reviewGeocodeResultQuality("Ionian Sea, Greece", {
    status: "geocoded",
    latitude: 38.1557011,
    longitude: 20.3860003,
    precision: "city",
    score: 1,
    placeName: "Ionian Sea Hotel, Mantzavinata, Greece",
    provider: "opencage",
    payload: {
      components: {
        _type: "hotel",
        _category: "accommodation",
      },
    },
    error: null,
  });

  assert.equal(result.status, "review");
  assert.equal(result.error, "waterbody_poi_mismatch");
});

test("geocodeWithOpenCage holds directional fragments that resolve to POIs", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "Nefeli Hotel, Komotinis - Alexandroupolis, 681 00 Nea Chili, Greece",
            geometry: { lat: 40.8540497, lng: 25.8065251 },
            confidence: 10,
            components: {
              _type: "hotel",
              _category: "accommodation",
              tourism: "hotel",
              country: "Greece",
              country_code: "gr",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    const result = await geocodeWithOpenCage(
      { queryText: "West, Greece", queryKey: "west greece", countryHint: "gr" },
      openCageConfig
    );

    assert.equal(result.status, "review");
    assert.equal(result.error, "directional_fragment_poi");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage holds ambiguous coastal names that resolve inland", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "Argentario, Trento, Italy",
            geometry: { lat: 46.0921068, lng: 11.1451359 },
            confidence: 7,
            components: {
              _type: "city",
              city: "Argentario",
              county: "Trento",
              state: "Trentino-Alto Adige",
              country: "Italy",
              country_code: "it",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    const result = await geocodeWithOpenCage(
      { queryText: "Argentario, Italy", queryKey: "argentario italy", countryHint: "it" },
      openCageConfig
    );

    assert.equal(result.status, "review");
    assert.equal(result.error, "ambiguous_coastal_name");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("coastal-name guard accepts the vetted Argentario coastal area", () => {
  const result = reviewGeocodeResultQuality("Argentario, Italy", {
    status: "geocoded",
    latitude: 42.434,
    longitude: 11.119,
    precision: "city",
    score: 0.82,
    placeName: "58019 Monte Argentario GR, Italy",
    provider: "opencage",
    payload: {
      components: {
        _type: "town",
        town: "Monte Argentario",
        county: "Grosseto",
        state: "Tuscany",
        country: "Italy",
        country_code: "it",
      },
    },
    error: null,
  });

  assert.equal(result.status, "geocoded");
  assert.equal(result.error, null);
});

test("geocodeWithOpenCage does not infer marina from harbourside substrings", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "Harbourside Kitchen, Strattonhall Drift, East Suffolk, IP10 0LN, United Kingdom",
            geometry: { lat: 51.9965539, lng: 1.2717108 },
            confidence: 10,
            components: {
              _type: "restaurant",
              _category: "commerce",
              amenity: "restaurant",
              road: "Strattonhall Drift",
              county: "East Suffolk",
              postcode: "IP10 0LN",
              country: "United Kingdom",
              country_code: "gb",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    const result = await geocodeWithOpenCage(
      {
        queryText: "Suffolk Yacht Harbour, United Kingdom",
        queryKey: "suffolk yacht harbour united kingdom",
        countryHint: "gb",
      },
      openCageConfig
    );

    assert.equal(result.status, "review");
    assert.equal(result.precision, "unknown");
    assert.equal(result.error, "low_precision");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage does not infer marina from Dover road or pier text", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "Dover Pier, New Marina Curve Road, Dover, CT17 9FJ, United Kingdom",
            geometry: { lat: 51.1191352, lng: 1.317098 },
            confidence: 10,
            components: {
              _type: "pier",
              pier: "Dover Pier",
              road: "New Marina Curve Road",
              town: "Dover",
              country: "United Kingdom",
              country_code: "gb",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    const result = await geocodeWithOpenCage(
      {
        queryText: "Dover Marina, Kent, United Kingdom",
        queryKey: "dover marina kent united kingdom",
        countryHint: "gb",
      },
      openCageConfig
    );

    assert.equal(result.status, "geocoded");
    assert.equal(result.precision, "city");
    assert.equal(result.error, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage accepts explicit marine POI results", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "Grenada Marine, Marina Drive, Corinth, Grenada",
            geometry: { lat: 12.00442, lng: -61.7357 },
            confidence: 10,
            components: {
              _type: "restaurant",
              _category: "commerce",
              road: "Marina Drive",
              village: "Corinth",
              country: "Grenada",
              country_code: "gd",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    const result = await geocodeWithOpenCage(
      {
        queryText: "Grenada Marine Grenada",
        queryKey: "grenada marine grenada",
        countryHint: "gd",
      },
      openCageConfig
    );

    assert.equal(result.status, "geocoded");
    assert.equal(result.precision, "marina");
    assert.equal(result.error, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage accepts the verified Chatham boatyard canonical query", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "MDL Chatham Maritime Marina Boatyard, Chatham, Medway, England, United Kingdom",
            geometry: { lat: 51.4025553, lng: 0.5321595 },
            confidence: 10,
            components: {
              _type: "boatyard",
              boatyard: "MDL Chatham Maritime Marina Boatyard",
              town: "Chatham",
              county: "Medway",
              country: "United Kingdom",
              country_code: "gb",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    const result = await geocodeWithOpenCage(
      {
        queryText: "MDL Chatham Maritime Marina Boatyard, Chatham, United Kingdom",
        queryKey: "mdl chatham maritime marina boatyard chatham united kingdom",
        countryHint: "gb",
      },
      openCageConfig
    );

    assert.equal(result.status, "geocoded");
    assert.equal(result.precision, "marina");
    assert.equal(result.error, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage does not promote Chatham alias without boatyard evidence", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "MDL Chatham Maritime Marina Boatyard, Chatham, Medway, England, United Kingdom",
            geometry: { lat: 51.4025553, lng: 0.5321595 },
            confidence: 10,
            components: {
              _type: "water",
              water: "MDL Chatham Maritime Marina Boatyard",
              town: "Chatham",
              county: "Medway",
              country: "United Kingdom",
              country_code: "gb",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    const result = await geocodeWithOpenCage(
      {
        queryText: "MDL Chatham Maritime Marina Boatyard, Chatham, United Kingdom",
        queryKey: "mdl chatham maritime marina boatyard chatham united kingdom",
        countryHint: "gb",
      },
      openCageConfig
    );

    assert.equal(result.status, "geocoded");
    assert.equal(result.precision, "city");
    assert.equal(result.error, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("cached geocode promotion releases verified public-pin aliases", () => {
  const result = promoteVerifiedPublicPinAliasPrecision("Conwy Marina, United Kingdom", {
    status: "geocoded",
    latitude: 53.2885,
    longitude: -3.8396,
    precision: "city",
    score: 1,
    placeName: "Conwy Marina, Conwy Marina Village, LL32 8GU, United Kingdom",
    provider: "opencage",
    payload: {
      components: {
        _type: "boatyard",
        boatyard: "Conwy Marina",
        country: "United Kingdom",
        country_code: "gb",
      },
    },
    error: null,
  });

  assert.equal(result.precision, "marina");
  assert.equal(result.precisionPromotedFrom, "city");
  assert.equal(result.precisionPromotionAlias, "conwy marina");
  assert.equal(result.error, null);

  const baotic = promoteVerifiedPublicPinAliasPrecision("Marina Baotic, Seget Donji, Croatia", {
    status: "geocoded",
    latitude: 43.5162193,
    longitude: 16.233877,
    precision: "city",
    score: 1,
    placeName: "Marina Baotić, Ulica don Petra Špika 2A, 21218 Seget Donji, Croatia",
    provider: "opencage",
    payload: {
      components: {
        _type: "marina",
        marina: "Marina Baotić",
        country: "Croatia",
        country_code: "hr",
      },
    },
    error: "public_pin_ineligible_precision",
  });

  assert.equal(baotic.precision, "marina");
  assert.equal(baotic.precisionPromotedFrom, "city");
  assert.equal(baotic.precisionPromotionAlias, "marina baotic");
  assert.equal(baotic.error, null);

  const lintonBay = promoteVerifiedPublicPinAliasPrecision("Linton Bay Marina", {
    status: "geocoded",
    latitude: 9.6128111,
    longitude: -79.5789435,
    precision: "city",
    score: 1,
    placeName: "Linton Bay Marina, Carretera Portobelo - La Guaira, Puerto Lindo, Colón, Panama",
    provider: "opencage",
    payload: {
      components: {
        _type: "marina",
        marina: "Linton Bay Marina",
        country: "Panama",
        country_code: "pa",
      },
    },
    error: "public_pin_ineligible_precision",
  });

  assert.equal(lintonBay.precision, "marina");
  assert.equal(lintonBay.precisionPromotedFrom, "city");
  assert.equal(lintonBay.precisionPromotionAlias, "linton bay marina");
  assert.equal(lintonBay.error, null);

  const chatham = promoteVerifiedPublicPinAliasPrecision(
    "MDL Chatham Maritime Marina Boatyard, Chatham, United Kingdom",
    {
      status: "geocoded",
      latitude: 51.4025553,
      longitude: 0.5321595,
      precision: "city",
      score: 1,
      placeName: "MDL Chatham Maritime Marina Boatyard, Chatham, Medway, England, United Kingdom",
      provider: "opencage",
      payload: {
        components: {
          _type: "boatyard",
          boatyard: "MDL Chatham Maritime Marina Boatyard",
          country: "United Kingdom",
          country_code: "gb",
        },
      },
      error: "public_pin_ineligible_precision",
    }
  );

  assert.equal(chatham.precision, "marina");
  assert.equal(chatham.precisionPromotedFrom, "city");
  assert.equal(chatham.precisionPromotionAlias, "mdl chatham maritime marina boatyard");
  assert.equal(chatham.error, null);
});

test("cached geocode promotion rejects non-contiguous and admin-place aliases", () => {
  const chatham = promoteVerifiedPublicPinAliasPrecision("Chatham Marina, Kent, United Kingdom", {
    status: "geocoded",
    latitude: 51.397,
    longitude: 0.527,
    precision: "city",
    score: 1,
    placeName: "MDL Chatham Maritime Marina Boatyard, Chatham, Medway, England, United Kingdom",
    provider: "opencage",
    payload: {
      components: {
        _type: "boatyard",
        boatyard: "MDL Chatham Maritime Marina Boatyard",
        country_code: "gb",
      },
    },
    error: null,
  });
  const marinaDelRey = promoteVerifiedPublicPinAliasPrecision(
    "Marina Del Rey, California, United States",
    {
      status: "geocoded",
      latitude: 33.98,
      longitude: -118.45,
      precision: "city",
      score: 0.82,
      placeName: "Los Angeles County, CA 90292, United States of America",
      provider: "opencage",
      payload: {
        components: {
          _type: "county",
          county: "Los Angeles County",
          country_code: "us",
        },
      },
      error: null,
    }
  );

  assert.equal(chatham.precision, "city");
  assert.equal(chatham.precisionPromotionAlias, undefined);
  assert.equal(marinaDelRey.precision, "city");
  assert.equal(marinaDelRey.precisionPromotionAlias, undefined);
});

test("cached geocode promotion requires the verified alias anchor", () => {
  const result = promoteVerifiedPublicPinAliasPrecision("Lagoon Marina, Cole Bay", {
    status: "geocoded",
    latitude: 33.9803,
    longitude: -118.4517,
    precision: "city",
    score: 1,
    placeName: "Lagoon Marina, Admiralty Way, Marina del Rey, California, United States",
    provider: "opencage",
    payload: {
      components: {
        _type: "marina",
        country_code: "us",
        marina: "Lagoon Marina",
      },
    },
    error: "public_pin_ineligible_precision",
  });

  assert.equal(result.precision, "city");
  assert.equal(result.error, "public_pin_ineligible_precision");
  assert.equal(result.precisionPromotionAlias, undefined);
});

test("cached geocode promotion releases Green Cay Marina alias", () => {
  const greenCay = promoteVerifiedPublicPinAliasPrecision(
    "Green Cay Marina, Christiansted, US Virgin Islands",
    {
      status: "geocoded",
      latitude: 17.7591487,
      longitude: -64.6694756,
      precision: "city",
      score: 1,
      placeName:
        "Green Cay Marina, 5000 Southgate Estate, Shoys, Christiansted, VI 00820, United States of America",
      provider: "opencage",
      payload: {
        components: {
          _type: "marina",
          marina: "Green Cay Marina",
          country: "United States of America",
          country_code: "us",
        },
      },
      error: "public_pin_ineligible_precision",
    }
  );

  assert.equal(greenCay.precision, "marina");
  assert.equal(greenCay.precisionPromotedFrom, "city");
  assert.equal(greenCay.precisionPromotionAlias, "green cay marina");
  assert.equal(greenCay.error, null);
});

test("cached geocode promotion rejects Green Cay alias without marina component or wrong country", () => {
  // Wrong country: Bahamian result with marina named "Green Cay Marina" (hypothetical)
  // must not promote. Anchor country check rejects.
  const wrongCountry = promoteVerifiedPublicPinAliasPrecision(
    "Green Cay Marina, Bahamas",
    {
      status: "geocoded",
      latitude: 24.0396,
      longitude: -77.1716,
      precision: "city",
      score: 1,
      placeName: "Green Cay Marina, Bahamas",
      provider: "opencage",
      payload: {
        components: {
          _type: "marina",
          marina: "Green Cay Marina",
          country: "Bahamas",
          country_code: "bs",
        },
      },
      error: null,
    }
  );
  assert.equal(wrongCountry.precision, "city");
  assert.equal(wrongCountry.precisionPromotionAlias, undefined);

  // `_type=water` at USVI coords: no marina component → required-component check fails.
  const waterType = promoteVerifiedPublicPinAliasPrecision(
    "Green Cay Marina, Christiansted, US Virgin Islands",
    {
      status: "geocoded",
      latitude: 17.7591487,
      longitude: -64.6694756,
      precision: "city",
      score: 1,
      placeName: "Green Cay Harbour, Christiansted, USVI",
      provider: "opencage",
      payload: {
        components: {
          _type: "water",
          water: "Green Cay Harbour",
          country_code: "us",
        },
      },
      error: "public_pin_ineligible_precision",
    }
  );
  assert.equal(waterType.precision, "city");
  assert.equal(waterType.precisionPromotionAlias, undefined);

  // City result lacking "green cay marina" in place name also rejects because
  // the alias match requires the phrase in both query and result.
  const cityResult = promoteVerifiedPublicPinAliasPrecision(
    "Green Cay Marina, St Croix, US Virgin Islands",
    {
      status: "geocoded",
      latitude: 17.74664,
      longitude: -64.7032,
      precision: "city",
      score: 1,
      placeName: "St Croix, Virgin Islands, United States of America",
      provider: "opencage",
      payload: {
        components: {
          _type: "city",
          town: "St Croix",
          country_code: "us",
        },
      },
      error: "public_pin_ineligible_precision",
    }
  );
  assert.equal(cityResult.precision, "city");
  assert.equal(cityResult.precisionPromotionAlias, undefined);
});

test("geocodeWithOpenCage promotes Green Cay canonical query to marina precision", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted:
              "Green Cay Marina, 5000 Southgate Estate, Shoys, Christiansted, VI 00820, United States of America",
            geometry: { lat: 17.7591487, lng: -64.6694756 },
            confidence: 9,
            components: {
              _type: "marina",
              _category: "outdoors/recreation",
              marina: "Green Cay Marina",
              town: "Christiansted",
              state: "Virgin Islands",
              country: "United States of America",
              country_code: "us",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    const result = await geocodeWithOpenCage(
      {
        queryText: "Green Cay Marina, Christiansted, US Virgin Islands",
        queryKey: "green cay marina christiansted us virgin islands",
        countryHint: "vi",
      },
      openCageConfig
    );

    assert.equal(result.status, "geocoded");
    assert.equal(result.precision, "marina");
    assert.equal(result.error, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage does not promote Green Cay alias when provider returns water type", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "Green Cay, Christiansted, VI, United States of America",
            geometry: { lat: 17.7591487, lng: -64.6694756 },
            confidence: 9,
            components: {
              _type: "water",
              water: "Green Cay",
              town: "Christiansted",
              country: "United States of America",
              country_code: "us",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    const result = await geocodeWithOpenCage(
      {
        queryText: "Green Cay Marina, Christiansted, US Virgin Islands",
        queryKey: "green cay marina christiansted us virgin islands",
        countryHint: "vi",
      },
      openCageConfig
    );

    assert.equal(result.status, "geocoded");
    assert.notEqual(result.precision, "marina");
    assert.equal(result.error, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage accepts confidence=2 exact City,Country when primary city component matches exactly", async () => {
  // Round 32 extension: conf=2 2-part City,Country queries were previously held
  // in review even when the provider returned the correct city. Extension allows
  // conf=2 when components.city (or town/village/etc.) EXACTLY equals the
  // queried city part. Bodrum/Marmaris/Corfu cases unblock; ambiguous-name
  // traps still fail because the provider's primary component won't match
  // exactly.
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "Bodrum, Turkey",
            geometry: { lat: 37.0344, lng: 27.4305 },
            confidence: 2,
            components: {
              _type: "city",
              city: "Bodrum",
              state: "Muğla",
              country: "Turkey",
              country_code: "tr",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    const result = await geocodeWithOpenCage(
      {
        queryText: "Bodrum, Turkey",
        queryKey: "bodrum turkey",
        countryHint: "tr",
      },
      openCageConfig
    );

    assert.equal(result.status, "geocoded");
    assert.equal(result.precision, "city");
    assert.equal(result.error, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage still holds confidence=2 City,Country when city component differs", async () => {
  // Round 32 guard: conf=2 is only accepted when the primary city component
  // EXACTLY matches the queried city. If provider returned a similarly-named
  // but different city, we must still hold it in review.
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "Springfield, IL, United States of America",
            geometry: { lat: 39.78, lng: -89.65 },
            confidence: 2,
            components: {
              _type: "city",
              city: "Springfield",
              state: "Illinois",
              country: "United States of America",
              country_code: "us",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    // Query is `Springfield, United Kingdom` — a made-up ambiguous case.
    // Provider country_code=us mismatches queryParts.countryCode=gb → rejected.
    const result = await geocodeWithOpenCage(
      {
        queryText: "Springfield, United Kingdom",
        queryKey: "springfield united kingdom",
        countryHint: "gb",
      },
      openCageConfig
    );

    assert.equal(result.status, "review");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage holds confidence=2 when primary city component mismatches the queried city", async () => {
  // Sibling guard: same country but provider's primary component is a
  // DIFFERENT same-country city. Only the city-component-equality check saves
  // us here — the loose conf=3 text-inclusion would falsely accept.
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "Mudanya, Bursa, Turkey",
            geometry: { lat: 40.37, lng: 28.88 },
            confidence: 2,
            components: {
              _type: "city",
              city: "Mudanya",
              state: "Bursa",
              country: "Turkey",
              country_code: "tr",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    // Query is `Bursa, Turkey` but provider returned Mudanya (a town inside
    // Bursa province). The loose text-inclusion check would pass because
    // formatted text contains "Bursa". The tight component-equality check
    // rejects because components.city=Mudanya !== "bursa".
    const result = await geocodeWithOpenCage(
      {
        queryText: "Bursa, Turkey",
        queryKey: "bursa turkey",
        countryHint: "tr",
      },
      openCageConfig
    );

    assert.equal(result.status, "review");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage accepts overseas-territory ↔ sovereign country-code equivalence for exact City,Country", async () => {
  // Round 35: OpenCage reports Martinique with country_code=fr even when the
  // query countryHint is `mq` (the ISO alpha-2 for Martinique). Equivalence
  // list accepts mq↔fr, vg↔gb, vi↔us, sx↔nl, pf↔fr, etc.
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "Le Marin, Martinique, France",
            geometry: { lat: 14.471, lng: -60.87 },
            confidence: 3,
            components: {
              _type: "municipality",
              city: "Le Marin",
              state: "Martinique",
              country: "France",
              country_code: "fr",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    const result = await geocodeWithOpenCage(
      {
        queryText: "Le Marin, Martinique",
        queryKey: "le marin martinique",
        countryHint: "mq",
      },
      openCageConfig
    );

    assert.equal(result.status, "geocoded");
    assert.equal(result.precision, "city");
    assert.equal(result.error, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage still rejects non-equivalent country-code mismatches at conf=3", async () => {
  // Round 35 safety: mq↔fr equivalence does NOT imply mq↔es. A similar-sounding
  // place in Spain with Spanish country code must stay rejected when query
  // expected Martinique.
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "Marin, Pontevedra, Spain",
            geometry: { lat: 42.4, lng: -8.7 },
            confidence: 3,
            components: {
              _type: "city",
              city: "Marin",
              country: "Spain",
              country_code: "es",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    const result = await geocodeWithOpenCage(
      {
        queryText: "Le Marin, Martinique",
        queryKey: "le marin martinique",
        countryHint: "mq",
      },
      openCageConfig
    );

    assert.equal(result.status, "review");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage accepts 3-part City,Region,Country at confidence=3 via the exact-city exception", async () => {
  // Round 34: the Round 21 `exact City, Country` exception was widened to also
  // accept `City, Region, Country` 3-part queries. Region is additional
  // narrowing; it must be a real region token (not another country, not broad).
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "Alicante, Valencian Community, Spain",
            geometry: { lat: 38.3452, lng: -0.481 },
            confidence: 3,
            components: {
              _type: "city",
              city: "Alicante",
              state: "Valencian Community",
              country: "Spain",
              country_code: "es",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    const result = await geocodeWithOpenCage(
      {
        queryText: "Alicante, Valencian Community, Spain",
        queryKey: "alicante valencian community spain",
        countryHint: "es",
      },
      openCageConfig
    );

    assert.equal(result.status, "geocoded");
    assert.equal(result.precision, "city");
    assert.equal(result.error, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage still rejects 3-part queries when city component mismatches", async () => {
  // Round 34 safety: 3-part extension must still reject wrong-city provider
  // responses. Here the provider returned a same-country different city.
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "Valencia, Valencian Community, Spain",
            geometry: { lat: 39.47, lng: -0.37 },
            confidence: 3,
            components: {
              _type: "city",
              city: "Valencia",
              state: "Valencian Community",
              country: "Spain",
              country_code: "es",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    const result = await geocodeWithOpenCage(
      {
        queryText: "Alicante, Valencian Community, Spain",
        queryKey: "alicante valencian community spain",
        countryHint: "es",
      },
      openCageConfig
    );

    // Loose conf=3 check: result text does not contain "alicante" → rejected.
    assert.equal(result.status, "review");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage rejects 3-part queries when middle part is itself a country", async () => {
  // Round 34 safety: `City, Country, Country` nonsense pattern must be rejected
  // because the middle part resolving to a country code indicates the query is
  // malformed, not a clean City,Region,Country.
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "Some place, France, Spain",
            geometry: { lat: 40, lng: 0 },
            confidence: 3,
            components: {
              _type: "city",
              city: "Someplace",
              country: "Spain",
              country_code: "es",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    const result = await geocodeWithOpenCage(
      {
        queryText: "Someplace, France, Spain",
        queryKey: "someplace france spain",
        countryHint: "es",
      },
      openCageConfig
    );

    assert.equal(result.status, "review");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage does not promote known-marina names that resolve to island/admin-boundary types", async () => {
  // Round 28 regression: the `Tortola, Nanny Cay, British Virgin Islands` query
  // resolved to `Nanny Cay, British Virgin Islands` with `_type=island`,
  // `_category=natural/water`. Because both query and result contained "nanny cay"
  // (a STATIC_KNOWN_MARINA_NAME_TERMS entry), the classifier promoted it to marina
  // precision despite `_type=island`. That put an admin-boundary pin on the public
  // map, tripping the `public_admin_boundary_zero` readiness gate. The guard in
  // resultAndQueryHaveKnownMarinaName must reject admin-boundary result types.
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "Nanny Cay, British Virgin Islands",
            geometry: { lat: 18.399, lng: -64.63392 },
            confidence: 9,
            components: {
              _type: "island",
              _category: "natural/water",
              island: "Nanny Cay",
              country: "British Virgin Islands",
              country_code: "vg",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    const result = await geocodeWithOpenCage(
      {
        queryText: "Tortola, Nanny Cay, British Virgin Islands",
        queryKey: "tortola nanny cay british virgin islands",
        countryHint: "vg",
      },
      openCageConfig
    );

    assert.equal(result.status, "geocoded");
    assert.notEqual(result.precision, "marina", "island-type result must not promote to marina");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage accepts vetted known-marina names without a marina token", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "Nanny Cay, Nanny Cay Road, Road Town, British Virgin Islands, VG1110",
            geometry: { lat: 18.4002615, lng: -64.6346599 },
            confidence: 10,
            components: {
              _type: "road",
              road: "Nanny Cay Road",
              town: "Road Town",
              country: "British Virgin Islands",
              country_code: "vg",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    const result = await geocodeWithOpenCage(
      {
        queryText: "Nanny Cay Tortola, British Virgin Islands",
        queryKey: "nanny cay tortola british virgin islands",
        countryHint: "vg",
      },
      openCageConfig
    );

    assert.equal(result.status, "geocoded");
    assert.equal(result.precision, "marina");
    assert.equal(result.error, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage accepts vetted known-marina names over generic city typing", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "Puerto del Rey Marina, Fajardo, Puerto Rico, 00738, United States of America",
            geometry: { lat: 18.2882, lng: -65.6362 },
            confidence: 10,
            components: {
              _type: "city",
              city: "Puerto del Rey Marina",
              municipality: "Fajardo",
              country: "United States",
              country_code: "us",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    const result = await geocodeWithOpenCage(
      {
        queryText: "Puerto Del Rey Marina Fajardo, Puerto Rico",
        queryKey: "puerto del rey marina fajardo puerto rico",
        countryHint: "pr",
      },
      openCageConfig
    );

    assert.equal(result.status, "geocoded");
    assert.equal(result.precision, "marina");
    assert.equal(result.error, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage accepts lower-confidence marine hits only when query and result agree", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "Port Tino Rossi, 20000 Ajaccio, France",
            geometry: { lat: 41.9187255, lng: 8.7413568 },
            confidence: 6,
            components: {
              _type: "road",
              road: "Port Tino Rossi",
              city: "Ajaccio",
              country: "France",
              country_code: "fr",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    const result = await geocodeWithOpenCage(
      {
        queryText: "Port Tino Rossi, Ajaccio, France",
        queryKey: "port tino rossi ajaccio france",
        countryHint: "fr",
      },
      openCageConfig
    );

    assert.equal(result.status, "geocoded");
    assert.equal(result.precision, "marina");
    assert.equal(result.error, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage keeps misleading marine-ish street matches in review", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            formatted: "le Port Rolland, 44290 Masserac, France",
            geometry: { lat: 47.6743, lng: -1.9147 },
            confidence: 6,
            components: {
              _type: "road",
              road: "le Port Rolland",
              village: "Masserac",
              country: "France",
              country_code: "fr",
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )) as typeof fetch;

  try {
    const result = await geocodeWithOpenCage(
      {
        queryText: "Port Pin Rolland, Saint-Mandrier-sur-Mer, France",
        queryKey: "port pin rolland saint mandrier sur mer france",
        countryHint: "fr",
      },
      openCageConfig
    );

    assert.equal(result.status, "review");
    assert.notEqual(result.precision, "marina");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("geocodeWithOpenCage maps provider quota and rate errors to review", async () => {
  const originalFetch = globalThis.fetch;

  try {
    for (const status of [402, 403, 429, 503]) {
      globalThis.fetch = (async () => new Response("{}", { status })) as typeof fetch;

      const result = await geocodeWithOpenCage(
        { queryText: "Cannes, France", queryKey: "cannes france", countryHint: "fr" },
        openCageConfig
      );

      assert.equal(result.status, "review");
      assert.equal(result.error, `http_${status}`);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("deriveCountryGeocodeResult resolves stored country to centroid with country precision", () => {
  const result = deriveCountryGeocodeResult({
    locationText: null,
    country: "Greece",
    region: null,
    marketSlugs: null,
    confidence: null,
  });
  assert.ok(result);
  assert.equal(result?.status, "geocoded");
  assert.equal(result?.precision, "country");
  assert.equal(result?.provider, "derived");
  assert.equal(result?.score, 1);
  assert.equal(result?.placeName, "Greece");
  assert.ok(typeof result?.latitude === "number" && result.latitude >= -90 && result.latitude <= 90);
  assert.ok(typeof result?.longitude === "number" && result.longitude >= -180 && result.longitude <= 180);
});

test("deriveCountryGeocodeResult returns null when country is missing or unknown", () => {
  assert.equal(
    deriveCountryGeocodeResult({ country: null }),
    null
  );
  assert.equal(
    deriveCountryGeocodeResult({ country: "" }),
    null
  );
  assert.equal(
    deriveCountryGeocodeResult({ country: "Atlantis" }),
    null
  );
});

test("deriveCountryGeocodeResult ignores locationText — the stored country is the only authority", () => {
  // Boat with text like "Alimos Marina, Athens, Greece" but no country field:
  // the derivation does not parse text. Provider pipeline handles specific text;
  // derivation only fires when country is the sole reliable signal.
  const result = deriveCountryGeocodeResult({
    locationText: "Alimos Marina, Athens, Greece",
    country: null,
  });
  assert.equal(result, null);
});

test("geocodeWithOpenCage accepts country precision as geocoded under the country-minimum policy", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          status: { code: 200, message: "OK" },
          total_results: 1,
          results: [
            {
              components: {
                _type: "country",
                country: "Greece",
                country_code: "gr",
                "ISO_3166-1_alpha-2": "GR",
              },
              confidence: 1,
              formatted: "Greece",
              geometry: { lat: 39.0742, lng: 21.8243 },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )) as typeof fetch;

    const result = await geocodeWithOpenCage(
      { queryText: "Greece", queryKey: "greece", countryHint: "gr" },
      openCageConfig
    );

    assert.equal(result.precision, "country");
    assert.equal(result.status, "geocoded");
    assert.equal(result.error, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
