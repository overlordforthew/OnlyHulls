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
};

const COMMON_LOCATION_SUFFIXES = [
  "Puerto Rico",
  "Bahamas",
  "Florida",
  "California",
  "Texas",
  "North Carolina",
  "South Carolina",
  "New York",
  "British Virgin Islands",
  "Virgin Islands",
  "United States",
  "Canada",
  "Mexico",
  "Spain",
  "France",
  "Italy",
  "Greece",
  "Croatia",
  "Turkey",
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
    .replace(/\p{Regional_Indicator}+/gu, " ")
    .replace(/^[./?-]+|[./?-]+$/g, "")
    .trim();
  if (!normalized) return "";

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
  if (sourceSite !== "theyachtmarket" && sourceSite !== "sailboatlistings") {
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
    cleaned = cleaned.replace(
      /^(Robertson And Caine|Robertson And Cane|Robertson Caine)\s+/i,
      ""
    );
    if (/^Leopard$/i.test(make)) {
      cleaned = cleaned.replace(/^South Africa\s+/i, "");
    }
  }

  return cleaned.trim();
}

function canonicalizeKnownModelCodes(make: string, model: string) {
  let cleaned = model;

  if (/^saffier$/i.test(make)) {
    cleaned = cleaned.replace(/^(S[CEL])\b(?=\s+\d)/i, (prefix) => prefix.toUpperCase());
  }

  return cleaned;
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

  if (GENERIC_MODEL_TOKENS.has(model.toLowerCase())) {
    model = "";
  }

  return { make, model };
}

export function buildImportedCharacterTags(input: {
  priceUsd: number | null;
  loa: number | null;
  rigType?: string | null;
  existingTags?: string[] | null;
}) {
  const tags = new Set((input.existingTags || []).filter(Boolean));
  const rig = String(input.rigType || "").toLowerCase();

  if (input.priceUsd !== null && input.priceUsd < 50000) tags.add("budget-friendly");
  if (input.priceUsd !== null && input.priceUsd >= 250000) tags.add("premium");
  if (input.loa !== null && input.loa >= 40) tags.add("bluewater");
  if (input.loa !== null && input.loa <= 32) tags.add("weekender");
  if (rig.includes("cutter")) tags.add("bluewater");
  if (rig.includes("ketch")) tags.add("classic");
  if (rig.includes("cat")) tags.add("catamaran");

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

export function buildImportQualityFlags(input: {
  model?: string | null;
  locationText?: string | null;
  imageCount: number;
  priceUsd: number | null;
  summary?: string | null;
}) {
  const flags: string[] = [];

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

export function calculateImportQualityScore(flags: string[]) {
  let score = 100;
  for (const flag of flags) {
    if (flag === "missing_model") score -= 35;
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
