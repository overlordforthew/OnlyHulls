export interface TopLocationMarket {
  slug: string;
  label: string;
  aliases: string[];
  searchTerms: string[];
  hubHref?: string;
}

export const TOP_LOCATION_MARKETS: TopLocationMarket[] = [
  {
    slug: "florida",
    label: "Florida",
    hubHref: "/boats/location/florida",
    aliases: ["fl", "fort lauderdale", "ft lauderdale", "miami", "key west", "stuart", "marathon", "tampa"],
    searchTerms: ["florida", "fort lauderdale", "ft lauderdale", "miami", "key west", "stuart", "marathon", "tampa"],
  },
  {
    slug: "bahamas",
    label: "Bahamas",
    hubHref: "/boats/location/bahamas",
    aliases: ["the bahamas", "nassau", "abaco", "exuma", "george town"],
    searchTerms: ["bahamas", "nassau", "abaco", "exuma", "george town"],
  },
  {
    slug: "puerto-rico",
    label: "Puerto Rico",
    hubHref: "/boats/location/puerto-rico",
    aliases: ["pr", "san juan", "fajardo", "culebra", "vieques"],
    searchTerms: ["puerto rico", "san juan", "fajardo", "culebra", "vieques"],
  },
  {
    slug: "caribbean",
    label: "Caribbean",
    hubHref: "/boats/location/caribbean",
    aliases: ["west indies", "bvi", "usvi", "virgin islands", "tortola", "st martin", "saint martin", "grenada", "antigua", "martinique"],
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
    aliases: ["british virgin islands", "tortola", "nanny cay"],
    searchTerms: ["bvi", "british virgin islands", "tortola", "nanny cay"],
  },
  {
    slug: "usvi",
    label: "USVI",
    aliases: ["us virgin islands", "u.s. virgin islands", "st thomas", "st. thomas", "st john", "st croix"],
    searchTerms: ["usvi", "us virgin islands", "u.s. virgin islands", "st thomas", "st. thomas", "st john", "st croix"],
  },
  {
    slug: "mediterranean",
    label: "Mediterranean",
    aliases: ["med", "mallorca", "sardinia", "balearics", "ionian", "aegean"],
    searchTerms: ["mediterranean", "mallorca", "sardinia", "balearics", "ionian", "aegean", "greece", "spain", "france", "italy", "croatia"],
  },
  {
    slug: "greece",
    label: "Greece",
    aliases: ["greek islands", "lefkada", "athens", "ionian", "aegean"],
    searchTerms: ["greece", "greek islands", "lefkada", "athens", "ionian", "aegean"],
  },
  {
    slug: "spain",
    label: "Spain",
    aliases: ["espagne", "mallorca", "palma", "balearics", "canary islands"],
    searchTerms: ["spain", "espagne", "mallorca", "palma", "balearics", "canary islands"],
  },
  {
    slug: "france",
    label: "France",
    aliases: ["la rochelle", "marseille", "lorient", "canet-en-roussillon"],
    searchTerms: ["france", "la rochelle", "marseille", "lorient", "canet-en-roussillon"],
  },
  {
    slug: "italy",
    label: "Italy",
    aliases: ["sardinia", "sicily", "olbia", "tuscany"],
    searchTerms: ["italy", "sardinia", "sicily", "olbia", "tuscany"],
  },
  {
    slug: "uk",
    label: "UK",
    aliases: ["united kingdom", "england", "hamble", "southampton"],
    searchTerms: ["uk", "united kingdom", "england", "hamble", "southampton"],
  },
  {
    slug: "pacific-northwest",
    label: "Pacific Northwest",
    aliases: ["pnw", "seattle", "anacortes", "port townsend", "british columbia", "vancouver"],
    searchTerms: ["pacific northwest", "pnw", "seattle", "anacortes", "port townsend", "british columbia", "vancouver", "washington"],
  },
  {
    slug: "california",
    label: "California",
    aliases: ["san diego", "san francisco", "ventura", "los angeles", "newport beach"],
    searchTerms: ["california", "san diego", "san francisco", "ventura", "los angeles", "newport beach"],
  },
  {
    slug: "chesapeake-bay",
    label: "Chesapeake Bay",
    aliases: ["chesapeake", "annapolis", "maryland", "virginia", "norfolk"],
    searchTerms: ["chesapeake bay", "chesapeake", "annapolis", "maryland", "virginia", "norfolk"],
  },
  {
    slug: "great-lakes",
    label: "Great Lakes",
    aliases: ["lake michigan", "lake erie", "lake huron", "lake ontario", "lake superior", "chicago"],
    searchTerms: ["great lakes", "lake michigan", "lake erie", "lake huron", "lake ontario", "lake superior", "chicago"],
  },
  {
    slug: "mexico",
    label: "Mexico",
    aliases: ["sea of cortez", "baja", "la paz", "puerto vallarta"],
    searchTerms: ["mexico", "sea of cortez", "baja", "la paz", "puerto vallarta"],
  },
  {
    slug: "panama",
    label: "Panama",
    aliases: ["bocas del toro", "shelter bay"],
    searchTerms: ["panama", "bocas del toro", "shelter bay"],
  },
  {
    slug: "australia",
    label: "Australia",
    aliases: ["queensland", "sydney", "brisbane", "gold coast"],
    searchTerms: ["australia", "queensland", "sydney", "brisbane", "gold coast"],
  },
  {
    slug: "new-zealand",
    label: "New Zealand",
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

export function getTopLocationMarket(value?: string | null) {
  const normalized = normalizeLocationLookupValue(value);
  if (!normalized) return null;

  return (
    TOP_LOCATION_MARKETS.find((market) => {
      const candidates = [market.slug, market.label, ...market.aliases, ...market.searchTerms];
      return candidates.some((candidate) => normalizeLocationLookupValue(candidate) === normalized);
    }) || null
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
