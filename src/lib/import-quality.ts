export const MIN_VISIBLE_IMPORTED_PRICE_USD = 3000;
export const MIN_VISIBLE_IMPORTED_IMAGES = 1;
export const MIN_GOOD_SUMMARY_LENGTH = 40;
const GENERIC_LOCATION_VALUES = new Set([
  "outside united states",
  "outside usa",
  "outside the united states",
]);

const TITLE_CASE_EXACT: Record<string, string> = {
  "o'day": "O'Day",
  oday: "O'Day",
  "o-day": "O'Day",
  macgregor: "MacGregor",
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

function titleCaseToken(token: string) {
  const clean = stripMojibake(token);
  if (!clean) return "";

  const exact = TITLE_CASE_EXACT[clean.toLowerCase()];
  if (exact) return exact;
  if (ALL_CAPS_KEEP.has(clean.toUpperCase())) return clean.toUpperCase();
  if (/^[a-z]\d+$/i.test(clean)) return clean.toUpperCase();
  if (/^\d+(\.\d+)?$/.test(clean)) return clean;

  return clean
    .split(/([/-])/)
    .map((part) => {
      if (!part || part === "/" || part === "-") return part;
      const lowered = part.toLowerCase();
      const special = TITLE_CASE_EXACT[lowered];
      if (special) return special;

      return lowered.replace(/\b\w/g, (char) => char.toUpperCase());
    })
    .join("");
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

export function hasUsableImportedLocation(value?: string | null) {
  const normalized = normalizeSpacing(value).toLowerCase();
  return Boolean(normalized) && !GENERIC_LOCATION_VALUES.has(normalized);
}

function canonicalizeMakeName(make: string) {
  const normalized = normalizeSpacing(make);
  if (/^o\s+day$/i.test(normalized)) return "O'Day";
  if (/^mac\s*gregor$/i.test(normalized)) return "MacGregor";
  if (/^c\s*&?\s*c$/i.test(normalized)) return "C&C";
  return normalized;
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
  model = stripSourceSpecificNoise(input.sourceSite, make, model);
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
  return `(
  ${alias}.source_url IS NULL
  OR (
    COALESCE(NULLIF(TRIM(${alias}.make), ''), '') <> ''
    AND COALESCE(NULLIF(TRIM(${alias}.model), ''), '') <> ''
    AND COALESCE(NULLIF(TRIM(${alias}.location_text), ''), '') <> ''
    AND LOWER(TRIM(${alias}.location_text)) NOT IN ('outside united states', 'outside usa', 'outside the united states')
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
