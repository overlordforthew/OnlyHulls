import test from "node:test";
import assert from "node:assert/strict";

import {
  buildGeocodeQuery,
  geocodeWithOpenCage,
  geocodeWithNominatim,
  getGeocodeCandidateReason,
  getGeocodingConfig,
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
      queryText: "Green Cay Marina, St Croix, US Virgin Islands",
      queryKey: "green cay marina st croix us virgin islands",
      countryHint: "vi",
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
      queryText: "Yachtclub Seget (Marina Baotić), Trogir, Croatia",
      queryKey: "yachtclub seget marina baotic trogir croatia",
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
      queryText: "Chatham Marina, Chatham Kent, United Kingdom",
      queryKey: "chatham marina chatham kent united kingdom",
      countryHint: "gb",
    }
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
