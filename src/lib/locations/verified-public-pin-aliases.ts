// New aliases must have provider-reviewed facility evidence plus a country/coordinate anchor.
// This keeps same-name marinas in other markets from promoting broad cached geocodes.
export const VERIFIED_PUBLIC_PIN_LOCATION_ALIAS_DEFINITIONS = [
  {
    alias: "burnham yacht harbour",
    countryCodes: ["gb"],
    latitude: 51.627746,
    longitude: 0.803725,
    maxDistanceKm: 5,
  },
  {
    alias: "conwy marina",
    countryCodes: ["gb"],
    latitude: 53.290557,
    longitude: -3.837935,
    maxDistanceKm: 5,
  },
  {
    alias: "chichester marina",
    countryCodes: ["gb"],
    latitude: 50.804083,
    longitude: -0.821084,
    maxDistanceKm: 5,
  },
  {
    alias: "palm cay marina",
    countryCodes: ["bs"],
    latitude: 25.020788,
    longitude: -77.274061,
    maxDistanceKm: 5,
  },
  {
    alias: "medway yacht club",
    countryCodes: ["gb"],
    latitude: 51.413041,
    longitude: 0.536679,
    maxDistanceKm: 5,
  },
  {
    alias: "lagoon marina",
    countryCodes: ["nl", "sx"],
    latitude: 18.03336,
    longitude: -63.085709,
    maxDistanceKm: 5,
  },
  {
    alias: "marina frapa",
    countryCodes: ["hr"],
    latitude: 43.529953,
    longitude: 15.963572,
    maxDistanceKm: 5,
  },
  {
    alias: "marina baotic",
    countryCodes: ["hr"],
    latitude: 43.5162193,
    longitude: 16.233877,
    maxDistanceKm: 5,
  },
  {
    alias: "linton bay marina",
    countryCodes: ["pa"],
    latitude: 9.6128111,
    longitude: -79.5789435,
    maxDistanceKm: 5,
  },
  {
    alias: "mdl chatham maritime marina boatyard",
    countryCodes: ["gb"],
    latitude: 51.4025553,
    longitude: 0.5321595,
    maxDistanceKm: 0.5,
    // OpenCage confidence is scored as precision-adjusted 0..1; keep Chatham
    // at high-confidence provider evidence only.
    minScore: 0.98,
    requiredComponent: {
      type: "boatyard",
      key: "boatyard",
      value: "MDL Chatham Maritime Marina Boatyard",
    },
  },
] as const;

export type VerifiedPublicPinLocationAlias =
  (typeof VERIFIED_PUBLIC_PIN_LOCATION_ALIAS_DEFINITIONS)[number]["alias"];

export const VERIFIED_PUBLIC_PIN_LOCATION_ALIASES =
  VERIFIED_PUBLIC_PIN_LOCATION_ALIAS_DEFINITIONS.map((definition) => definition.alias);

const VERIFIED_PUBLIC_PIN_ALIAS_MATCHERS = new Map(
  VERIFIED_PUBLIC_PIN_LOCATION_ALIAS_DEFINITIONS.map((definition) => [
    definition.alias,
    new RegExp(`(^|\\s)${escapeRegExp(definition.alias)}(\\s|$)`),
  ])
);

export function normalizeVerifiedPublicPinAliasText(value?: string | null) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizedHasAlias(value: string, alias: VerifiedPublicPinLocationAlias) {
  return Boolean(VERIFIED_PUBLIC_PIN_ALIAS_MATCHERS.get(alias)?.test(value));
}

export function getVerifiedPublicPinAliasDefinition(alias: VerifiedPublicPinLocationAlias) {
  return (
    VERIFIED_PUBLIC_PIN_LOCATION_ALIAS_DEFINITIONS.find(
      (definition) => definition.alias === alias
    ) || null
  );
}

export function getVerifiedPublicPinAliasInText(value?: string | null) {
  const normalized = normalizeVerifiedPublicPinAliasText(value);
  if (!normalized) return null;

  return (
    VERIFIED_PUBLIC_PIN_LOCATION_ALIASES.find((alias) => normalizedHasAlias(normalized, alias)) ||
    null
  );
}

export function textHasVerifiedPublicPinAlias(value?: string | null) {
  return Boolean(getVerifiedPublicPinAliasInText(value));
}

export function getVerifiedPublicPinAliasMatch(
  queryText?: string | null,
  resultText?: string | null
) {
  const normalizedQuery = normalizeVerifiedPublicPinAliasText(queryText);
  const normalizedResult = normalizeVerifiedPublicPinAliasText(resultText);
  if (!normalizedQuery || !normalizedResult) return null;

  return (
    VERIFIED_PUBLIC_PIN_LOCATION_ALIASES.find(
      (alias) => normalizedHasAlias(normalizedQuery, alias) && normalizedHasAlias(normalizedResult, alias)
    ) || null
  );
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function getDistanceKm(
  left: { latitude: number; longitude: number },
  right: { latitude: number; longitude: number }
) {
  const earthRadiusKm = 6371;
  const deltaLatitude = toRadians(right.latitude - left.latitude);
  const deltaLongitude = toRadians(right.longitude - left.longitude);
  const leftLatitude = toRadians(left.latitude);
  const rightLatitude = toRadians(right.latitude);
  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(leftLatitude) * Math.cos(rightLatitude) * Math.sin(deltaLongitude / 2) ** 2;

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function getPayloadComponents(payload: unknown) {
  if (!payload || typeof payload !== "object") return {};
  const record = payload as Record<string, unknown>;
  // Accept either a raw provider result with `.components` or an already-unwrapped
  // component record.
  return record.components && typeof record.components === "object"
    ? (record.components as Record<string, unknown>)
    : record;
}

export function isVerifiedPublicPinAliasAnchorMatch(
  alias: VerifiedPublicPinLocationAlias,
  input: {
    countryCode?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    score?: number | null;
    payload?: unknown;
  }
) {
  const definition = getVerifiedPublicPinAliasDefinition(alias);
  if (!definition) return false;

  const countryCode = input.countryCode?.toLowerCase() || null;
  if (!countryCode || !(definition.countryCodes as readonly string[]).includes(countryCode)) {
    return false;
  }
  if (typeof input.latitude !== "number" || typeof input.longitude !== "number") return false;

  const distanceKm = getDistanceKm(
    { latitude: definition.latitude, longitude: definition.longitude },
    { latitude: input.latitude, longitude: input.longitude }
  );

  if (distanceKm > definition.maxDistanceKm) return false;

  if ("minScore" in definition && typeof definition.minScore === "number") {
    if (typeof input.score !== "number" || input.score < definition.minScore) return false;
  }

  if ("requiredComponent" in definition) {
    const components = getPayloadComponents(input.payload);
    const required = definition.requiredComponent;
    if (required.type) {
      const type = normalizeVerifiedPublicPinAliasText(String(components._type || ""));
      if (type !== normalizeVerifiedPublicPinAliasText(required.type)) return false;
    }
    const componentValue = normalizeVerifiedPublicPinAliasText(
      String(components[required.key] || "")
    );
    if (componentValue !== normalizeVerifiedPublicPinAliasText(required.value)) return false;
  }

  return true;
}
