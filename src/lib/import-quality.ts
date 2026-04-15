export const MIN_VISIBLE_IMPORTED_PRICE_USD = 3000;
export const MIN_VISIBLE_IMPORTED_IMAGES = 1;
export const MIN_GOOD_SUMMARY_LENGTH = 40;
const GENERIC_LOCATION_VALUES = new Set([
  "outside united states",
  "outside usa",
  "outside the united states",
  "price",
  "poa",
  "call",
  "contact seller",
  "contact broker",
  "ask for location",
  "ask seller",
  "global",
  "worldwide",
  "unknown",
  "europe",
  "caribbean",
  "mediterranean",
  "north america",
  "south pacific",
]);

function toSqlStringList(values: Iterable<string>) {
  return Array.from(values, (value) => `'${value.replace(/'/g, "''")}'`).join(", ");
}

const GENERIC_LOCATION_SQL_VALUES = toSqlStringList(GENERIC_LOCATION_VALUES);

const LOCATION_LABEL_PREFIXES = [
  /^location\s*:\s*/i,
  /^located in\s+/i,
  /^area\s*:\s*/i,
  /^city\s*:\s*/i,
  /^port of registry\s*:\s*/i,
  /^port\s*:\s*/i,
];

const COUNTRY_ALIASES: Record<string, string> = {
  espagne: "Spain",
  espana: "Spain",
  españa: "Spain",
  italia: "Italy",
  deutschland: "Germany",
  hellas: "Greece",
  grece: "Greece",
  grecia: "Greece",
  greee: "Greece",
  "greecen a": "Greece",
  αλιμος: "Alimos",
  usa: "United States",
  us: "United States",
  uk: "UK",
  uae: "United Arab Emirates",
  bvi: "British Virgin Islands",
  "british virgin islands": "British Virgin Islands",
  "les vierges britanniques": "British Virgin Islands",
  "iles vierges britanniques": "British Virgin Islands",
  "îles vierges britanniques": "British Virgin Islands",
  pr: "Puerto Rico",
  hn: "Honduras",
  mx: "Mexico",
  "ducht antilles": "Dutch Antilles",
  "dutch antilles": "Dutch Antilles",
};

const LOCATION_NORMALIZATION_OVERRIDES: Record<string, string> = {
  "anguilla caribe": "Anguilla, Caribbean",
  batamindonesia: "Batam, Indonesia",
  "costa del sol el salvador": "Costa Del Sol, El Salvador",
  "denpasarbali indonesia": "Denpasar, Bali, Indonesia",
  "france cote dazur med": "France, Cote D'Azur, Mediterranean",
  "isla mujerescancunmexico": "Isla Mujeres, Cancun, Mexico",
  "la paz bcs": "La Paz, BCS",
  "luperon sailing south": "Luperon",
  "papeete tahiti french polynesia": "Papeete, Tahiti, French Polynesia",
  "roatan hn": "Roatan, Honduras",
  "st maarten ducht antilles": "St Maarten, Dutch Antilles",
  "horse shoe buoys": "Horse Shoe Buoys",
};

const COMMON_LOCATION_SUFFIXES = [
  "Puerto Rico",
  "BCS",
  "Bahamas",
  "Florida",
  "California",
  "Texas",
  "North Carolina",
  "South Carolina",
  "New York",
  "British Virgin Islands",
  "Canary Islands",
  "El Salvador",
  "French Polynesia",
  "Honduras",
  "Malaysia",
  "New Brunswick",
  "Ontario",
  "Panama",
  "Republic Of Korea",
  "Venezuela",
  "Virgin Islands",
  "West Indies",
  "United States",
  "Canada",
  "Mexico",
  "Spain",
  "France",
  "Italy",
  "Greece",
  "Croatia",
  "Turkey",
  "Indonesia",
  "British Columbia",
  "United Kingdom",
  "UK",
  "Australia",
  "New Zealand",
];

const TITLE_CASE_EXACT: Record<string, string> = {
  "o'day": "O'Day",
  oday: "O'Day",
  "o-day": "O'Day",
  macgregor: "MacGregor",
  dc: "D.C",
  "d.c": "D.C",
  bvi: "BVI",
  uk: "UK",
  usvi: "USVI",
  "x-yachts": "X-Yachts",
  "j-boats": "J/Boats",
  "jboats": "J/Boats",
  "hallberg-rassy": "Hallberg-Rassy",
};

const ALL_CAPS_KEEP = new Set(["S2", "CC", "C&C", "CSY", "J", "X"]);
const GENERIC_MODEL_TOKENS = new Set([
  "boat",
  "sailboat",
  "yacht",
  "sloop",
  "cutter",
  "ketch",
  "yawl",
  "schooner",
  "catamaran",
  "trimaran",
]);
const LOCATION_STOP_WORDS = new Set([
  "alabama",
  "alaska",
  "arizona",
  "arkansas",
  "california",
  "colorado",
  "connecticut",
  "delaware",
  "florida",
  "georgia",
  "hawaii",
  "idaho",
  "illinois",
  "indiana",
  "iowa",
  "kansas",
  "kentucky",
  "louisiana",
  "maine",
  "maryland",
  "massachusetts",
  "michigan",
  "minnesota",
  "mississippi",
  "missouri",
  "montana",
  "nebraska",
  "nevada",
  "hampshire",
  "jersey",
  "mexico",
  "york",
  "carolina",
  "dakota",
  "ohio",
  "oklahoma",
  "oregon",
  "pennsylvania",
  "rhode",
  "tennessee",
  "texas",
  "utah",
  "vermont",
  "virginia",
  "washington",
  "wisconsin",
  "wyoming",
  "outside",
  "united",
  "states",
  "england",
  "sweden",
  "france",
  "greece",
  "spain",
  "denmark",
  "germany",
  "netherlands",
  "caribbean",
  "martinique",
  "bvi",
  "tortola",
]);
const LOCATION_STATE_CODES = new Set([
  "ak",
  "al",
  "ar",
  "az",
  "ca",
  "co",
  "ct",
  "de",
  "fl",
  "ga",
  "hi",
  "ia",
  "id",
  "il",
  "in",
  "ks",
  "ky",
  "la",
  "ma",
  "md",
  "me",
  "mi",
  "mn",
  "mo",
  "ms",
  "mt",
  "nc",
  "nd",
  "ne",
  "nh",
  "nj",
  "nm",
  "nv",
  "ny",
  "oh",
  "ok",
  "or",
  "pa",
  "ri",
  "sc",
  "sd",
  "tn",
  "tx",
  "ut",
  "va",
  "vt",
  "wa",
  "wi",
  "wv",
  "wy",
]);

const WINDOWS_1252_UNICODE_TO_BYTE: Record<string, number> = {
  "\u20AC": 0x80,
  "\u201A": 0x82,
  "\u0192": 0x83,
  "\u201E": 0x84,
  "\u2026": 0x85,
  "\u2020": 0x86,
  "\u2021": 0x87,
  "\u02C6": 0x88,
  "\u2030": 0x89,
  "\u0160": 0x8a,
  "\u2039": 0x8b,
  "\u0152": 0x8c,
  "\u017D": 0x8e,
  "\u2018": 0x91,
  "\u2019": 0x92,
  "\u201C": 0x93,
  "\u201D": 0x94,
  "\u2022": 0x95,
  "\u2013": 0x96,
  "\u2014": 0x97,
  "\u02DC": 0x98,
  "\u2122": 0x99,
  "\u0161": 0x9a,
  "\u203A": 0x9b,
  "\u0153": 0x9c,
  "\u017E": 0x9e,
  "\u0178": 0x9f,
};

const UTF8_MOJIBAKE_MARKER = /[\u00c2\u00c3\u00e2\u0192]/;
const UTF8_MOJIBAKE_SIGNAL = /[\u00c2\u00c3\u00e2]/g;
const UTF8_DECODER = new TextDecoder("utf-8");

function encodeWindows1252(value: string) {
  const bytes: number[] = [];

  for (const char of value) {
    const code = char.codePointAt(0);
    if (!code) continue;

    if (code <= 0xff) {
      bytes.push(code);
      continue;
    }

    const mapped = WINDOWS_1252_UNICODE_TO_BYTE[char];
    if (mapped === undefined) {
      return null;
    }

    bytes.push(mapped);
  }

  return Uint8Array.from(bytes);
}

function countUtf8MojibakeSignals(value: string) {
  return (value.match(UTF8_MOJIBAKE_SIGNAL) || []).length;
}

function repairUtf8Mojibake(value: string) {
  let repaired = value;

  for (let pass = 0; pass < 3; pass += 1) {
    if (!UTF8_MOJIBAKE_MARKER.test(repaired)) break;

    const bytes = encodeWindows1252(repaired);
    if (!bytes) break;

    const decoded = UTF8_DECODER.decode(bytes);
    if (!decoded || decoded === repaired || decoded.includes("\uFFFD")) break;
    if (countUtf8MojibakeSignals(decoded) > countUtf8MojibakeSignals(repaired)) break;

    repaired = decoded;
  }

  return repaired;
}

function stripMojibake(value: string) {
  return value
    .replace(/â€™/g, "'")
    .replace(/â€˜/g, "'")
    .replace(/â€œ|â€/g, '"')
    .replace(/â€”|â€“/g, "-")
    .replace(/Â£/g, "")
    .replace(/â‚¬/g, "")
    .replace(/Â/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAliasKey(value: string) {
  return stripMojibake(value)
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();
}

function lookupCountryAlias(value: string) {
  return COUNTRY_ALIASES[value.toLowerCase()] ?? COUNTRY_ALIASES[normalizeAliasKey(value)];
}

function lookupLocationOverride(value: string) {
  return LOCATION_NORMALIZATION_OVERRIDES[normalizeAliasKey(value)];
}

function titleCaseTokenCore(token: string): string {
  const exact = TITLE_CASE_EXACT[token.toLowerCase()];
  if (exact) return exact;
  if (ALL_CAPS_KEEP.has(token.toUpperCase())) return token.toUpperCase();
  if (/^[a-z](?:\.[a-z]){1,3}\.?$/i.test(token)) return token.toUpperCase();
  if (/^[a-z]\d+$/i.test(token)) return token.toUpperCase();
  if (/^\d+(\.\d+)?$/.test(token)) return token;
  if (token === token.toUpperCase() && /^[\p{L}]{2,4}$/u.test(token)) return token;

  if (token.includes("'") || token.includes("’")) {
    const parts = token.split(/(['’])/);
    return parts
      .map((part, index) => {
        if (!part || part === "'" || part === "’") return part;

        const previousSeparator = parts[index - 1];
        const previousWord = parts[index - 2] || "";
        if (previousSeparator && /^s$/i.test(part) && previousWord.length > 1) {
          return "s";
        }

        return titleCaseTokenCore(part);
      })
      .join("");
  }

  if (token.includes(".")) {
    return token
      .split(/(\.)/)
      .map((part) => {
        if (!part || part === ".") return part;
        return titleCaseTokenCore(part);
      })
      .join("");
  }

  if (token.includes("/") || token.includes("-")) {
    return token
      .split(/([/-])/)
      .map((part) => {
        if (!part || part === "/" || part === "-") return part;
        return titleCaseTokenCore(part);
      })
      .join("");
  }

  const lowered = token.toLowerCase();
  return lowered.charAt(0).toUpperCase() + lowered.slice(1);
}

function titleCaseToken(token: string) {
  const clean = stripMojibake(token);
  if (!clean) return "";

  const affixMatch = clean.match(/^([^\p{L}\p{N}]*)((?:[\p{L}\p{N}.&'’]+))(.*)$/u);
  if (!affixMatch) {
    return titleCaseTokenCore(clean);
  }

  const [, prefix, core, suffix] = affixMatch;
  return `${prefix}${titleCaseTokenCore(core)}${suffix}`;
}

function normalizeLocationPart(value: string) {
  const normalized = normalizeSpacing(repairUtf8Mojibake(value))
    .replace(/^\(\d+\)\s*/g, "")
    .replace(/\p{Regional_Indicator}+/gu, " ")
    .replace(/^[./?-]+|[./?-]+$/g, "")
    .trim();
  if (!normalized) return "";

  const override = lookupLocationOverride(normalized);
  if (override) return override;

  const alias = lookupCountryAlias(normalized);
  if (alias) return alias;
  if (/^[A-Z]{2}$/.test(normalized)) return normalized;

  return normalized
    .split(/\s+/)
    .map(titleCaseToken)
    .filter(Boolean)
    .join(" ");
}

export function normalizeSpacing(value?: string | null) {
  return stripMojibake(String(value || ""))
    .replace(/[|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeImportedSummary(value?: string | null) {
  const normalized = normalizeSpacing(
    String(value || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\bcontent=.*$/i, "")
      .replace(/^["'\s]+/, "")
  );

  return normalized.length >= 20 ? normalized : "";
}

function isQuestionMarkPlaceholderLocation(value: string) {
  return value.replace(/[?,\s]+/g, "").length === 0;
}

export function normalizeImportedLocation(value?: string | null) {
  let normalized = normalizeSpacing(repairUtf8Mojibake(String(value || "")));
  if (!normalized) return "";

  for (const pattern of LOCATION_LABEL_PREFIXES) {
    normalized = normalized.replace(pattern, "");
  }

  normalized = normalized
    .replace(/\s*\|\s*/g, ", ")
    .replace(/\s*\/\s*/g, " / ")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!normalized) return "";
  if (isQuestionMarkPlaceholderLocation(normalized)) return "";
  if (GENERIC_LOCATION_VALUES.has(normalized.toLowerCase())) return "";

  const exactOverride = lookupLocationOverride(normalized);
  if (exactOverride) return exactOverride;

  const exactLocationAlias = lookupCountryAlias(normalized);
  if (exactLocationAlias) return exactLocationAlias;

  if (!normalized.includes(",")) {
    for (const suffix of COMMON_LOCATION_SUFFIXES) {
      const suffixPattern = new RegExp(`^(.+?)\\s+${suffix.replace(/\s+/g, "\\s+")}$`, "i");
      const match = normalized.match(suffixPattern);
      if (match) {
        normalized = `${match[1]}, ${suffix}`;
        break;
      }
    }
  }

  const parts = normalized
    .split(",")
    .map((part) => normalizeLocationPart(part))
    .filter(Boolean);

  const deduped = parts.filter((part, index) => part.toLowerCase() !== parts[index - 1]?.toLowerCase());
  const collapsed = deduped.join(", ").trim();

  if (!collapsed) return "";
  if (isQuestionMarkPlaceholderLocation(collapsed)) return "";
  if (GENERIC_LOCATION_VALUES.has(collapsed.toLowerCase())) return "";

  return collapsed;
}

export function hasUsableImportedLocation(value?: string | null) {
  const normalized = normalizeImportedLocation(value).toLowerCase();
  return Boolean(normalized) && !GENERIC_LOCATION_VALUES.has(normalized);
}

function canonicalizeMakeName(make: string) {
  const normalized = normalizeSpacing(make);
  if (/^o\s+day$/i.test(normalized)) return "O'Day";
  if (/^mac\s*gregor$/i.test(normalized)) return "MacGregor";
  if (/^c\s*&?\s*c$/i.test(normalized)) return "C&C";
  if (/^(?:chris\s*craft|chriscraft|criscraft)$/i.test(normalized)) return "Chris Craft";
  if (/^carrol\s+marine$/i.test(normalized)) return "Carroll Marine";
  if (/^fountaine\s+pajot$/i.test(normalized)) return "Fountaine Pajot";
  if (/^hallberg(?:\s+|-)rassy$/i.test(normalized)) return "Hallberg-Rassy";
  if (/^robertson(?:\s*(?:&|and)\s*caine|&caine|\s+caine)$/i.test(normalized)) {
    return "Robertson and Caine";
  }
  if (/^camper(?:\s*(?:&|and)\s*nicholsons?|\s*-\s*nicholsons?)$/i.test(normalized)) {
    return "Camper & Nicholsons";
  }
  return normalized;
}

const GENERIC_IMPORTED_MAKE_TOKENS = new Set(["boat", "boats", "sailboat", "yacht", "yachts"]);
const SOURCE_NOISE_PREFIX_PATTERN =
  /^(?:yachts?|sailboat|yacht\s+corp(?:oration)?|yacht\s+company(?:\s+inc)?|yacht\s+building|yacht\s*&\s*shipbuilding(?:\s+usa)?|boat\s+works|boat\s+builders|boat\s+yard|boatyard|fiberglass)\s+/i;
const PROMOTION_STOPWORDS = new Set([
  "boat",
  "boats",
  "builders",
  "building",
  "builder",
  "company",
  "constructors",
  "corp",
  "corporation",
  "fiberglass",
  "inc",
  "marine",
  "shipbuilding",
  "usa",
  "works",
  "yard",
  "yacht",
  "yachts",
]);
const SALE_STATUS_PATTERN =
  /(?:sale\s+pending|deal\s+pending(?:\s+\d{1,2}[/-]\d{1,2}[/-]\d{2,4})*|pending|sold|new)/i;
const IMPORTED_SALE_STATUS_PATTERN = /\b(?:sold|sale\s+pending|deal\s+pending|pending)\b/i;
const IMPORTED_SALE_STATUS_SQL_PATTERN =
  "(^|[^a-z])(sold|sale[[:space:]]+pending|deal[[:space:]]+pending|pending)([^a-z]|$)";
const SALE_STATUS_DELIMITER_PATTERN = "[\\s-]+";

function promoteSpecificSourceMakeModel(input: {
  make: string;
  model: string;
  sourceSite?: string | null;
}) {
  if (normalizeSpacing(input.sourceSite).toLowerCase() !== "sailboatlistings") {
    return { make: input.make, model: input.model };
  }

  let make = input.make;
  let model = input.model;

  if (GENERIC_IMPORTED_MAKE_TOKENS.has(make.toLowerCase())) {
    const tokens = model.split(/\s+/).filter(Boolean);
    while (tokens.length > 0 && PROMOTION_STOPWORDS.has(tokens[0].toLowerCase())) {
      tokens.shift();
    }

    if (tokens.length > 0 && !/^\d{4}$/.test(tokens[0])) {
      make = tokens.shift() || make;
      model = tokens.join(" ");
    }
  }

  if (/^hank$/i.test(make) && /^hinckley\b/i.test(model)) {
    make = "Hinckley";
    model = model.replace(/^hinckley(?:\s+boat\s+builders)?\b[\s-]*/i, "").trim();
  }

  if (/^performance$/i.test(make) && /^cruising(?:\s+inc\.?\b)?/i.test(model)) {
    make = "Performance Cruising";
    model = model.replace(/^cruising(?:\s+inc\.?\b)?[\s-]*/i, "").trim();
  }

  if (/^performance\s+cruising$/i.test(make) && /^inc\.?\b/i.test(model)) {
    model = model.replace(/^inc\.?\b[\s-]*/i, "").trim();
  }

  if (/^canadian$/i.test(make) && /^sailcraft\b/i.test(model)) {
    make = "Canadian Sailcraft";
    model = model.replace(/^sailcraft\b[\s-]*/i, "").trim();
  }

  if (/^sale$/i.test(make)) {
    model = model.replace(new RegExp(`^${SALE_STATUS_PATTERN.source}${SALE_STATUS_DELIMITER_PATTERN}?`, "i"), "").trim();
    const tokens = model.split(/\s+/).filter(Boolean);
    while (tokens.length > 0 && PROMOTION_STOPWORDS.has(tokens[0].toLowerCase())) {
      tokens.shift();
    }

    if (tokens.length > 0 && !/^\d{4}$/.test(tokens[0])) {
      make = tokens.shift() || make;
      model = tokens.join(" ");
    }
  }

  return { make, model };
}

function splitEmbeddedModelFromMake(make: string, model: string) {
  if (model) return { make, model };

  const spacedMatch = make.match(/^([A-Za-z][A-Za-z/&' -]+?)\s+(\d[\w.-]*)$/);
  if (spacedMatch) {
    return {
      make: spacedMatch[1].trim(),
      model: spacedMatch[2].trim(),
    };
  }

  const embeddedMatch = make.match(/^([A-Za-z][A-Za-z/&' -]+?)(\d[\w.-]*)$/);
  if (embeddedMatch && embeddedMatch[1].length >= 2) {
    return {
      make: embeddedMatch[1].trim(),
      model: embeddedMatch[2].trim(),
    };
  }

  return { make, model };
}

// Rejoin compound builders that some source feeds split across make/model fields.
function repairCompoundBrandMakeModel(input: {
  make: string;
  model: string;
  sourceSite?: string | null;
}) {
  const sourceSite = normalizeSpacing(input.sourceSite).toLowerCase();
  if (
    sourceSite !== "theyachtmarket" &&
    sourceSite !== "sailboatlistings" &&
    sourceSite !== "apolloduck_us"
  ) {
    return { make: input.make, model: input.model };
  }

  let make = input.make;
  let model = input.model;

  const modelStartsWith = (pattern: RegExp) => pattern.test(model);

  if (/^fountaine$/i.test(make) && modelStartsWith(/^pajot\b[\s-]*/i)) {
    make = "Fountaine Pajot";
    model = model.replace(/^pajot\b[\s-]*/i, "").trim();
  }

  if (/^hallberg$/i.test(make) && modelStartsWith(/^rassy\b[\s-]*/i)) {
    make = "Hallberg-Rassy";
    model = model.replace(/^rassy\b[\s-]*/i, "").trim();
  }

  if (/^robertson$/i.test(make) && modelStartsWith(/^(?:&\s*|and\s+)?caine\b[\s-]*/i)) {
    make = "Robertson and Caine";
    model = model.replace(/^(?:&\s*|and\s+)?caine\b[\s-]*/i, "").trim();
  }

  if (/^camper$/i.test(make) && modelStartsWith(/^(?:&\s*|and\s+)?nicholsons?\b[\s-]*/i)) {
    make = "Camper & Nicholsons";
    model = model.replace(/^(?:&\s*|and\s+)?nicholsons?\b[\s-]*/i, "").trim();
  }

  if (/^island$/i.test(make) && modelStartsWith(/^packet\b[\s-]*/i)) {
    make = "Island Packet";
    model = model.replace(/^packet\b[\s-]*/i, "").trim();
  }

  if (/^cape$/i.test(make) && modelStartsWith(/^dory\b[\s-]*/i)) {
    make = "Cape Dory";
    model = model.replace(/^dory\b[\s-]*/i, "").trim();
  }

  if (/^chris$/i.test(make) && modelStartsWith(/^craft\b[\s-]*/i)) {
    make = "Chris Craft";
    model = model.replace(/^craft\b[\s-]*/i, "").trim();
  }

  if (/^cheoy$/i.test(make) && modelStartsWith(/^lee\b[\s-]*/i)) {
    make = "Cheoy Lee";
    model = model.replace(/^lee\b[\s-]*/i, "").trim();
  }

  if (/^grand$/i.test(make) && modelStartsWith(/^soleil\b[\s-]*/i)) {
    make = "Grand Soleil";
    model = model.replace(/^soleil\b[\s-]*/i, "").trim();
  }

  if (/^pacific$/i.test(make) && modelStartsWith(/^seacraft\b[\s-]*/i)) {
    make = "Pacific Seacraft";
    model = model.replace(/^seacraft\b[\s-]*/i, "").trim();
  }

  if (/^carrol(?:l)?(?:\s+marine)?$/i.test(make) && modelStartsWith(/^marine\b[\s-]*/i)) {
    make = "Carroll Marine";
    model = model.replace(/^marine\b[\s-]*/i, "").trim();
  }

  if (/^trident(?:\s+marine)?$/i.test(make) && modelStartsWith(/^marine\b[\s-]*/i)) {
    make = "Trident Marine";
    model = model.replace(/^marine\b[\s-]*/i, "").trim();
  }

  if (/^hunter$/i.test(make) && modelStartsWith(/^marine\b[\s-]*/i)) {
    make = "Hunter Marine";
    model = model.replace(/^marine\b[\s-]*/i, "").trim();
  }

  if (/^spirit$/i.test(make) && modelStartsWith(/^yachts\b[\s-]*/i)) {
    make = "Spirit Yachts";
    model = model.replace(/^yachts\b[\s-]*/i, "").trim();
  }

  if (/^leonardo$/i.test(make) && modelStartsWith(/^yachts\b[\s-]*/i)) {
    make = "Leonardo Yachts";
    model = model.replace(/^yachts\b[\s-]*/i, "").trim();
  }

  if (/^italia(?:\s+yachts)?$/i.test(make) && modelStartsWith(/^yachts\b[\s-]*/i)) {
    make = "Italia Yachts";
    model = model.replace(/^yachts\b[\s-]*/i, "").trim();
  }

  if (/^sweden(?:\s+yachts)?$/i.test(make) && modelStartsWith(/^yachts\b[\s-]*/i)) {
    make = "Sweden Yachts";
    model = model.replace(/^yachts\b[\s-]*/i, "").trim();
  }

  if (/^smart(?:\s+cat)?$/i.test(make) && modelStartsWith(/^cat\b[\s-]*/i)) {
    make = "Smart Cat";
    model = model.replace(/^cat\b[\s-]*/i, "").trim();
  }

  if (/^maine(?:\s+cat)?$/i.test(make) && modelStartsWith(/^cat\b[\s-]*/i)) {
    make = "Maine Cat";
    model = model.replace(/^cat\b[\s-]*/i, "").trim();
  }

  if (/^van$/i.test(make) && modelStartsWith(/^de\s+stadt\b[\s-]*/i)) {
    make = "Van De Stadt";
    model = model.replace(/^de\s+stadt\b[\s-]*/i, "").trim();
  }

  if (/^north$/i.test(make) && modelStartsWith(/^american\s+yachts\b[\s-]*/i)) {
    make = "North American Yachts";
    model = model.replace(/^american\s+yachts\b[\s-]*/i, "").trim();
  }

  if (
    /^graham$/i.test(make) &&
    modelStartsWith(/^collingwood\s+boatbuilders\b[\s-]*/i)
  ) {
    make = "Graham Collingwood Boatbuilders";
    model = model.replace(/^collingwood\s+boatbuilders\b[\s-]*/i, "").trim();
  }

  if (/^cornish$/i.test(make) && modelStartsWith(/^crabbers\b[\s-]*/i)) {
    make = "Cornish Crabbers";
    model = model.replace(/^crabbers\b[\s-]*/i, "").trim();
  }

  if (/^cabo$/i.test(make) && modelStartsWith(/^rico\b[\s-]*/i)) {
    make = "Cabo Rico";
    model = model.replace(/^rico\b[\s-]*/i, "").trim();
  }

  if (/^hans$/i.test(make) && modelStartsWith(/^christ(?:ian|an)\b[\s-]*/i)) {
    make = "Hans Christian";
    model = model
      .replace(/^christ(?:ian|an)\b[\s-]*/i, "")
      .replace(/^yachts?\b[\s-]*/i, "")
      .trim();
  }

  if (/^bruce$/i.test(make) && modelStartsWith(/^roberts?\b[\s-]*/i)) {
    make = "Bruce Roberts";
    model = model.replace(/^roberts?\b[\s-]*/i, "").trim();
  }

  return {
    make: canonicalizeMakeName(make),
    model,
  };
}

function normalizeRomanSuffixes(value: string) {
  return value
    .replace(/\bMk Ii\b/gi, "Mk II")
    .replace(/\bMk Iii\b/gi, "Mk III")
    .replace(/\bMk Iv\b/gi, "Mk IV");
}

function dedupeAdjacentModelTokens(value: string) {
  const tokens = value.split(/\s+/).filter(Boolean);
  const deduped: string[] = [];
  for (const token of tokens) {
    if (deduped[deduped.length - 1]?.toLowerCase() === token.toLowerCase()) {
      continue;
    }
    deduped.push(token);
  }
  return deduped.join(" ");
}

function stripLeadingSlugYearFromModel(model: string, slug?: string | null) {
  const slugYear = String(slug || "").match(/^(\d{4})-/)?.[1];
  if (!slugYear) return model;
  return model.replace(new RegExp(`^${slugYear}\\s+(?=\\S)`), "").trim();
}

function stripRepeatedMakeFromModel(make: string, model: string) {
  const makeTokens = make.toLowerCase().split(/\s+/).filter(Boolean);
  const modelTokens = model.split(/\s+/).filter(Boolean);
  while (
    makeTokens.length > 0 &&
    modelTokens.length >= makeTokens.length &&
    makeTokens.every((token, index) => modelTokens[index]?.toLowerCase() === token)
  ) {
    modelTokens.splice(0, makeTokens.length);
  }
  return modelTokens.join(" ");
}

function stripSourceSpecificNoise(sourceSite: string | null | undefined, make: string, model: string) {
  let cleaned = model;

  if (sourceSite === "sailboatlistings") {
    for (let pass = 0; pass < 4; pass += 1) {
      const next = cleaned
        .replace(SOURCE_NOISE_PREFIX_PATTERN, "")
        .replace(/^\d{4}\s+/i, "")
        .trim();
      if (next === cleaned) break;
      cleaned = next;
    }
    cleaned = cleaned.replace(
      /^(Robertson And Caine|Robertson And Cane|Robertson Caine)\s+/i,
      ""
    );
    cleaned = cleaned.replace(
      /^(?:fractional\s+ownership\s+)?(?:sailboat\s+partnership\s+)+/i,
      ""
    );
    cleaned = cleaned.replace(/\s+fractional\s+ownership$/i, "");
    if (/^Leopard$/i.test(make)) {
      cleaned = cleaned.replace(/^South Africa\s+/i, "");
    }
    if (/^hinckley$/i.test(make)) {
      cleaned = cleaned.replace(/^boat builders\s+/i, "");
    }

    for (let pass = 0; pass < 4; pass += 1) {
      const next = cleaned
        .replace(
          new RegExp(`^${SALE_STATUS_PATTERN.source}(?:${SALE_STATUS_DELIMITER_PATTERN}|$)`, "i"),
          ""
        )
        .replace(
          new RegExp(`(?:^|${SALE_STATUS_DELIMITER_PATTERN})${SALE_STATUS_PATTERN.source}$`, "i"),
          ""
        )
        .trim();
      if (next === cleaned) break;
      cleaned = next;
    }

    for (let pass = 0; pass < 2; pass += 1) {
      const next = cleaned
        .replace(new RegExp(`^sale(?:${SALE_STATUS_DELIMITER_PATTERN}|$)`, "i"), "")
        .replace(new RegExp(`(?:^|${SALE_STATUS_DELIMITER_PATTERN})sale$`, "i"), "")
        .trim();
      if (next === cleaned) break;
      cleaned = next;
    }
  }

  if (/^hunter marine$/i.test(make)) {
    cleaned = cleaned.replace(/^hunter\b[\s-]*/i, "");
  }

  if (/^cornish crabbers$/i.test(make)) {
    cleaned = cleaned.replace(/^crabbers\b[\s-]*/i, "");
  }

  if (/^cabo rico$/i.test(make)) {
    cleaned = cleaned.replace(/^rico\b[\s-]*/i, "");
  }

  if (/^chris craft$/i.test(make)) {
    cleaned = cleaned.replace(/^craft\b[\s-]*/i, "");
  }

  if (/^carroll marine$/i.test(make)) {
    cleaned = cleaned.replace(/^marine\b[\s-]*/i, "");
  }

  if (/^spirit yachts$/i.test(make)) {
    cleaned = cleaned.replace(/^spirit\b[\s-]*/i, "");
  }

  if (/^italia yachts$/i.test(make)) {
    cleaned = cleaned.replace(/^italia\b[\s-]*/i, "");
  }

  if (/^hans christian$/i.test(make)) {
    cleaned = cleaned.replace(/^christ(?:ian|an)\b[\s-]*/i, "");
  }

  if (/^bruce roberts$/i.test(make)) {
    cleaned = cleaned.replace(/^roberts?\b[\s-]*/i, "");
  }

  return cleaned.trim();
}

function canonicalizeKnownModelCodes(make: string, model: string) {
  let cleaned = model;

  if (/^bali$/i.test(make)) {
    cleaned = cleaned.replace(/^(\d)\s+(\d)(?=$|\s)/, "$1.$2");
  }

  if (/^saffier$/i.test(make)) {
    cleaned = cleaned.replace(/^(S[CEL])\b(?=\s+\d)/i, (prefix) => prefix.toUpperCase());
  }

  return cleaned;
}

const METERS_TO_FEET = 3.28084;

function toFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function roundDimension(value: number | null) {
  if (value === null) return null;
  return Math.round(value * 10) / 10;
}

function isLikelyMultihull(make: string, model: string, rigType?: string | null) {
  if (/^(bali|lagoon|leopard|catana|nautitech|outremer|seawind)$/i.test(make)) {
    return true;
  }
  const haystack = `${make} ${model} ${rigType || ""}`.toLowerCase();
  return /\b(cat|catamaran|trimaran|multihull)\b/.test(haystack);
}

function normalizeStoredVesselType(value: unknown) {
  const normalized = normalizeSpacing(typeof value === "string" ? value : null).toLowerCase();
  if (!normalized) return null;

  if (/\btrimaran\b/.test(normalized)) return "trimaran";
  if (/\bpower\s*cat\b|\bpowercat\b/.test(normalized)) return "powerboat";
  if (/\bpowerboat\b|\bmotor yacht\b|\bmotoryacht\b|\btrawler\b/.test(normalized)) {
    return "powerboat";
  }
  if (/\bcatamaran\b|\bcat boat\b|\bcatboat\b|\bmultihull\b/.test(normalized)) {
    return "catamaran";
  }
  if (/\bmonohull\b|\bsailboat\b|\bsloop\b|\bcutter\b|\bketch\b|\byawl\b/.test(normalized)) {
    return "monohull";
  }

  return null;
}

export function inferImportedVesselType(input: {
  make?: string | null;
  model?: string | null;
  rigType?: string | null;
  existingType?: unknown;
}) {
  const stored = normalizeStoredVesselType(input.existingType);
  if (stored) return stored;

  const make = normalizeSpacing(input.make);
  const model = normalizeSpacing(input.model);
  const rigType = normalizeSpacing(input.rigType);
  const haystack = `${make} ${model} ${rigType}`.toLowerCase();

  if (/\btrimaran\b/.test(haystack)) return "trimaran";
  if (/\bpower\s*cat\b|\bpowercat\b/.test(haystack)) return "powerboat";
  if (/\bpowerboat\b|\bmotor yacht\b|\bmotoryacht\b|\btrawler\b/.test(haystack)) {
    return "powerboat";
  }
  if (/\bcatamaran\b|\bcat boat\b|\bcatboat\b/.test(haystack)) return "catamaran";
  if (isLikelyMultihull(make, model, rigType)) return "catamaran";

  return "monohull";
}

function getExpectedLoaFromModel(make: string, model: string, sourceSite?: string | null) {
  const match = model.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;

  if (/^bali$/i.test(make)) {
    let expectedLoa = Number.parseFloat(match[1]);
    if (expectedLoa < 10 && /^\d\.\d$/.test(match[1])) {
      expectedLoa *= 10;
    }
    return Number.isFinite(expectedLoa) ? expectedLoa : null;
  }

  if (normalizeSpacing(sourceSite).toLowerCase() !== "sailboatlistings") {
    return null;
  }

  const digits = match[1].replace(/\./g, "");
  let expectedLoa: number | null = null;

  if (/^\d{2}$/.test(match[1])) {
    expectedLoa = Number.parseInt(match[1], 10);
  } else if (/^\d{3}$/.test(digits)) {
    expectedLoa = Number.parseInt(digits.slice(0, 2), 10) + Number.parseInt(digits.slice(2), 10) / 10;
  } else if (/^\d{4}$/.test(digits)) {
    expectedLoa = Number.parseInt(digits.slice(0, 2), 10) + Number.parseInt(digits.slice(2), 10) / 100;
  } else if (/^\d{2}\.\d$/.test(match[1])) {
    expectedLoa = Number.parseFloat(match[1]);
  }

  if (expectedLoa === null || !Number.isFinite(expectedLoa)) return null;
  return expectedLoa >= 20 && expectedLoa <= 90 ? expectedLoa : null;
}

function repairLoaFromExpected(rawLoa: number | null, expectedLoa: number | null) {
  if (rawLoa === null || expectedLoa === null) return rawLoa;

  const converted = rawLoa / METERS_TO_FEET;
  if (rawLoa > expectedLoa * 1.6 && Math.abs(converted - expectedLoa) <= 2.5) {
    return roundDimension(converted);
  }

  return rawLoa;
}

function getPlausibleBeamLimit(candidateLoa: number, isMultihull: boolean) {
  return isMultihull
    ? Math.max(16, candidateLoa * 0.72)
    : Math.max(10, candidateLoa * 0.45);
}

function getPlausibleDraftLimit(candidateLoa: number, isMultihull: boolean) {
  return isMultihull
    ? Math.max(6, candidateLoa * 0.14)
    : Math.max(6, candidateLoa * 0.2);
}

function parseCompactFeetInches(rawValue: number) {
  const digits = String(Math.trunc(rawValue));
  if (!/^\d{2,4}$/.test(digits)) return [];

  const candidates: number[] = [];
  if (digits.length === 4) {
    const inches = Number.parseInt(digits.slice(2), 10);
    if (inches <= 11) {
      candidates.push(Number.parseInt(digits.slice(0, 2), 10) + inches / 12);
    }
  } else if (digits.length === 2) {
    const inches = Number.parseInt(digits.slice(1), 10);
    if (inches <= 11) {
      candidates.push(Number.parseInt(digits.slice(0, 1), 10) + inches / 12);
    }
  } else if (digits.length === 3) {
    const optionAFeet = Number.parseInt(digits.slice(0, 2), 10);
    const optionAInches = Number.parseInt(digits.slice(2), 10);
    if (optionAInches <= 11) {
      candidates.push(optionAFeet + optionAInches / 12);
    }

    const optionBFeet = Number.parseInt(digits.slice(0, 1), 10);
    const optionBInches = Number.parseInt(digits.slice(1), 10);
    if (optionBInches <= 11) {
      candidates.push(optionBFeet + optionBInches / 12);
    }
  }

  return Array.from(new Set(candidates.filter((candidate) => Number.isFinite(candidate) && candidate > 0)));
}

function parseCollapsedDecimalCandidates(rawValue: number) {
  const digits = String(Math.trunc(rawValue));
  if (!/^\d{2,4}$/.test(digits)) return [];

  const candidates: number[] = [];
  if (digits.length === 4) {
    candidates.push(Number.parseInt(digits.slice(0, 2), 10) + Number.parseInt(digits.slice(2), 10) / 100);
  } else if (digits.length === 2) {
    candidates.push(Number.parseInt(digits.slice(0, 1), 10) + Number.parseInt(digits.slice(1), 10) / 10);
  } else if (digits.length === 3) {
    candidates.push(Number.parseInt(digits.slice(0, 2), 10) + Number.parseInt(digits.slice(2), 10) / 10);
    candidates.push(Number.parseInt(digits.slice(0, 1), 10) + Number.parseInt(digits.slice(1), 10) / 100);
  }

  return Array.from(new Set(candidates.filter((candidate) => Number.isFinite(candidate) && candidate > 0)));
}

function repairCollapsedDimension(
  rawValue: number | null,
  maxPlausibleValue: number,
  minPlausibleValue: number
) {
  if (rawValue === null) return null;
  const candidates = [...parseCompactFeetInches(rawValue), ...parseCollapsedDecimalCandidates(rawValue)]
    .filter((candidate) => candidate >= minPlausibleValue && candidate <= maxPlausibleValue)
    .sort((left, right) => right - left);
  return candidates.length > 0 ? roundDimension(candidates[0]) : null;
}

function repairBeamFromLoa(
  rawBeam: number | null,
  candidateLoa: number | null,
  sourceSite: string | null,
  isMultihull: boolean
) {
  if (rawBeam === null || candidateLoa === null) return rawBeam;

  const maxPlausibleBeam = getPlausibleBeamLimit(candidateLoa, isMultihull);
  if (rawBeam <= maxPlausibleBeam) return rawBeam;

  if (normalizeSpacing(sourceSite).toLowerCase() === "sailboatlistings") {
    return repairCollapsedDimension(rawBeam, maxPlausibleBeam, Math.max(4, candidateLoa * 0.12));
  }

  const converted = rawBeam / METERS_TO_FEET;
  if (converted <= maxPlausibleBeam) {
    return roundDimension(converted);
  }

  return null;
}

function repairDraftFromLoa(
  rawDraft: number | null,
  candidateLoa: number | null,
  sourceSite: string | null,
  isMultihull: boolean
) {
  if (rawDraft === null || candidateLoa === null) return rawDraft;

  const maxPlausibleDraft = getPlausibleDraftLimit(candidateLoa, isMultihull);
  if (rawDraft <= maxPlausibleDraft) return rawDraft;

  if (normalizeSpacing(sourceSite).toLowerCase() === "sailboatlistings") {
    const compact = repairCollapsedDimension(rawDraft, maxPlausibleDraft, Math.max(2, candidateLoa * 0.03));
    return compact;
  }

  const converted = rawDraft / METERS_TO_FEET;
  if (converted <= maxPlausibleDraft) {
    return roundDimension(converted);
  }

  return null;
}

export function sanitizeImportedDimensions(input: {
  make?: string | null;
  model?: string | null;
  sourceSite?: string | null;
  rigType?: string | null;
  loa?: number | null;
  beam?: number | null;
  draft?: number | null;
}) {
  const make = normalizeSpacing(input.make);
  const model = normalizeSpacing(input.model);
  const expectedLoa = getExpectedLoaFromModel(make, model, input.sourceSite);
  const multihull = isLikelyMultihull(make, model, input.rigType);

  const loa = repairLoaFromExpected(toFiniteNumber(input.loa), expectedLoa);
  const beam = repairBeamFromLoa(
    toFiniteNumber(input.beam),
    loa ?? expectedLoa,
    input.sourceSite ?? null,
    multihull
  );
  const draft = repairDraftFromLoa(
    toFiniteNumber(input.draft),
    loa ?? expectedLoa,
    input.sourceSite ?? null,
    multihull
  );

  return {
    loa: roundDimension(loa),
    beam: roundDimension(beam),
    draft: roundDimension(draft),
  };
}

export function sanitizeImportedSpecs(
  specs: Record<string, unknown> | null | undefined,
  context: {
    make?: string | null;
    model?: string | null;
    sourceSite?: string | null;
  }
) {
  const normalizedSpecs = { ...(specs || {}) };
  const { loa, beam, draft } = sanitizeImportedDimensions({
    make: context.make,
    model: context.model,
    sourceSite: context.sourceSite,
    rigType: typeof normalizedSpecs.rig_type === "string" ? normalizedSpecs.rig_type : null,
    loa: toFiniteNumber(normalizedSpecs.loa),
    beam: toFiniteNumber(normalizedSpecs.beam),
    draft: toFiniteNumber(normalizedSpecs.draft),
  });

  if (loa === null) delete normalizedSpecs.loa;
  else normalizedSpecs.loa = loa;

  if (beam === null) delete normalizedSpecs.beam;
  else normalizedSpecs.beam = beam;

  if (draft === null) delete normalizedSpecs.draft;
  else normalizedSpecs.draft = draft;

  normalizedSpecs.vessel_type = inferImportedVesselType({
    make: context.make,
    model: context.model,
    rigType: typeof normalizedSpecs.rig_type === "string" ? normalizedSpecs.rig_type : null,
    existingType: normalizedSpecs.vessel_type,
  });

  return normalizedSpecs;
}

import { getSafeExternalUrl } from "@/lib/url-safety";

type SanitizableBoatRecord = {
  year?: number | null;
  make: string;
  model: string;
  slug?: string | null;
  source_site?: string | null;
  source_url?: string | null;
  location_text?: string | null;
  hero_url?: string | null;
  specs?: Record<string, unknown> | null;
};

export function sanitizeImportedBoatRecord<T extends SanitizableBoatRecord>(boat: T): T {
  const normalizedMakeModel = normalizeImportedMakeModel({
    year: boat.year,
    make: boat.make,
    model: boat.model,
    slug: boat.slug,
    sourceSite: boat.source_site,
  });
  const normalizedMake = normalizedMakeModel.make || boat.make;
  const normalizedModel = normalizedMakeModel.model;
  const normalizedLocation = normalizeImportedLocation(boat.location_text);
  const normalizedSpecs = sanitizeImportedSpecs(boat.specs, {
    make: normalizedMake,
    model: normalizedModel,
    sourceSite: boat.source_site,
  });

  return {
    ...boat,
    make: normalizedMake,
    model: normalizedModel,
    source_url:
      "source_url" in boat ? getSafeExternalUrl(boat.source_url) : boat.source_url,
    location_text: normalizedLocation || boat.location_text || null,
    hero_url: "hero_url" in boat ? getSafeExternalUrl(boat.hero_url) : boat.hero_url,
    specs: normalizedSpecs,
  } as T;
}

export function buildImportedSlug(
  year: number,
  make: string,
  model: string,
  locationText?: string | null
) {
  return [year, make, model, String(locationText || "").split(",")[0]]
    .map((part) =>
      String(part)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
    )
    .filter(Boolean)
    .join("-");
}

export function buildImportedSlugFallback(slug: string, id: string) {
  const suffix = String(id || "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .slice(0, 6)
    .toLowerCase();

  return suffix ? `${slug}-${suffix}` : slug;
}

function inferModelFromSlug(slug?: string | null, make?: string | null) {
  const tokens = String(slug || "")
    .split("-")
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length < 3 || !make) return "";

  const working = [...tokens];
  if (/^\d{4}$/.test(working[0])) {
    working.shift();
  }

  const makeTokens = normalizeSpacing(make)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  while (makeTokens.length > 0 && working.length > 0 && makeTokens[0] === working[0].toLowerCase()) {
    makeTokens.shift();
    working.shift();
  }

  while (working.length > 0) {
    const last = working[working.length - 1].toLowerCase();
    if (LOCATION_STOP_WORDS.has(last) || LOCATION_STATE_CODES.has(last)) {
      working.pop();
      continue;
    }
    break;
  }

  if (working.length === 0) return "";
  const inferred = working.join(" ");
  if (GENERIC_MODEL_TOKENS.has(inferred.toLowerCase())) return "";

  return inferred;
}

export function normalizeImportedMakeModel(input: {
  year?: number | null;
  make?: string | null;
  model?: string | null;
  slug?: string | null;
  sourceSite?: string | null;
}) {
  let make = normalizeSpacing(input.make);
  let model = normalizeSpacing(input.model);

  if (!model) {
    model = inferModelFromSlug(input.slug, make);
  }

  ({ make, model } = promoteSpecificSourceMakeModel({
    make,
    model,
    sourceSite: input.sourceSite,
  }));

  ({ make, model } = splitEmbeddedModelFromMake(make, model));

  make = make
    .split(/\s+/)
    .map(titleCaseToken)
    .filter(Boolean)
    .join(" ");
  make = canonicalizeMakeName(make);
  model = model
    .split(/\s+/)
    .map(titleCaseToken)
    .filter(Boolean)
    .join(" ");
  ({ make, model } = repairCompoundBrandMakeModel({
    make,
    model,
    sourceSite: input.sourceSite,
  }));
  model = stripSourceSpecificNoise(input.sourceSite, make, model);
  model = canonicalizeKnownModelCodes(make, model);
  model = stripLeadingSlugYearFromModel(model, input.slug);
  model = stripRepeatedMakeFromModel(make, model);
  model = dedupeAdjacentModelTokens(model);
  model = normalizeRomanSuffixes(model);

  if (
    normalizeSpacing(input.sourceSite).toLowerCase() === "sailboatlistings" &&
    input.year &&
    model === String(input.year)
  ) {
    model = "";
  }

  if (GENERIC_MODEL_TOKENS.has(model.toLowerCase())) {
    model = "";
  }

  return { make, model };
}

export function buildImportedCharacterTags(input: {
  priceUsd: number | null;
  loa: number | null;
  rigType?: string | null;
  vesselType?: string | null;
  existingTags?: string[] | null;
}) {
  const tags = new Set((input.existingTags || []).filter(Boolean));
  const rig = String(input.rigType || "").toLowerCase();
  const vesselType = String(input.vesselType || "").toLowerCase();

  if (input.priceUsd !== null && input.priceUsd < 50000) tags.add("budget-friendly");
  if (input.priceUsd !== null && input.priceUsd >= 250000) tags.add("premium");
  if (input.loa !== null && input.loa >= 40) tags.add("bluewater");
  if (input.loa !== null && input.loa <= 32) tags.add("weekender");
  if (rig.includes("cutter")) tags.add("bluewater");
  if (rig.includes("ketch")) tags.add("classic");
  if (rig.includes("cat") || vesselType === "catamaran") tags.add("catamaran");
  if (vesselType === "trimaran") tags.add("trimaran");
  if (vesselType === "powerboat") tags.add("powerboat");

  return Array.from(tags).slice(0, 8);
}

export function buildImportedSummary(input: {
  year: number;
  make: string;
  model: string;
  locationText?: string | null;
  price: number;
  currency: string;
  loa?: number | null;
  rigType?: string | null;
  hullMaterial?: string | null;
  berths?: number | null;
  heads?: number | null;
  sourceName?: string | null;
}) {
  const title = `${input.year} ${input.make}${input.model ? ` ${input.model}` : ""}`.trim();
  const facts: string[] = [];

  if (input.loa) facts.push(`${input.loa}ft LOA`);
  if (input.rigType) facts.push(`${String(input.rigType).toLowerCase()} rig`);
  if (input.hullMaterial) facts.push(`${String(input.hullMaterial).toLowerCase()} hull`);
  if (input.berths) facts.push(`${input.berths} berth${input.berths === 1 ? "" : "s"}`);
  if (input.heads) facts.push(`${input.heads} head${input.heads === 1 ? "" : "s"}`);

  const base = `${title} listed${input.locationText ? ` in ${input.locationText}` : ""}.`;
  const specSentence = facts.length > 0 ? ` Key specs include ${facts.join(", ")}.` : "";
  const priceSentence = ` Asking ${input.currency} ${Math.round(input.price).toLocaleString("en-US")}.`;
  const sourceSentence = input.sourceName ? ` Imported from ${input.sourceName}.` : "";

  return `${base}${specSentence}${priceSentence}${sourceSentence}`.replace(/\s+/g, " ").trim();
}

function buildImportedSaleStatusHaystack(input: {
  make?: string | null;
  model?: string | null;
  slug?: string | null;
}) {
  const slugText = normalizeSpacing(String(input.slug || "").replace(/[-_]+/g, " "));
  return normalizeSpacing([input.make, input.model, slugText].filter(Boolean).join(" "));
}

export function buildImportedSaleStatusSql(alias = "b") {
  const haystackSql = `LOWER(CONCAT_WS(' ',
    COALESCE(${alias}.make, ''),
    COALESCE(${alias}.model, ''),
    REGEXP_REPLACE(COALESCE(${alias}.slug, ''), '[-_]+', ' ', 'g')
  ))`;

  return `${haystackSql} ~ '${IMPORTED_SALE_STATUS_SQL_PATTERN}'`;
}

export function hasImportedSaleStatusMarker(input: {
  make?: string | null;
  model?: string | null;
  slug?: string | null;
}) {
  return IMPORTED_SALE_STATUS_PATTERN.test(buildImportedSaleStatusHaystack(input));
}

export function buildImportQualityFlags(input: {
  make?: string | null;
  model?: string | null;
  slug?: string | null;
  locationText?: string | null;
  imageCount: number;
  priceUsd: number | null;
  summary?: string | null;
}) {
  const flags: string[] = [];

  if (hasImportedSaleStatusMarker(input)) flags.push("sale_status");
  if (!normalizeSpacing(input.model)) flags.push("missing_model");
  if (!hasUsableImportedLocation(input.locationText)) flags.push("missing_location");
  if (input.imageCount < MIN_VISIBLE_IMPORTED_IMAGES) flags.push("missing_image");
  if (input.priceUsd !== null && input.priceUsd < MIN_VISIBLE_IMPORTED_PRICE_USD) {
    flags.push("low_price");
  }
  if (!input.summary || input.summary.trim().length < MIN_GOOD_SUMMARY_LENGTH) {
    flags.push("thin_summary");
  }

  return flags;
}

export function mergeStickyImportQualityFlags(input: {
  currentFlags: string[];
  existingFlags?: unknown;
}) {
  const merged = new Set(input.currentFlags);
  const existingFlags = Array.isArray(input.existingFlags) ? input.existingFlags : [];

  if (existingFlags.includes("sale_status")) {
    merged.add("sale_status");
  }

  return Array.from(merged);
}

export function calculateImportQualityScore(flags: string[]) {
  let score = 100;
  for (const flag of flags) {
    if (flag === "sale_status") score -= 100;
    else if (flag === "missing_model") score -= 35;
    else if (flag === "missing_location") score -= 30;
    else if (flag === "missing_image") score -= 35;
    else if (flag === "thin_summary") score -= 10;
    else if (flag === "low_price") score -= 10;
  }

  return Math.max(0, score);
}

export function buildImportDocumentationStatus(input: {
  flags: string[];
  score: number;
  summarySource: "source" | "deterministic" | "llm";
  sourceName?: string | null;
  imageCount: number;
  priceUsd: number | null;
}): Record<string, unknown> {
  return {
    import_quality_flags: input.flags,
    import_quality_score: input.score,
    import_quality_visible: input.flags.length === 0,
    summary_source: input.summarySource,
    image_count: input.imageCount,
    price_usd: input.priceUsd,
    source_name: input.sourceName || null,
    reviewed_at: new Date().toISOString(),
  };
}

export function buildVisibleImportQualitySql(alias = "b") {
  const normalizedLocationSql = `LOWER(COALESCE(NULLIF(REGEXP_REPLACE(TRIM(${alias}.location_text), '[,\\s]+$', '', 'g'), ''), ''))`;
  const nonQuestionLocationSql = `REPLACE(REPLACE(REPLACE(${normalizedLocationSql}, '?', ''), ' ', ''), ',', '')`;

  return `(
  ${alias}.source_url IS NULL
  OR (
    COALESCE(NULLIF(TRIM(${alias}.make), ''), '') <> ''
    AND COALESCE(NULLIF(TRIM(${alias}.model), ''), '') <> ''
    AND ${normalizedLocationSql} <> ''
    AND ${nonQuestionLocationSql} <> ''
    AND ${normalizedLocationSql} NOT IN (${GENERIC_LOCATION_SQL_VALUES})
    AND NOT (${buildImportedSaleStatusSql(alias)})
    AND COALESCE(${alias}.asking_price_usd, ${alias}.asking_price) >= ${MIN_VISIBLE_IMPORTED_PRICE_USD}
    AND EXISTS (
      SELECT 1
      FROM boat_media bm
      WHERE bm.boat_id = ${alias}.id
        AND bm.type = 'image'
    )
    AND COALESCE((
      SELECT CASE
        WHEN jsonb_typeof(d.documentation_status -> 'import_quality_visible') = 'boolean'
          THEN (d.documentation_status ->> 'import_quality_visible')::boolean
        ELSE true
      END
      FROM boat_dna d
      WHERE d.boat_id = ${alias}.id
    ), true)
  )
 )`;
}

export const VISIBLE_IMPORT_QUALITY_SQL = buildVisibleImportQualitySql();
