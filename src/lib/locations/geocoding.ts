import { hasConfiguredValue } from "@/lib/capabilities";

export type GeocodingProvider = "disabled" | "nominatim" | "opencage";
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
  "south",
  "south coast",
  "unknown",
  "west coast",
  "worldwide",
]);

const COUNTRY_CODES: Record<string, string> = {
  "antigua and barbuda": "ag",
  aruba: "aw",
  australia: "au",
  bahamas: "bs",
  belize: "bz",
  bermuda: "bm",
  canada: "ca",
  croatia: "hr",
  cyprus: "cy",
  denmark: "dk",
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
const ADMIN_REGION_ADDRESS_TYPES = new Set(["state", "region", "province", "county", "island"]);
const MARINE_PLACE_TYPES = new Set(["marina", "harbour", "harbor", "dock", "mooring", "ferry_terminal"]);
const STREET_PLACE_TYPES = new Set(["house", "building", "amenity", "road", "street", "residential"]);
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

export function buildGeocodeQuery(input: GeocodeCandidateInput): GeocodeQuery | null {
  const locationText = String(input.locationText || "").trim();
  const normalizedLocation = normalizeLookupValue(locationText);
  if (!locationText || normalizedLocation.length < 3 || GENERIC_LOCATION_TEXT.has(normalizedLocation)) {
    return null;
  }

  const country = String(input.country || "").trim();
  const normalizedCountry = normalizeLookupValue(country);
  if (COUNTRY_CODES[normalizedLocation] || (normalizedCountry && normalizedCountry === normalizedLocation)) {
    return null;
  }

  const confidence = String(input.confidence || "").toLowerCase();
  const looksSpecific =
    confidence === "city" ||
    confidence === "exact" ||
    locationText.includes(",");
  if (!looksSpecific) return null;

  const locationIncludesCountry =
    country && normalizeLookupValue(locationText).includes(normalizeLookupValue(country));
  const parts = uniqueParts([
    locationText,
    locationIncludesCountry ? null : country,
  ]);
  const queryText = parts.join(", ");
  const queryKey = normalizeLookupValue(queryText);

  return {
    queryText,
    queryKey,
    countryHint: getCountryCode(country),
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

  if (MARINE_PLACE_TYPES.has(type)) return "marina";
  if (STREET_PLACE_TYPES.has(addresstype) || placeRank >= 28) return "street";
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

function scoreNominatimResult(result: Record<string, unknown>, precision: GeocodePrecision) {
  const importance = Number(result.importance);
  return scorePrecision(importance, precision);
}

function inferOpenCagePrecision(components: Record<string, unknown>, confidence: number): GeocodePrecision {
  const type = normalizeLookupValue(String(components._type || ""));
  const category = normalizeLookupValue(String(components._category || ""));

  if (MARINE_PLACE_TYPES.has(type) || MARINE_PLACE_TYPES.has(category)) return "marina";
  if (STREET_PLACE_TYPES.has(type) || STREET_PLACE_TYPES.has(category)) return "street";
  if (CITY_PLACE_TYPES.has(type)) return "city";
  if (OPENCAGE_REGION_TYPES.has(type)) return "region";
  if (type === "country") return "country";
  if (confidence >= 7) return "city";
  if (confidence >= 4) return "region";

  return "unknown";
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

    const precision = inferNominatimPrecision(result);
    const score = scoreNominatimResult(result, precision);
    const needsReview = precision === "country" || precision === "unknown" || score < 0.35;

    return {
      status: needsReview ? "review" : "geocoded",
      latitude,
      longitude,
      precision,
      score,
      placeName: String(result.display_name || "") || null,
      provider: "nominatim",
      payload: result,
      error: needsReview ? "low_precision" : null,
    };
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
    const precision = inferOpenCagePrecision(components, normalizedConfidence);
    const score = scorePrecision(normalizedConfidence / 10, precision);
    const precisionConfidenceFloor = OPENCAGE_MIN_CONFIDENCE_BY_PRECISION[precision];
    const lowConfidence =
      normalizedConfidence <= 3 ||
      (typeof precisionConfidenceFloor === "number" && normalizedConfidence < precisionConfidenceFloor);
    const lowPrecision = precision === "country" || precision === "unknown";

    return {
      status: lowConfidence || lowPrecision ? "review" : "geocoded",
      latitude,
      longitude,
      precision,
      score,
      placeName: String(result.formatted || "") || null,
      provider: "opencage",
      payload: result,
      error: lowPrecision ? "low_precision" : lowConfidence ? "low_confidence" : null,
    };
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
