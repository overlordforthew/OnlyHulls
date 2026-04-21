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

export function isVerifiedPublicPinAliasAnchorMatch(
  alias: VerifiedPublicPinLocationAlias,
  input: {
    countryCode?: string | null;
    latitude?: number | null;
    longitude?: number | null;
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

  return distanceKm <= definition.maxDistanceKm;
}
