export interface TopLocationMarket {
  slug: string;
  label: string;
  aliases: string[];
  searchTerms: string[];
  hubHref?: string;
  country?: string;
  region?: string;
  parentSlugs?: string[];
}

export type LocationConfidence = "unknown" | "region" | "city" | "exact";

export interface LocationMarketSignals {
  marketSlugs: string[];
  country: string | null;
  region: string | null;
  confidence: LocationConfidence;
  approximate: boolean;
}

export const TOP_LOCATION_MARKETS: TopLocationMarket[] = [
  {
    slug: "florida",
    label: "Florida",
    hubHref: "/boats/location/florida",
    country: "United States",
    region: "Florida",
    aliases: ["fl", "fort lauderdale", "ft lauderdale", "miami", "key west", "stuart", "marathon", "tampa"],
    searchTerms: ["florida", "fort lauderdale", "ft lauderdale", "miami", "key west", "stuart", "marathon", "tampa"],
  },
  {
    slug: "bahamas",
    label: "Bahamas",
    hubHref: "/boats/location/bahamas",
    country: "Bahamas",
    region: "Caribbean",
    parentSlugs: ["caribbean"],
    aliases: ["the bahamas", "nassau", "abaco", "exuma", "george town"],
    searchTerms: ["bahamas", "nassau", "abaco", "exuma", "george town"],
  },
  {
    slug: "puerto-rico",
    label: "Puerto Rico",
    hubHref: "/boats/location/puerto-rico",
    country: "Puerto Rico",
    region: "Caribbean",
    parentSlugs: ["caribbean"],
    aliases: ["pr", "san juan", "fajardo", "culebra", "vieques"],
    searchTerms: ["puerto rico", "san juan", "fajardo", "culebra", "vieques"],
  },
  {
    slug: "caribbean",
    label: "Caribbean",
    hubHref: "/boats/location/caribbean",
    region: "Caribbean",
    aliases: ["west indies", "virgin islands"],
    searchTerms: [
      "caribbean",
      "bahamas",
      "puerto rico",
      "virgin islands",
      "bvi",
      "usvi",
      "tortola",
      "grenada",
      "antigua",
      "st martin",
      "saint martin",
      "st. maarten",
      "martinique",
      "st thomas",
      "saint thomas",
      "trinidad",
      "barbados",
    ],
  },
  {
    slug: "bvi",
    label: "BVI",
    country: "British Virgin Islands",
    region: "Caribbean",
    parentSlugs: ["caribbean"],
    aliases: ["british virgin islands", "tortola", "nanny cay"],
    searchTerms: ["bvi", "british virgin islands", "tortola", "nanny cay"],
  },
  {
    slug: "usvi",
    label: "USVI",
    country: "United States Virgin Islands",
    region: "Caribbean",
    parentSlugs: ["caribbean"],
    aliases: ["us virgin islands", "u.s. virgin islands", "st thomas", "st. thomas", "st john", "st croix"],
    searchTerms: ["usvi", "us virgin islands", "u.s. virgin islands", "st thomas", "st. thomas", "st john", "st croix"],
  },
  {
    slug: "mediterranean",
    label: "Mediterranean",
    region: "Mediterranean",
    aliases: ["med"],
    searchTerms: ["mediterranean", "mallorca", "sardinia", "balearics", "ionian", "aegean", "greece", "spain", "france", "italy", "croatia"],
  },
  {
    slug: "greece",
    label: "Greece",
    country: "Greece",
    region: "Mediterranean",
    parentSlugs: ["mediterranean"],
    aliases: ["greek islands", "lefkada", "athens", "ionian", "aegean"],
    searchTerms: ["greece", "greek islands", "lefkada", "athens", "ionian", "aegean"],
  },
  {
    slug: "spain",
    label: "Spain",
    country: "Spain",
    region: "Mediterranean",
    parentSlugs: ["mediterranean"],
    aliases: ["espagne", "mallorca", "palma", "balearics", "canary islands"],
    searchTerms: ["spain", "espagne", "mallorca", "palma", "balearics", "canary islands"],
  },
  {
    slug: "france",
    label: "France",
    country: "France",
    region: "Mediterranean",
    parentSlugs: ["mediterranean"],
    aliases: ["la rochelle", "marseille", "lorient", "canet-en-roussillon"],
    searchTerms: ["france", "la rochelle", "marseille", "lorient", "canet-en-roussillon"],
  },
  {
    slug: "italy",
    label: "Italy",
    country: "Italy",
    region: "Mediterranean",
    parentSlugs: ["mediterranean"],
    aliases: ["sardinia", "sicily", "olbia", "tuscany"],
    searchTerms: ["italy", "sardinia", "sicily", "olbia", "tuscany"],
  },
  {
    slug: "uk",
    label: "UK",
    country: "United Kingdom",
    region: "United Kingdom",
    aliases: ["united kingdom", "england", "hamble", "southampton"],
    searchTerms: ["uk", "united kingdom", "england", "hamble", "southampton"],
  },
  {
    slug: "pacific-northwest",
    label: "Pacific Northwest",
    country: "United States",
    region: "Pacific Northwest",
    aliases: ["pnw", "seattle", "anacortes", "port townsend", "british columbia", "vancouver"],
    searchTerms: ["pacific northwest", "pnw", "seattle", "anacortes", "port townsend", "british columbia", "vancouver", "washington"],
  },
  {
    slug: "california",
    label: "California",
    country: "United States",
    region: "California",
    aliases: ["san diego", "san francisco", "ventura", "los angeles", "newport beach"],
    searchTerms: ["california", "san diego", "san francisco", "ventura", "los angeles", "newport beach"],
  },
  {
    slug: "chesapeake-bay",
    label: "Chesapeake Bay",
    country: "United States",
    region: "Chesapeake Bay",
    aliases: ["chesapeake", "annapolis", "maryland", "virginia", "norfolk"],
    searchTerms: ["chesapeake bay", "chesapeake", "annapolis", "maryland", "virginia", "norfolk"],
  },
  {
    slug: "great-lakes",
    label: "Great Lakes",
    country: "United States",
    region: "Great Lakes",
    aliases: ["lake michigan", "lake erie", "lake huron", "lake ontario", "lake superior", "chicago"],
    searchTerms: ["great lakes", "lake michigan", "lake erie", "lake huron", "lake ontario", "lake superior", "chicago"],
  },
  {
    slug: "mexico",
    label: "Mexico",
    country: "Mexico",
    region: "Mexico",
    aliases: ["sea of cortez", "baja", "la paz", "puerto vallarta"],
    searchTerms: ["mexico", "sea of cortez", "baja", "la paz", "puerto vallarta"],
  },
  {
    slug: "panama",
    label: "Panama",
    country: "Panama",
    region: "Panama",
    aliases: ["bocas del toro", "shelter bay"],
    searchTerms: ["panama", "bocas del toro", "shelter bay"],
  },
  {
    slug: "australia",
    label: "Australia",
    country: "Australia",
    region: "Australia",
    aliases: ["queensland", "sydney", "brisbane", "gold coast"],
    searchTerms: ["australia", "queensland", "sydney", "brisbane", "gold coast"],
  },
  {
    slug: "new-zealand",
    label: "New Zealand",
    country: "New Zealand",
    region: "New Zealand",
    aliases: ["nz", "auckland", "bay of islands"],
    searchTerms: ["new zealand", "auckland", "bay of islands"],
  },
];

export const FEATURED_LOCATION_MARKET_SLUGS = [
  "florida",
  "bahamas",
  "puerto-rico",
  "caribbean",
  "mediterranean",
  "california",
  "chesapeake-bay",
  "pacific-northwest",
];

function normalizeLocationLookupValue(value?: string | null) {
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

function containsNormalizedTerm(normalizedText: string, candidate: string) {
  const normalizedCandidate = normalizeLocationLookupValue(candidate);
  if (normalizedCandidate.length < 2) return false;

  return ` ${normalizedText} `.includes(` ${normalizedCandidate} `);
}

function hasFiniteCoordinates(latitude?: number | null, longitude?: number | null) {
  return (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export function getTopLocationMarket(value?: string | null) {
  const normalized = normalizeLocationLookupValue(value);
  if (!normalized) return null;

  return (
    findMarketByCandidates(normalized, (market) => [market.slug, market.label]) ||
    findMarketByCandidates(normalized, (market) => market.aliases) ||
    findMarketByCandidates(normalized, (market) => market.searchTerms) ||
    null
  );
}

function findMarketByCandidates(
  normalized: string,
  getCandidates: (market: TopLocationMarket) => string[]
) {
  return TOP_LOCATION_MARKETS.find((market) =>
    getCandidates(market).some((candidate) => normalizeLocationLookupValue(candidate) === normalized)
  );
}

export function canonicalizeLocationParam(value?: string | null) {
  const market = getTopLocationMarket(value);
  const trimmed = String(value || "").trim();
  return market?.slug || trimmed || null;
}

export function getLocationDisplayName(value?: string | null) {
  const market = getTopLocationMarket(value);
  const trimmed = String(value || "").trim();
  return market?.label || trimmed;
}

export function getLocationSearchTerms(value?: string | null) {
  const market = getTopLocationMarket(value);
  const fallback = String(value || "").trim();
  const terms = market ? [market.label, ...market.searchTerms] : [fallback];
  const seen = new Set<string>();

  return terms
    .map((term) => term.trim())
    .filter((term) => {
      const key = term.toLowerCase();
      if (term.length < 2 || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function getLocationMarketSlugs(value?: string | null) {
  const market = getTopLocationMarket(value);
  return market ? [market.slug] : [];
}

export function inferLocationMarketSignals(input: {
  locationText?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): LocationMarketSignals {
  const normalizedLocation = normalizeLocationLookupValue(input.locationText);
  const hasCoordinates = hasFiniteCoordinates(input.latitude, input.longitude);
  const matchedMarkets = normalizedLocation
    ? TOP_LOCATION_MARKETS.filter((market) =>
        [market.label, market.slug, ...market.aliases, ...market.searchTerms].some((term) =>
          containsNormalizedTerm(normalizedLocation, term)
        )
      )
    : [];
  const slugSet = new Set<string>();

  matchedMarkets.forEach((market) => {
    slugSet.add(market.slug);
    market.parentSlugs?.forEach((parentSlug) => slugSet.add(parentSlug));
  });

  const marketSlugs = TOP_LOCATION_MARKETS
    .map((market) => market.slug)
    .filter((slug) => slugSet.has(slug));
  const primaryMarket =
    matchedMarkets.find((market) => Boolean(market.country)) ?? matchedMarkets[0] ?? null;
  const hasLocationDetail = String(input.locationText || "").includes(",");
  const matchedByLocalTerm =
    hasLocationDetail ||
    matchedMarkets.some((market) =>
      Boolean(market.country) &&
      market.aliases.some((term) => containsNormalizedTerm(normalizedLocation, term))
    );
  const confidence: LocationConfidence = hasCoordinates
    ? "exact"
    : marketSlugs.length === 0
      ? "unknown"
      : matchedByLocalTerm
        ? "city"
        : "region";

  return {
    marketSlugs,
    country: primaryMarket?.country ?? null,
    region: primaryMarket?.region ?? primaryMarket?.label ?? null,
    confidence,
    approximate: !hasCoordinates,
  };
}

export function getFeaturedLocationMarkets() {
  return FEATURED_LOCATION_MARKET_SLUGS
    .map((slug) => getTopLocationMarket(slug))
    .filter((market): market is TopLocationMarket => Boolean(market));
}

export function escapeSqlLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export function buildLocationLikePattern(value: string) {
  return `%${escapeSqlLikePattern(value.trim().toLowerCase())}%`;
}
