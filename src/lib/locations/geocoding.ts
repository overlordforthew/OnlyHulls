import { hasConfiguredValue } from "@/lib/capabilities";
import { getCountryCentroid } from "@/lib/locations/country-centroids";

export type GeocodingProvider = "disabled" | "nominatim" | "opencage" | "derived";
export type GeocodePrecision =
  | "exact"
  | "street"
  | "marina"
  | "city"
  | "region"
  | "country"
  | "unknown";
export type GeocodeStatus = "skipped" | "geocoded" | "failed" | "review";

export type GeocodeCandidateInput = {
  locationText?: string | null;
  country?: string | null;
  region?: string | null;
  marketSlugs?: string[] | null;
  confidence?: string | null;
};

export type GeocodeQuery = {
  queryText: string;
  queryKey: string;
  countryHint: string | null;
};

export type GeocodeResult = {
  status: GeocodeStatus;
  latitude: number | null;
  longitude: number | null;
  precision: GeocodePrecision;
  score: number | null;
  placeName: string | null;
  provider: GeocodingProvider;
  payload?: unknown;
  error?: string | null;
};

export type GeocodingConfig = {
  provider: GeocodingProvider;
  enabled: boolean;
  apiKey: string | null;
  baseUrl: string;
  userAgent: string | null;
  email: string | null;
  delayMs: number;
  timeoutMs: number;
};

const DEFAULT_NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org/search";
const DEFAULT_OPENCAGE_BASE_URL = "https://api.opencagedata.com/geocode/v1/json";
const GENERIC_LOCATION_TEXT = new Set([
  "at request",
  "by appointment",
  "center",
  "cruising",
  "east coast",
  "global",
  "marina",
  "north of",
  "south",
  "south coast",
  "south of",
  "unknown",
  "west coast",
  "west indies",
  "worldwide",
]);

const COUNTRY_CODES: Record<string, string> = {
  "antigua and barbuda": "ag",
  aruba: "aw",
  australia: "au",
  bahamas: "bs",
  belize: "bz",
  bermuda: "bm",
  "british virgin islands": "vg",
  canada: "ca",
  colombia: "co",
  croatia: "hr",
  cyprus: "cy",
  denmark: "dk",
  "dominican republic": "do",
  fiji: "fj",
  france: "fr",
  "french polynesia": "pf",
  germany: "de",
  gibraltar: "gi",
  greece: "gr",
  grenada: "gd",
  guadeloupe: "gp",
  guatemala: "gt",
  guernsey: "gg",
  honduras: "hn",
  "hong kong": "hk",
  hungary: "hu",
  indonesia: "id",
  ireland: "ie",
  italy: "it",
  jersey: "je",
  latvia: "lv",
  malaysia: "my",
  malta: "mt",
  martinique: "mq",
  mexico: "mx",
  monaco: "mc",
  montenegro: "me",
  netherlands: "nl",
  "new zealand": "nz",
  norway: "no",
  panama: "pa",
  philippines: "ph",
  poland: "pl",
  portugal: "pt",
  "puerto rico": "pr",
  "saint martin": "mf",
  "saint lucia": "lc",
  seychelles: "sc",
  "sint maarten": "sx",
  slovenia: "si",
  "south africa": "za",
  spain: "es",
  sweden: "se",
  taiwan: "tw",
  thailand: "th",
  tunisia: "tn",
  turkey: "tr",
  "united kingdom": "gb",
  "united states": "us",
  "united states virgin islands": "vi",
};
const COUNTRY_QUERY_ALIASES: Record<string, string[]> = {
  "british virgin islands": ["bvi", "virgin islands british"],
  "saint lucia": ["st lucia"],
  "saint martin": ["st martin", "saint martin french part", "mf saint martin"],
  "sint maarten": ["st maarten"],
  "united states virgin islands": [
    "us virgin islands",
    "u s virgin islands",
    "usvi",
    "usvis",
    "virgin islands us",
    "virgin islands us usvi",
  ],
};
const BROAD_GEOCODE_PARTS = new Set([
  "adriatic",
  "adriatic sea",
  "aegean sea",
  "caribbean",
  "caribbean sea",
  "caraibi",
  "caraibes",
  "caraibbean",
  "caribbeans",
  "caribeann",
  "channel islands",
  "chesapeake bay",
  "great lakes",
  "indian ocean",
  "ionian sea",
  "mediterranean",
  "mediterranean sea",
  "new england",
  "north",
  "north sea",
  "dutch antilles",
  "netherlands antilles",
  "pacific ocean",
  "pacific northwest",
  "south pacific",
  "west indies",
  "europe",
]);
const BROAD_GEOCODE_EDGE_PHRASES = Array.from(BROAD_GEOCODE_PARTS).sort(
  (left, right) => right.length - left.length
);
const ADMIN_REGION_ADDRESS_TYPES = new Set(["state", "region", "province", "county", "island"]);
const STREET_PLACE_TYPES = new Set(["house", "building", "amenity", "road", "street", "residential"]);
const POI_PLACE_TYPES = new Set([
  "accommodation",
  "bar",
  "cafe",
  "club",
  "commercial",
  "community_centre",
  "camping",
  "fuel",
  "government",
  "guest_house",
  "hostel",
  "hotel",
  "industrial",
  "motel",
  "office",
  "police",
  "resort",
  "restaurant",
  "shop",
  "social_centre",
  "tourism",
]);
const POI_PLACE_CATEGORIES = new Set([
  "accommodation",
  "building",
  "commerce",
  "commercial",
  "education",
  "government",
  "industrial",
  "office",
  "road",
  "social",
  "tourism",
]);
const CITY_PLACE_TYPES = new Set([
  "city",
  "town",
  "village",
  "hamlet",
  "municipality",
  "suburb",
  "neighbourhood",
  "neighborhood",
]);
const OPENCAGE_REGION_TYPES = new Set([...ADMIN_REGION_ADDRESS_TYPES, "body_of_water"]);
const OPENCAGE_MIN_CONFIDENCE_BY_PRECISION: Partial<Record<GeocodePrecision, number>> = {
  exact: 8,
  street: 7,
  marina: 7,
};
const WATERBODY_QUERY_TERMS = [
  "sea",
  "ocean",
  "gulf",
  "bay",
  "strait",
  "channel",
  "sound",
  "lagoon",
  "fjord",
  "lake",
  "canal",
  "bight",
];
const WATERBODY_POI_TERMS = [
  "apartment",
  "apartments",
  "bar",
  "camping",
  "campground",
  "guest house",
  "hostel",
  "hotel",
  "inn",
  "motel",
  "restaurant",
  "resort",
  "villa",
  "villas",
];
const DIRECTIONAL_FRAGMENT_TERMS = new Set([
  "n",
  "s",
  "e",
  "w",
  "ne",
  "nw",
  "se",
  "sw",
  "north",
  "south",
  "east",
  "west",
  "northeast",
  "northwest",
  "southeast",
  "southwest",
]);
const AMBIGUOUS_COASTAL_NAME_RULES = [
  {
    queryTerm: "argentario",
    acceptedResultTerms: [
      "monte argentario",
      "grosseto",
      "porto ercole",
      "porto santo stefano",
      "toscana",
      "tuscany",
    ],
  },
];

function normalizeLookupValue(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeGeocodeQueryKey(value?: string | null) {
  return normalizeLookupValue(value);
}

function uniqueParts(parts: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const part of parts) {
    const trimmed = String(part || "").trim();
    const key = normalizeLookupValue(trimmed);
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

function stripBroadGeocodeParentheticals(value: string) {
  return value
    .replace(/\(([^)]*)\)/g, (match, inner) =>
      BROAD_GEOCODE_PARTS.has(normalizeLookupValue(inner)) ? "" : match
    )
    .replace(/\s+/g, " ")
    .trim();
}

function stripGeocodeSourceArtifacts(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&#x?[0-9a-f]+;/gi, " ")
    .replace(/\s+\bprice\s*:\s*(?:[$€£]?\s*[\d,\s.]+|upon request|contact(?:\s+\w+)*)\s*$/i, "")
    .replace(/\s+\bavailable\s+in\b.+?\bupon\s+request\b.*$/i, "")
    .replace(/\s+\bupon\s+request\b.*$/i, "")
    .replace(/\s+\b(?:north|south|east|west)\s+of\b\s*,?/gi, ",")
    .replace(/\s+\bflag\s*[:;-]\s*[a-z .]+$/i, "")
    .replace(
      /\s+\b(?:u\.?\s*s\.?\s*a?\.?|usa|us|american|canadian|british|french|german|dutch|spanish|italian|greek|turkish|croatian)\s+flag\b\s*$/i,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKnownLocationTextArtifacts(value: string) {
  // Live broker/source artifacts observed in the geocode review queue; keep each rule scoped and test-backed.
  return value
    .replace(/^\s*Aaan\s+Verkoopsteiger\s+In\s+/gi, "")
    .replace(/^\s*Aan\s+Verkoopsteiger\s+In\s+/gi, "")
    .replace(/\bGenoa\s*,\s*Italyn\s*\/\s*A\b/gi, "Genoa, Italy")
    .replace(/\bItalyn\s*\/\s*A\b/gi, "Italy")
    .replace(/\bBahmas\b/gi, "Bahamas")
    .replace(/\bBizerte\s+Tunis\b/gi, "Bizerte, Tunisia")
    .replace(/\bCartagena\s+De\s+Indias\s+Colombia\b/gi, "Cartagena De Indias, Colombia")
    .replace(/\bChiapas\s+Marina\s*,\s*Mexico\b/gi, "Marina Chiapas, Chiapas, Mexico")
    .replace(/\bCroatiaistrien\b/gi, "Istria, Croatia")
    .replace(
      /\bClarke'?s\s+Court\s+Boatyard\s*(?:&|and)\s*Marina(?:\s*,\s*Grenada)?\b/gi,
      "Clarkes Court Boatyard and Marina, Grenada"
    )
    .replace(
      /^\s*\*+\s*Bluffers\s+Park\s+Yacht\s+Club\s*,?\s*Live\s+Aboard\s+Marina!?\s*$/gi,
      "Bluffer's Park Yacht Club, Toronto, Canada"
    )
    .replace(
      /\bNorthern\s+Ireland\s*,\s*Carrickfergus\s+Marina\b/gi,
      "Carrickfergus Marina, Carrickfergus, County Antrim, United Kingdom"
    )
    .replace(/\bEnsenada\s+Mexico\s+Baja\b/gi, "Ensenada, Baja California, Mexico")
    .replace(/\bFoxs\s+Marina\s*,\s*Ipswich\b/gi, "Fox's Marina, Ipswich, United Kingdom")
    .replace(/\bGreystones\s+Harbou?r\s+Marina\b/gi, "Greystones Marina, Greystones, Ireland")
    .replace(
      /\bBritish\s+Virgin\s+Islands\s*,\s*Hodge'?s\s+Creek\s+Marina\s*,\s*Caribbean\b/gi,
      "Hodge's Creek Marina, British Virgin Islands"
    )
    .replace(/\bLa\s+Paz\s*,\s*Costa\s+Baja\s+Marina\s*,\s*Americas\b/gi, "Costa Baja Marina, La Paz, Mexico")
    .replace(/\bLinton\s+Bay\s+Marina\s+Garrote\s+Coln\s*,\s*Panama\b/gi, "Linton Bay Marina, Panama")
    .replace(
      /\bMarsh\s+Harbou?r\s*,\s*Conch\s+Inn\s+Marina\s*,\s*Bahamas\b/gi,
      "Conch Inn Marina, Marsh Harbour, Bahamas"
    )
    .replace(
      /\bHodge'?s\s+Creek\s+Marina\s+Hotel(?:\s*,\s*Parham\s+Town)?(?:\s*,\s*British\s+Virgin\s+Islands)?\b/gi,
      "Hodge's Creek Marina, British Virgin Islands"
    )
    .replace(/\bJolly\s+Harbou?r\s+Antigua\s+Barbuda\b/gi, "Jolly Harbour, Antigua and Barbuda")
    .replace(
      /\bLa\s+Cruz\s+Marina\s+Near\s+Puerto\s+Vallarta\s*,\s*Mexico\b/gi,
      "Marina La Cruz, La Cruz de Huanacaxtle, Nayarit, Mexico"
    )
    .replace(/\bLe\s+Marin\s+Martiniqe\b/gi, "Marina du Marin, Martinique")
    .replace(/\bLuperon\s+Dominican\s+Republic\s+Can\s+Be\s+Delivered\s+To\s+You\b/gi, "Luperon, Dominican Republic")
    .replace(/\bMarmaris\s+Yacht\s+Marine(?:\s*,\s*Turkey)?\b/gi, "Marmaris Yacht Marina, Turkey")
    .replace(
      /\bTrogir\s*,\s*Yachtclub\s+Seget\s*\(\s*Marina\s+Baoti[cć]\s*\)(?:\s*,\s*Mediterranean)?(?=$|[\s,])/gi,
      "Marina Baotic, Seget Donji, Croatia"
    )
    .replace(
      /\bYachtclub\s+Seget\s*\(\s*Marina\s+Baoti[cć]\s*\)\s*,\s*Trogir(?:\s*,\s*Croatia)?(?=$|[\s,])/gi,
      "Marina Baotic, Seget Donji, Croatia"
    )
    .replace(
      /\bChatham\s+Marina\s*,\s*(?:Chatham\s+)?Kent\s*(?=$|,)/gi,
      "MDL Chatham Maritime Marina Boatyard, Chatham, United Kingdom"
    )
    // Round 24: Toronto Island Marina (Canada). The two observed production rows have
    // location_text exactly `Toronto Island Marina` with no country/region qualifier.
    // Anchored to exact match so any qualifier (e.g. `Toronto Island Marina, Ontario`)
    // passes through unchanged — the alias anchor still handles those rows safely.
    .replace(
      /^\s*Toronto\s+Island\s+Marina\s*$/gi,
      "Toronto Island Marina, Toronto, Ontario, Canada"
    )
    // Round 25: Alcaidesa Marina (Spain) and D-Marin Didim Marina (Turkey). Both are
    // narrow exact-text canonicalizations — verified provider evidence shows bare/dirty
    // source text does not resolve to the facility without redirection to the canonical
    // query. Negative variants (plain `Didim`, `Didim Harbour`, `Alcaidesa Marina, Gibraltar Bay`)
    // are intentionally not touched; country filtering is still applied by query country hint.
    .replace(
      /^\s*Alcaidesa\s+Marina\s+In\s+Spain\s+Near\s+Gibraltar\s*$/gi,
      "Alcaidesa Marina, La Línea de la Concepción, Spain"
    )
    .replace(
      /^\s*Didim\s+Marina\s*,\s*Turkey\s*$/gi,
      "D-Marin Didim Marina, Didim, Turkey"
    )
    // Round 23: Green Cay Marina (USVI). Only the three observed production source texts canonicalize.
    // Plain `Green Cay Marina` (no country/state) and BVI/Bahamian variants stay untouched — the alias
    // anchor (country=us/vi, marina component) rejects them if they still reach the provider.
    .replace(
      /\bGreen\s+Cay\s+Marina\s+St\.?\s+Croix(?=$|[\s,])(?!\s*,\s*BVI\b)/gi,
      "Green Cay Marina, Christiansted, US Virgin Islands"
    )
    .replace(
      /\bGreen\s+Cay\s+Marina\s*,\s*St\s+Croix\s*,\s*Virgin\s+Islands\s*\(\s*US\s*\)\s*\(\s*USVI\s*\)/gi,
      "Green Cay Marina, Christiansted, US Virgin Islands"
    )
    .replace(
      /\bGreen\s+Cay\s+Marina\s*,\s*Virgin\s+Islands\s*\(\s*US\s*\)\s*\(\s*USVI\s*\)/gi,
      "Green Cay Marina, Christiansted, US Virgin Islands"
    )
    .replace(
      /\bMarina\s+De\s+L'?Anse\s+Marcel(?:\s*,\s*(?:(?:St\.?|Saint)\s+Martin|Sint\s+Maarten))*\b/gi,
      "Marina Anse Marcel, Saint Martin"
    )
    .replace(
      /\bCamper\s*(?:&|and)\s*Nicholsons\s+Port\s+Louis\s+Marina(?:\s*,\s*(?:St\.?\s*George'?s|Saint-?Georges))?(?:\s*,\s*Grenade)?(?:\s*,\s*Grenada)?\b/gi,
      "Port Louis Marina, Grenada"
    )
    .replace(
      /\b(?:Guadeloupe\s*,\s*)?(?:La\s+)?Marina\s+Bas\s*[- ]\s*Du\s*[- ]\s*Fort(?:\s*\([^)]*\))?(?:\s*,\s*Guadeloupe)?(?=$|[\s,])/gi,
      "Marina Bas du Fort, Le Gosier, Guadeloupe"
    )
    .replace(/\bLa\s+Paz\s+Baja\s+California\s+Sur\b/gi, "La Paz, Baja California Sur")
    .replace(/\bMarina\s+Vaiare\s*,\s*Moorea\s*,\s*Tahiti\b/gi, "Marina Vaiare, Moorea, French Polynesia")
    .replace(/\bSarnia\s+Ont\s+Lake\s+Huron\b/gi, "Sarnia, Ontario, Canada")
    .replace(/\bGoderich\s+Ontario\s*[-,]?\s*Lake\s+Huron\b/gi, "Goderich, Ontario, Canada")
    .replace(/\bOsoyoos\s+Bc\s+\d+\s+Miles\s+North\s+Of\s+Oroville\s+Wa\b/gi, "Osoyoos, BC, Canada")
    .replace(/\bOsoyoos\s+Bc\s+\d+\s+Miles\s*,\s*Oroville\s+Wa\b/gi, "Osoyoos, BC, Canada")
    .replace(/\bCanada\s+West\s+Coast\s+Just\s*,\s*Seattle\b/gi, "West Coast")
    .replace(/\bMartinique\s+French\b/gi, "Martinique")
    .replace(/\bMartiniqe\b/gi, "Martinique")
    .replace(/\bNanny\s+Cay\s+Boatyard\b/gi, "Nanny Cay Marina, Tortola, British Virgin Islands")
    .replace(/\bNanny\s+Cay\s+Tortola\b/gi, "Nanny Cay Marina, Tortola")
    .replace(/\bNanny\s+Cay\s+British\s+Virgin\s+Islands\b/gi, "Nanny Cay Marina, Tortola, British Virgin Islands")
    .replace(/\bNanny\s+Cay\s*,\s*British\s+Virgin\s+Islands\b/gi, "Nanny Cay Marina, Tortola, British Virgin Islands")
    .replace(/^\s*Nanny\s+Cay\s*$/gi, "Nanny Cay Marina, Tortola, British Virgin Islands")
    .replace(/\bKos\s*,\s*Kos\s+Marina\s*,\s*Mediterranean\b/gi, "Kos Marina, Kos, Greece")
    .replace(/\bPeloponesse\b/gi, "Peloponnese")
    .replace(/\bPenarth\s+Marina\s+Cardiff\b/gi, "Penarth Marina, United Kingdom")
    .replace(
      /\bPanama\s*[-,]?\s*Shelter\s+Bay\s+Marina\s+Atlantic\s+Side\s+Of\s+Canal\b/gi,
      "Shelter Bay Marina, Colon, Panama"
    )
    .replace(/\bPiraeus\s*\(\s*Zea\s+Marina\s*\)(?=$|[\s,])/gi, "Zea Marina, Piraeus, Greece")
    .replace(/\b(?:Corsica\s*,\s*Ajaccio\s*,\s*)?Port\s+Tino\s+Rossi(?:\s*,\s*Mediterranean)?\b/gi, "Port Tino Rossi, Ajaccio, France")
    .replace(
      /\b(?:Cote\s+D'?Azur\s*,\s*)?Port\s+Pin\s+Rolland(?:\s*,\s*Mediterranean)?\b/gi,
      "Port Pin Rolland, Saint-Mandrier-sur-Mer, France"
    )
    .replace(
      /(?:\u0160|S)ibenik\s*,\s*Marina\s+Zaton\s*,\s*Mediterranean\b/gi,
      "Marina Zaton, Sibenik, Croatia"
    )
    .replace(
      /\bPuerto\s+Escondido\s+Loreto\s+Marina\s*,?\s*BCS\b/gi,
      "Marina Puerto Escondido, Loreto, Baja California Sur, Mexico"
    )
    .replace(/\bShelter\s+Bay\s+Marina\s+Colon\s+Panama\s+Sa\b/gi, "Shelter Bay Marina, Colon, Panama")
    .replace(
      /\bDubrovnik\s*,\s*Komolac\s*,\s*ACI\s+Marina\s+Dubrovnik\b/gi,
      "ACI Marina Dubrovnik, Komolac, Croatia"
    )
    .replace(
      /\bVerkoophaven\s+Schepenkring\s*(?:[-,]\s*)?Delta\s+Marina\s+Kortgene\s*(?:[-,]\s*)?Nederland\b/gi,
      "Delta Marina, Kortgene, Netherlands"
    )
    .replace(
      /\bVerkoophaven\s+Schepenkring\s+Delta\s+Marina\s*(?:[-,]\s*)?Nederland\b/gi,
      "Delta Marina, Kortgene, Netherlands"
    )
    .replace(/\bDelta\s+Marina\s+Kortgene\s*(?:[-,]\s*)?Nederland\b/gi, "Delta Marina, Kortgene, Netherlands")
    .replace(
      /\bVerkoophaven\s+Delta\s+Marina\s*(?:[-,]\s*)?Kortgene\s*(?:[-,]\s*)?(?:\(\s*Nederland\s*\)|Nederland)(?=$|[\s,])/gi,
      "Delta Marina, Kortgene, Netherlands"
    )
    .replace(
      /\bVerkoophaven\s+Delta\s+Marina\s*(?:[-,]\s*)?(?:\(\s*Nederland\s*\)|Nederland)(?=$|[\s,])/gi,
      "Delta Marina, Kortgene, Netherlands"
    )
    .replace(/\bVerkoophaven\s+Delta\s+Marina\b/gi, "Delta Marina, Kortgene, Netherlands")
    .replace(/\bZea\s+Marina\s*,\s*Athens\b/gi, "Zea Marina, Piraeus, Greece")
    .replace(/\bCarribean\b/gi, "Caribbean")
    .replace(/\bEl\s+Hiero\b/gi, "El Hierro")
    .replace(/\bGrenade\s+Caribbean\b/gi, "Grenada")
    .replace(/\bRoad\s+Town\s+Totola\b/gi, "Road Town, Tortola")
    .replace(/\bSantantioco\b/gi, "Sant'Antioco")
    .replace(/\bSint\s+Maarten\s+Dutch\s+Part\b/gi, "Sint Maarten")
    .replace(/\bSt\.?\s+Martin\s+French\b/gi, "Saint Martin")
    .replace(/\bSaint\s+Martin\s+French\b/gi, "Saint Martin")
    .replace(/\bSt\s+Maarten\s+NA\s+Northeastern\b/gi, "Sint Maarten")
    .replace(/\bSt\s+Maarten\s+N\.?A\.?\b/gi, "Sint Maarten")
    .replace(/\bSt\s+Maarten\s+Caribbean\b/gi, "Sint Maarten")
    .replace(/\bHrvatska\b/gi, "Croatia")
    .replace(/\bSt\.?\s+Lucia\b/gi, "Saint Lucia")
    .replace(/\bSt\.?\s+Martin\b/gi, "Saint Martin")
    .replace(
      /\b((?:St\.?|Saint)\s+(?:Thomas|John|Croix)|Water Island)\s+(?:VI|USVI|USVIS)\b/gi,
      "$1, US Virgin Islands"
    )
    .replace(
      /\b((?:St\.?|Saint)\s+(?:Thomas|John|Croix)|Water Island)\s+US\s*,\s*Virgin Islands\b/gi,
      "$1, US Virgin Islands"
    )
    .replace(/\bUSVIS\b/gi, "US Virgin Islands")
    .replace(/\bUSVI\b/gi, "US Virgin Islands")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCountryAliasText(value: string, country?: string | null) {
  let normalized = value
    .replace(/\bSaint Martin\s*\(French Part\)/gi, "Saint Martin")
    .replace(/\bMF\s*\(Saint Martin\)/gi, "Saint Martin")
    .replace(/\bVirgin Islands\s*\(British\)\s*\(BVI\)/gi, "British Virgin Islands")
    .replace(/\bVirgin Islands\s*\(British\)/gi, "British Virgin Islands")
    .replace(/\bVirgin Islands\s*,\s*British\b/gi, "British Virgin Islands")
    .replace(/\b(?:U\.?S\.?|United States)\s*,\s*Virgin Islands\b/gi, "US Virgin Islands")
    .replace(/\bVirgin Islands\s*\(US\)\s*\((?:USVI|US Virgin Islands)\)/gi, "US Virgin Islands")
    .replace(/\bVirgin Islands\s*\(US\)/gi, "US Virgin Islands")
    .replace(/\bUnited States Virgin Islands\b/gi, "US Virgin Islands");

  if (normalizeLookupValue(country) === "united states virgin islands") {
    normalized = normalized.replace(
      /\b((?:St\.?|Saint)\s+(?:Thomas|John|Croix)|Water Island)\s*,\s*Virgin Islands\b/gi,
      "$1, US Virgin Islands"
    );
  }

  return normalized;
}

function canonicalizeGeocodePart(part: string) {
  const trimmed = part.trim();
  const normalized = normalizeLookupValue(trimmed);

  if (
    [
      "united states virgin islands",
      "us virgin islands",
      "u s virgin islands",
      "usvi",
      "usvis",
      "virgin islands us",
      "virgin islands us usvi",
    ].includes(normalized)
  ) {
    return "US Virgin Islands";
  }
  if (["st martin", "saint martin french part", "mf saint martin"].includes(normalized)) {
    return "Saint Martin";
  }
  if (normalized === "st lucia") return "Saint Lucia";
  if (normalized === "hrvatska") return "Croatia";
  if (normalized === "italyn a") return "Italy";

  return trimmed;
}

function isBroadGeocodePart(part: string) {
  return BROAD_GEOCODE_PARTS.has(normalizeLookupValue(part));
}

function getExactCountryCodeForPart(part: string) {
  const normalized = normalizeLookupValue(part);
  const direct = COUNTRY_CODES[normalized];
  if (direct) return direct;

  for (const [country, aliases] of Object.entries(COUNTRY_QUERY_ALIASES)) {
    if (aliases.some((alias) => normalizeLookupValue(alias) === normalized)) {
      return COUNTRY_CODES[country] || null;
    }
  }

  return null;
}

function chooseTargetCountryCode(parts: string[], country?: string | null) {
  const storedCountryCode = getCountryCode(country);
  const partCodes = parts
    .map(getExactCountryCodeForPart)
    .filter((code): code is string => Boolean(code));
  const uniqueCodes = Array.from(new Set(partCodes));

  if (uniqueCodes.length === 0) return storedCountryCode;
  if (uniqueCodes.length === 1) return uniqueCodes[0];

  const firstNonStored = storedCountryCode
    ? partCodes.find((code) => code !== storedCountryCode)
    : null;
  return firstNonStored || storedCountryCode || uniqueCodes[0];
}

function removeConflictingCountryParts(parts: string[], country?: string | null) {
  const targetCountryCode = chooseTargetCountryCode(parts, country);
  const hasMexico = targetCountryCode === "mx";
  const hasBaja = parts.some((part) => normalizeLookupValue(part).includes("baja california"));
  const seenCountryCodes = new Set<string>();

  return parts.filter((part) => {
    const normalized = normalizeLookupValue(part);
    if (hasMexico && hasBaja && normalized === "california") return false;

    const countryCode = getExactCountryCodeForPart(part);
    if (!countryCode) return true;
    if (targetCountryCode && countryCode !== targetCountryCode) return false;
    if (seenCountryCodes.has(countryCode)) return false;

    seenCountryCodes.add(countryCode);
    return true;
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizedHasTerm(value: string, term: string) {
  return new RegExp(`(^|\\s)${escapeRegExp(term)}(\\s|$)`).test(value);
}

function stripBroadGeocodeEdgePhrases(value: string) {
  let result = value.trim();
  let changed = true;

  while (changed) {
    changed = false;

    for (const phrase of BROAD_GEOCODE_EDGE_PHRASES) {
      const escaped = escapeRegExp(phrase).replace(/\s+/g, "\\s+");
      const leading = new RegExp(`^\\s*${escaped}\\s*(?:,|-)?\\s+`, "i");
      const trailing = new RegExp(`\\s+(?:,|-)?\\s*${escaped}\\s*$`, "i");
      const next = result
        .replace(leading, "")
        .replace(trailing, "")
        .replace(/\s+,/g, ",")
        .replace(/,\s*$/g, "")
        .replace(/\s+/g, " ")
        .trim();

      if (next !== result) {
        result = next;
        changed = true;
      }
    }
  }

  return result;
}

function isMarineGeocodePart(part: string) {
  const normalized = normalizeLookupValue(part);
  return /\b(?:marina|yacht\s*club|yachtclub|yacht\s+harbour|yacht\s+harbor|boatyard|shipyard|dock|quay|port\s+de\s+plaisance|darsena|marine)\b/i.test(
    normalized
  );
}

function isVagueDirectionalLocation(locationText: string) {
  const normalized = normalizeLookupValue(locationText);
  if (GENERIC_LOCATION_TEXT.has(normalized)) return true;

  return /^(?:north|south|east|west|northeast|northwest|southeast|southwest|north east|north west|south east|south west)\s+of\b/.test(normalized);
}

function isPointOfInterestResult(type: string, category: string) {
  return (
    STREET_PLACE_TYPES.has(type) ||
    STREET_PLACE_TYPES.has(category) ||
    POI_PLACE_TYPES.has(type) ||
    POI_PLACE_CATEGORIES.has(category)
  );
}

function getCoreQueryText(queryText: string) {
  const parts = uniqueParts(queryText.split(",").map(canonicalizeGeocodePart)).filter(
    (part) => !getExactCountryCodeForPart(part)
  );

  return parts.join(", ").trim() || queryText.trim();
}

function getDegenerateQueryIssue(queryText: string) {
  const coreText = getCoreQueryText(queryText);
  const normalizedCore = normalizeLookupValue(coreText);
  const alphaCount = normalizedCore.replace(/[^a-z]/g, "").length;
  const tokens = normalizedCore.split(/\s+/).filter(Boolean);

  if (alphaCount < 3 || (tokens.length === 1 && tokens[0].length <= 2)) {
    return "degenerate_query";
  }

  return null;
}

function queryHasWaterbodyTerm(queryText: string) {
  const normalizedCore = normalizeLookupValue(getCoreQueryText(queryText));
  return WATERBODY_QUERY_TERMS.some((term) => normalizedHasTerm(normalizedCore, term));
}

function placeNameHasBusinessPoiTerm(placeName?: string | null) {
  const normalizedPlaceName = normalizeLookupValue(placeName);
  return WATERBODY_POI_TERMS.some((term) => normalizedHasTerm(normalizedPlaceName, term));
}

function getPayloadRecord(payload: unknown) {
  return payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
}

function getPayloadComponents(payload: unknown) {
  const payloadRecord = getPayloadRecord(payload);
  return payloadRecord.components && typeof payloadRecord.components === "object"
    ? (payloadRecord.components as Record<string, unknown>)
    : payloadRecord;
}

function getPayloadTypeAndCategory(payload: unknown) {
  const payloadRecord = getPayloadRecord(payload);
  const components = getPayloadComponents(payload);
  const type = normalizeLookupValue(
    String(components._type || payloadRecord.type || payloadRecord.addresstype || "")
  );
  const category = normalizeLookupValue(
    String(components._category || payloadRecord.category || payloadRecord.class || "")
  );

  return { type, category };
}

function payloadHasPointOfInterestType(payload: unknown) {
  const { type, category } = getPayloadTypeAndCategory(payload);
  return isPointOfInterestResult(type, category);
}

function payloadHasLocalityOrAdminAreaType(payload: unknown) {
  const { type, category } = getPayloadTypeAndCategory(payload);
  return (
    CITY_PLACE_TYPES.has(type) ||
    CITY_PLACE_TYPES.has(category) ||
    ADMIN_REGION_ADDRESS_TYPES.has(type) ||
    ADMIN_REGION_ADDRESS_TYPES.has(category)
  );
}

function getPayloadText(payload: unknown) {
  return Object.values(getPayloadComponents(payload))
    .filter((value): value is string | number => typeof value === "string" || typeof value === "number")
    .join(" ");
}

function getPayloadCountryCode(payload: unknown) {
  const payloadRecord = getPayloadRecord(payload);
  const components = getPayloadComponents(payload);
  const countryCode =
    components.country_code ||
    components.countryCode ||
    payloadRecord.country_code ||
    payloadRecord.countryCode;

  return typeof countryCode === "string" ? countryCode.toLowerCase() : null;
}

function queryIsDirectionalFragment(queryText: string) {
  const normalizedCore = normalizeLookupValue(getCoreQueryText(queryText));
  const tokens = normalizedCore.split(/\s+/).filter(Boolean);

  return tokens.length === 1 && DIRECTIONAL_FRAGMENT_TERMS.has(tokens[0]);
}

function getDirectionalFragmentIssue(
  queryText: string,
  result: Pick<GeocodeResult, "placeName" | "payload">
) {
  if (!queryIsDirectionalFragment(queryText)) return null;

  if (
    payloadHasPointOfInterestType(result.payload) ||
    placeNameHasBusinessPoiTerm(result.placeName) ||
    !payloadHasLocalityOrAdminAreaType(result.payload)
  ) {
    return "directional_fragment_poi";
  }

  return null;
}

function getAmbiguousCoastalNameIssue(
  queryText: string,
  result: Pick<GeocodeResult, "placeName" | "payload">
) {
  const normalizedCore = normalizeLookupValue(getCoreQueryText(queryText));
  const normalizedResult = normalizeLookupValue(`${result.placeName || ""} ${getPayloadText(result.payload)}`);

  for (const rule of AMBIGUOUS_COASTAL_NAME_RULES) {
    if (!normalizedHasTerm(normalizedCore, rule.queryTerm)) continue;

    const resultMatchesAcceptedCoastalArea = rule.acceptedResultTerms.some((term) =>
      normalizedHasTerm(normalizedResult, term)
    );
    if (!resultMatchesAcceptedCoastalArea) return "ambiguous_coastal_name";
  }

  return null;
}

function getGeocodeQualityIssue(queryText: string, result: Pick<GeocodeResult, "placeName" | "payload">) {
  const degenerateIssue = getDegenerateQueryIssue(queryText);
  if (degenerateIssue) return degenerateIssue;

  const directionalFragmentIssue = getDirectionalFragmentIssue(queryText, result);
  if (directionalFragmentIssue) return directionalFragmentIssue;

  if (
    queryHasWaterbodyTerm(queryText) &&
    !isMarineGeocodePart(queryText) &&
    (payloadHasPointOfInterestType(result.payload) || placeNameHasBusinessPoiTerm(result.placeName))
  ) {
    return "waterbody_poi_mismatch";
  }

  const ambiguousCoastalNameIssue = getAmbiguousCoastalNameIssue(queryText, result);
  if (ambiguousCoastalNameIssue) return ambiguousCoastalNameIssue;

  return null;
}

export function reviewGeocodeResultQuality(queryText: string, result: GeocodeResult): GeocodeResult {
  const issue = getGeocodeQualityIssue(queryText, result);
  if (!issue) return result;

  return {
    ...result,
    status: "review",
    error: issue,
  };
}

function prepareGeocodeLocationText(locationText: string, country?: string | null) {
  const sourceCleaned = normalizeKnownLocationTextArtifacts(stripGeocodeSourceArtifacts(locationText));
  const aliased = normalizeCountryAliasText(sourceCleaned, country);
  const stripped = stripBroadGeocodeEdgePhrases(
    stripBroadGeocodeParentheticals(
      normalizeKnownLocationTextArtifacts(aliased)
    )
  );
  const marineFacilityPatterns = [
    /\bmarina\b/i,
    /\byacht\s*club\b/i,
    /\byachtclub\b/i,
    /\bboatyard\b/i,
    /\bshipyard\b/i,
    /\bquay\b/i,
    /\bquays?\b/i,
    /\bdarsena\b/i,
    /\bport\s+de\s+plaisance\b/i,
    /\bdock(?:s|yard)?\b/i,
    /\bdockside\b/i,
    /\bmooring\b/i,
  ];
  const isMarineFacilityPart = (value: string) => {
    const normalized = normalizeLookupValue(value);
    return marineFacilityPatterns.some((pattern) => pattern.test(normalized));
  };
  const sanitizedParts = stripped
    .split(",")
    .map(stripBroadGeocodeEdgePhrases)
    .map(canonicalizeGeocodePart)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !isMarineFacilityPart(part));

  const parts = removeConflictingCountryParts(
    uniqueParts(sanitizedParts),
    country
  );
  const filteredParts = parts.filter((part) => !isBroadGeocodePart(part));
  if (filteredParts.length === 0) return "";
  return filteredParts.join(", ");
}

function numberFromEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function getGeocodingConfig(providerOverride?: GeocodingProvider): GeocodingConfig {
  const providerValue = String(
    providerOverride || process.env.LOCATION_GEOCODING_PROVIDER || process.env.GEOCODING_PROVIDER || ""
  )
    .trim()
    .toLowerCase();
  const provider: GeocodingProvider =
    providerValue === "nominatim" || providerValue === "opencage" ? providerValue : "disabled";
  const userAgent = process.env.LOCATION_GEOCODING_USER_AGENT || process.env.GEOCODING_USER_AGENT || null;
  const apiKey =
    process.env.LOCATION_GEOCODING_API_KEY ||
    process.env.GEOCODING_API_KEY ||
    process.env.OPENCAGE_API_KEY ||
    null;
  const configured =
    provider === "nominatim"
      ? hasConfiguredValue(userAgent)
      : provider === "opencage"
        ? hasConfiguredValue(apiKey)
        : false;
  const defaultBaseUrl =
    provider === "opencage" ? DEFAULT_OPENCAGE_BASE_URL : DEFAULT_NOMINATIM_BASE_URL;
  const defaultDelayMs = provider === "opencage" ? 200 : 1100;

  return {
    provider,
    enabled: configured,
    apiKey,
    baseUrl:
      process.env.LOCATION_GEOCODING_BASE_URL ||
      process.env.GEOCODING_BASE_URL ||
      defaultBaseUrl,
    userAgent,
    email: process.env.LOCATION_GEOCODING_EMAIL || process.env.GEOCODING_EMAIL || null,
    delayMs: numberFromEnv(process.env.LOCATION_GEOCODING_DELAY_MS || process.env.GEOCODING_DELAY_MS, defaultDelayMs),
    timeoutMs: numberFromEnv(process.env.LOCATION_GEOCODING_TIMEOUT_MS || process.env.GEOCODING_TIMEOUT_MS, 8000),
  };
}

export function getCountryCode(country?: string | null) {
  return COUNTRY_CODES[normalizeLookupValue(country)] || null;
}

// Resolves a GeocodeCandidateInput to a country-precision result without
// calling any provider. Used when the only usable data is the stored country
// field — the pipeline's floor under the country-minimum policy.
export function deriveCountryGeocodeResult(input: GeocodeCandidateInput): GeocodeResult | null {
  const countryCode = getCountryCode(input.country);
  if (!countryCode) return null;
  const centroid = getCountryCentroid(countryCode);
  if (!centroid) return null;
  return {
    status: "geocoded",
    latitude: centroid.lat,
    longitude: centroid.lng,
    precision: "country",
    score: 1,
    placeName: centroid.name,
    provider: "derived",
    payload: null,
    error: null,
  };
}

function getCountryHintForQuery(queryText: string, country?: string | null) {
  return chooseTargetCountryCode(
    uniqueParts(queryText.split(",").map(canonicalizeGeocodePart)),
    country
  );
}

function canonicalizeCountryForQuery(country?: string | null) {
  return canonicalizeGeocodePart(String(country || ""));
}

function isCountryOnlyGeocodeText(queryText: string) {
  const parts = uniqueParts(queryText.split(",").map(canonicalizeGeocodePart)).filter(
    (part) => !isBroadGeocodePart(part)
  );
  return parts.length > 0 && parts.every((part) => Boolean(getExactCountryCodeForPart(part)));
}

function locationTextIncludesCountry(locationText: string, country?: string | null) {
  const normalizedCountry = normalizeLookupValue(country);
  if (!normalizedCountry) return false;

  const normalizedLocation = normalizeLookupValue(locationText);
  const aliases = [normalizedCountry, ...(COUNTRY_QUERY_ALIASES[normalizedCountry] || [])];
  return aliases.some((alias) => normalizedLocation.includes(alias));
}

export function buildGeocodeQuery(input: GeocodeCandidateInput): GeocodeQuery | null {
  const locationText = String(input.locationText || "").trim();
  const country = String(input.country || "").trim();
  const preparedLocationText = prepareGeocodeLocationText(locationText, country);
  const normalizedLocation = normalizeLookupValue(preparedLocationText);
  if (!preparedLocationText || normalizedLocation.length < 3 || GENERIC_LOCATION_TEXT.has(normalizedLocation)) {
    return null;
  }
  if (isVagueDirectionalLocation(preparedLocationText)) return null;

  const normalizedCountry = normalizeLookupValue(country);
  if (
    COUNTRY_CODES[normalizedLocation] ||
    (normalizedCountry && normalizedCountry === normalizedLocation) ||
    isCountryOnlyGeocodeText(preparedLocationText)
  ) {
    return null;
  }

  const confidence = String(input.confidence || "").toLowerCase();
  const looksSpecific =
    confidence === "city" ||
    confidence === "exact" ||
    preparedLocationText.includes(",");
  if (!looksSpecific) return null;

  const countryHint = getCountryHintForQuery(preparedLocationText, country);
  const storedCountryHint = getCountryCode(country);
  const locationIncludesCountry =
    locationTextIncludesCountry(preparedLocationText, country) ||
    Boolean(countryHint && storedCountryHint && countryHint !== storedCountryHint);
  const parts = uniqueParts([
    preparedLocationText,
    locationIncludesCountry ? null : canonicalizeCountryForQuery(country),
  ]);
  const queryText = parts.join(", ");
  const queryKey = normalizeLookupValue(queryText);

  return {
    queryText,
    queryKey,
    countryHint,
  };
}

export function getGeocodeCandidateReason(input: GeocodeCandidateInput) {
  if (!String(input.locationText || "").trim()) return "missing_location";
  if (buildGeocodeQuery(input)) return "ready";
  if (!input.confidence || input.confidence === "unknown") return "unknown_location";
  return "needs_more_specific_location";
}

function inferNominatimPrecision(result: Record<string, unknown>): GeocodePrecision {
  const addresstype = normalizeLookupValue(String(result.addresstype || ""));
  const type = normalizeLookupValue(String(result.type || ""));
  const placeRank = Number(result.place_rank);
  const className = normalizeLookupValue(String(result.class || ""));

  if (ADMIN_REGION_ADDRESS_TYPES.has(addresstype) || ADMIN_REGION_ADDRESS_TYPES.has(type)) return "region";
  if (CITY_PLACE_TYPES.has(addresstype)) return "city";
  if (CITY_PLACE_TYPES.has(type)) return "city";
  if (["boundary", "place"].includes(className) && placeRank >= 14 && placeRank <= 18) return "city";
  if (placeRank >= 6) return "region";
  if (addresstype === "country" || placeRank <= 4) return "country";
  return "unknown";
}

function scorePrecision(baseValue: number, precision: GeocodePrecision) {
  const base = Number.isFinite(baseValue) ? Math.min(Math.max(baseValue, 0), 1) : 0.4;
  const precisionBoost: Record<GeocodePrecision, number> = {
    exact: 0.2,
    street: 0.18,
    marina: 0.16,
    city: 0.12,
    region: 0.04,
    country: -0.1,
    unknown: -0.15,
  };

  return Math.max(0, Math.min(1, base + precisionBoost[precision]));
}

function clampPrecisionToCountryOrCity(precision: GeocodePrecision): GeocodePrecision {
  if (precision === "city" || precision === "country") return precision;
  return "unknown";
}

function scoreNominatimResult(result: Record<string, unknown>, precision: GeocodePrecision) {
  const importance = Number(result.importance);
  return scorePrecision(importance, precision);
}

function inferOpenCagePrecision(
  components: Record<string, unknown>,
  confidence: number,
  queryText: string,
  formatted: string
): GeocodePrecision {
  const type = normalizeLookupValue(String(components._type || ""));
  const category = normalizeLookupValue(String(components._category || ""));

  if (isPointOfInterestResult(type, category)) {
    return "unknown";
  }
  if (CITY_PLACE_TYPES.has(type)) return "city";
  if (OPENCAGE_REGION_TYPES.has(type)) return "region";
  if (type === "country") return "country";
  if (confidence >= 7) return "city";
  if (confidence >= 4) return "region";

  return "unknown";
}

function getExactCityCountryQueryParts(query: GeocodeQuery) {
  if (!query.countryHint) return null;

  const parts = uniqueParts(query.queryText.split(",").map(canonicalizeGeocodePart));
  // Round 34: accept 2-part `City, Country` OR 3-part `City, Region, Country`.
  // For 3-part, the middle "region" part is additional narrowing; first must be
  // a city-shaped part, last must be a country code match, middle must be a
  // real region token (not another country and not broad/marine/street noise).
  if (parts.length !== 2 && parts.length !== 3) return null;

  const cityPart = parts[0];
  const countryPart = parts[parts.length - 1];
  const countryCode = getExactCountryCodeForPart(countryPart);
  const normalizedCity = normalizeLookupValue(cityPart);
  if (!countryCode || countryCode !== query.countryHint) return null;
  if (!normalizedCity || getExactCountryCodeForPart(cityPart)) return null;
  if (isBroadGeocodePart(cityPart) || isMarineGeocodePart(cityPart)) return null;

  if (parts.length === 3) {
    const regionPart = parts[1];
    const normalizedRegion = normalizeLookupValue(regionPart);
    // Region part must be a real token — not empty, not another country, not
    // broad/marine/street noise, and must not be the same as the city part.
    if (!normalizedRegion) return null;
    if (normalizedRegion === normalizedCity) return null;
    if (getExactCountryCodeForPart(regionPart)) return null;
    if (isBroadGeocodePart(regionPart) || isMarineGeocodePart(regionPart)) return null;
  }

  return {
    cityPart,
    countryPart,
    countryCode,
    normalizedCity,
  };
}

function componentsHaveSearchOnlyCityDisqualifier(components: Record<string, unknown>) {
  const { type, category } = getPayloadTypeAndCategory(components);
  if (
    isPointOfInterestResult(type, category) ||
    STREET_PLACE_TYPES.has(type) ||
    STREET_PLACE_TYPES.has(category)
  ) {
    return true;
  }

  return Object.keys(components).some((key) => {
    const normalizedKey = normalizeLookupValue(key);
    return (
      STREET_PLACE_TYPES.has(normalizedKey) ||
      POI_PLACE_TYPES.has(normalizedKey) ||
      POI_PLACE_CATEGORIES.has(normalizedKey)
    );
  });
}

function resultTextHasCountryPart(resultText: string, countryPart: string) {
  const normalizedCountry = normalizeLookupValue(countryPart);
  const aliases = [normalizedCountry, ...(COUNTRY_QUERY_ALIASES[normalizedCountry] || [])]
    .map(normalizeLookupValue)
    .filter(Boolean);

  return aliases.some((alias) => normalizedHasTerm(resultText, alias));
}

// Round 35: overseas-territory ↔ sovereign-state country-code equivalence.
// OpenCage reports many overseas territories under the sovereign country's ISO
// code (e.g. Martinique → `fr`, British Virgin Islands → `gb`) even when the
// territory has its own ISO alpha-2 (mq, vg, etc.). Without equivalence the
// exact-City-Country exception would always reject these cases even when the
// provider returned the correct city. Extend this list only for clearly
// documented overseas-territory relationships.
const TERRITORY_SOVEREIGN_EQUIVALENCE_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["mq", "fr"], // Martinique
  ["gp", "fr"], // Guadeloupe
  ["pf", "fr"], // French Polynesia
  ["re", "fr"], // Réunion
  ["nc", "fr"], // New Caledonia
  ["bl", "fr"], // Saint Barthélemy
  ["mf", "fr"], // Saint Martin (French)
  ["pm", "fr"], // Saint Pierre and Miquelon
  ["yt", "fr"], // Mayotte
  ["vg", "gb"], // British Virgin Islands
  ["vi", "us"], // US Virgin Islands
  ["sx", "nl"], // Sint Maarten
  ["cw", "nl"], // Curaçao
  ["aw", "nl"], // Aruba
  ["pr", "us"], // Puerto Rico
  ["gu", "us"], // Guam
];

function areCountryCodesEquivalent(actual: string | null, expected: string | null) {
  if (!actual || !expected) return false;
  if (actual === expected) return true;
  return TERRITORY_SOVEREIGN_EQUIVALENCE_PAIRS.some(
    ([territory, sovereign]) =>
      (actual === territory && expected === sovereign) ||
      (actual === sovereign && expected === territory)
  );
}

function allowsExactCityCountryConfidenceFloor(
  query: GeocodeQuery,
  precision: GeocodePrecision,
  confidence: number,
  formatted: string,
  components: Record<string, unknown>
) {
  if (precision !== "city" || confidence < 2) return false;

  const queryParts = getExactCityCountryQueryParts(query);
  if (!queryParts) return false;

  const actualCountryCode = getPayloadCountryCode(components);
  if (!areCountryCodesEquivalent(actualCountryCode, queryParts.countryCode)) return false;
  if (componentsHaveSearchOnlyCityDisqualifier(components)) return false;

  const componentText = Object.values(components)
    .filter((value): value is string | number => typeof value === "string" || typeof value === "number")
    .join(" ");
  const resultText = normalizeLookupValue(`${formatted} ${componentText}`);

  const hasCityAndCountry =
    normalizedHasTerm(resultText, queryParts.normalizedCity) &&
    resultTextHasCountryPart(resultText, queryParts.countryPart);

  // Round 32: accept confidence=2 City,Country matches ONLY when the provider's
  // primary city/town component value EXACTLY equals the queried city part. This
  // prevents conf=2 ambiguous-name traps (e.g. `Springfield, France` resolving
  // to some similar-but-wrong small town) while accepting clean cases where the
  // provider identified the same city name (Marmaris→Marmaris, Bodrum→Bodrum).
  // The conf=3 path keeps its looser check (city name present anywhere in
  // result text) — the conf=2 path tightens it to exact component equality.
  if (confidence < 3) {
    if (!hasCityAndCountry) return false;
    const primaryCityComponent = normalizeLookupValue(
      String(
        components.city ||
          components.town ||
          components.village ||
          components.municipality ||
          components.hamlet ||
          ""
      )
    );
    return primaryCityComponent !== "" && primaryCityComponent === queryParts.normalizedCity;
  }

  return hasCityAndCountry;
}

function validCoordinate(latitude: number, longitude: number) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export async function geocodeWithNominatim(
  query: GeocodeQuery,
  config: GeocodingConfig = getGeocodingConfig()
): Promise<GeocodeResult> {
  if (!config.userAgent) {
    return {
      status: "skipped",
      latitude: null,
      longitude: null,
      precision: "unknown",
      score: null,
      placeName: null,
      provider: "nominatim",
      error: "missing_user_agent",
    };
  }

  const url = new URL(config.baseUrl);
  url.searchParams.set("q", query.queryText);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("dedupe", "1");
  if (query.countryHint) url.searchParams.set("countrycodes", query.countryHint);
  if (config.email) url.searchParams.set("email", config.email);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": config.userAgent,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const providerBackoff = response.status === 429 || response.status === 503;
      return {
        status: providerBackoff || response.status === 403 ? "review" : "failed",
        latitude: null,
        longitude: null,
        precision: "unknown",
        score: null,
        placeName: null,
        provider: "nominatim",
        error: `http_${response.status}`,
      };
    }

    const payload = await response.json();
    const first = Array.isArray(payload) ? payload[0] : null;
    if (!first || typeof first !== "object") {
      return {
        status: "review",
        latitude: null,
        longitude: null,
        precision: "unknown",
        score: null,
        placeName: null,
        provider: "nominatim",
        payload,
        error: "no_result",
      };
    }

    const result = first as Record<string, unknown>;
    const latitude = Number(result.lat);
    const longitude = Number(result.lon);
    if (!validCoordinate(latitude, longitude)) {
      return {
        status: "failed",
        latitude: null,
        longitude: null,
        precision: "unknown",
        score: null,
        placeName: String(result.display_name || "") || null,
        provider: "nominatim",
        payload: result,
        error: "invalid_coordinates",
      };
    }

    const precision = clampPrecisionToCountryOrCity(inferNominatimPrecision(result));
    const score = scoreNominatimResult(result, precision);
    const needsReview =
      precision === "unknown" || (precision !== "country" && score < 0.35);

    return reviewGeocodeResultQuality(query.queryText, {
      status: needsReview ? "review" : "geocoded",
      latitude,
      longitude,
      precision,
      score,
      placeName: String(result.display_name || "") || null,
      provider: "nominatim",
      payload: result,
      error: needsReview ? "low_precision" : null,
    });
  } catch (err) {
    return {
      status: "failed",
      latitude: null,
      longitude: null,
      precision: "unknown",
      score: null,
      placeName: null,
      provider: "nominatim",
      error: err instanceof Error ? err.message : "request_failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function geocodeWithOpenCage(
  query: GeocodeQuery,
  config: GeocodingConfig = getGeocodingConfig()
): Promise<GeocodeResult> {
  if (!config.apiKey) {
    return {
      status: "skipped",
      latitude: null,
      longitude: null,
      precision: "unknown",
      score: null,
      placeName: null,
      provider: "opencage",
      error: "missing_api_key",
    };
  }

  const url = new URL(config.baseUrl);
  url.searchParams.set("key", config.apiKey);
  url.searchParams.set("q", query.queryText);
  url.searchParams.set("limit", "1");
  url.searchParams.set("no_annotations", "1");
  url.searchParams.set("language", "en");
  if (query.countryHint) url.searchParams.set("countrycode", query.countryHint);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (config.userAgent) headers["User-Agent"] = config.userAgent;

    const response = await fetch(url, {
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      const providerBackoff = [402, 403, 429, 503].includes(response.status);
      return {
        status: providerBackoff ? "review" : "failed",
        latitude: null,
        longitude: null,
        precision: "unknown",
        score: null,
        placeName: null,
        provider: "opencage",
        error: `http_${response.status}`,
      };
    }

    const payload = await response.json();
    const payloadRecord = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
    const results = Array.isArray(payloadRecord.results) ? payloadRecord.results : [];
    const first = results[0];
    if (!first || typeof first !== "object") {
      return {
        status: "review",
        latitude: null,
        longitude: null,
        precision: "unknown",
        score: null,
        placeName: null,
        provider: "opencage",
        payload,
        error: "no_result",
      };
    }

    const result = first as Record<string, unknown>;
    const geometry = result.geometry && typeof result.geometry === "object"
      ? (result.geometry as Record<string, unknown>)
      : {};
    const latitude = Number(geometry.lat);
    const longitude = Number(geometry.lng);
    if (!validCoordinate(latitude, longitude)) {
      return {
        status: "failed",
        latitude: null,
        longitude: null,
        precision: "unknown",
        score: null,
        placeName: String(result.formatted || "") || null,
        provider: "opencage",
        payload: result,
        error: "invalid_coordinates",
      };
    }

    const components = result.components && typeof result.components === "object"
      ? (result.components as Record<string, unknown>)
      : {};
    const confidence = Number(result.confidence);
    const normalizedConfidence = Number.isFinite(confidence) ? Math.min(Math.max(confidence, 0), 10) : 0;
    const formatted = String(result.formatted || "") || null;
    const precision = clampPrecisionToCountryOrCity(
      inferOpenCagePrecision(
        components,
        normalizedConfidence,
        query.queryText,
        formatted || ""
      )
    );
    const score = scorePrecision(normalizedConfidence / 10, precision);
    const precisionConfidenceFloor = OPENCAGE_MIN_CONFIDENCE_BY_PRECISION[precision];
    const allowsLowConfidenceExactCity = allowsExactCityCountryConfidenceFloor(
      query,
      precision,
      normalizedConfidence,
      formatted || "",
      components
    );
    const lowConfidence =
      precision !== "country" &&
      ((normalizedConfidence < 3 && !allowsLowConfidenceExactCity) ||
        (normalizedConfidence <= 3 && !allowsLowConfidenceExactCity) ||
        (typeof precisionConfidenceFloor === "number" &&
          normalizedConfidence < precisionConfidenceFloor));
    const lowPrecision = precision === "unknown";

    return reviewGeocodeResultQuality(query.queryText, {
      status: lowConfidence || lowPrecision ? "review" : "geocoded",
      latitude,
      longitude,
      precision,
      score,
      placeName: formatted,
      provider: "opencage",
      payload: result,
      error: lowPrecision ? "low_precision" : lowConfidence ? "low_confidence" : null,
    });
  } catch (err) {
    return {
      status: "failed",
      latitude: null,
      longitude: null,
      precision: "unknown",
      score: null,
      placeName: null,
      provider: "opencage",
      error: err instanceof Error ? err.message : "request_failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}
