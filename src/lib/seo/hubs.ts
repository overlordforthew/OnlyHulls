import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicAppUrl } from "@/lib/config/urls";
import {
  getSeoHubBoatCount,
  getSeoHubBoats,
  getSeoHubLocationBounds,
  type BoatRow,
} from "@/lib/db/queries";
import {
  buildLocationLikePattern,
  getLocationSearchTerms,
  getTopLocationMarket,
} from "@/lib/locations/top-markets";
import { buildSeoHubLinks, type SeoHubLink } from "@/lib/seo/hub-links";

export interface SeoHubBrowseScope {
  // Passed to BoatBrowse as initialFilters — URL params still win, so users
  // can refine further inside the hub page.
  filters?: {
    hullType?: string;
    rigType?: string;
    minPrice?: string;
    maxPrice?: string;
    minYear?: string;
    maxYear?: string;
  };
  // Location slug consumed by BoatBrowse's location filter.
  location?: string;
  // Initial search query — used by make hubs to scope to a specific brand.
  search?: string;
}

export interface SeoHubDefinition {
  slug: string;
  href: string;
  browseHref?: string;
  title: string;
  heading: string;
  description: string;
  intro: string;
  eyebrow: string;
  queryWhere: string;
  queryParams?: unknown[];
  countLabel: string;
  relatedLinks: SeoHubLink[];
  // When set, the hub page embeds the interactive BoatBrowse below its hero
  // and seeds its filter/location state from this scope.
  browseScope?: SeoHubBrowseScope;
}

const CATAMARAN_MAKES = [
  "lagoon",
  "leopard",
  "catana",
  "bali",
  "fountaine pajot",
  "sunreef",
  "privilege",
  "nautitech",
  "outremer",
  "seawind",
];

function buildCatamaranWhereSql(paramOffset = 0) {
  const makeParams = CATAMARAN_MAKES.map((_, index) => `$${paramOffset + index + 1}`).join(", ");
  return `(
    EXISTS (
      SELECT 1
      FROM boat_dna hub_d
      WHERE hub_d.boat_id = b.id
        AND 'catamaran' = ANY(COALESCE(hub_d.character_tags, '{}'))
    )
    OR LOWER(b.make) IN (${makeParams})
  )`;
}

function buildLocationMarketQuery(slug: string, paramOffset = 0) {
  const terms = getLocationSearchTerms(slug);
  const market = getTopLocationMarket(slug);
  const marketParam = market ? `$${paramOffset + 1}` : null;
  const textOffset = paramOffset + (market ? 1 : 0);
  const queryWhere = terms.length
    ? `(${
        marketParam ? `b.location_market_slugs @> ARRAY[${marketParam}]::text[] OR ` : ""
      }(${terms
          .map(
            (_, index) =>
              `LOWER(COALESCE(b.location_text, '')) LIKE $${textOffset + index + 1} ESCAPE '\\'`
          )
          .join(" OR ")}))`
    : "FALSE";

  return {
    queryWhere,
    queryParams: [...(market ? [market.slug] : []), ...terms.map(buildLocationLikePattern)],
  };
}

export const CATEGORY_HUBS: Record<string, SeoHubDefinition> = {
  "catamarans-for-sale": {
    slug: "catamarans-for-sale",
    href: "/catamarans-for-sale",
    title: "Catamarans for Sale",
    heading: "Catamarans for Sale",
    description:
      "Browse catamarans for sale on OnlyHulls with cleaner data, better photos, and direct seller connections.",
    intro:
      "Explore catamarans for sale with cleaner listing data, stronger location coverage, and direct paths to sellers or source listings.",
    eyebrow: "Popular Catamaran Market",
    queryWhere: buildCatamaranWhereSql(),
    queryParams: CATAMARAN_MAKES,
    countLabel: "live catamaran listings",
    relatedLinks: buildSeoHubLinks("/catamarans-for-sale"),
    browseScope: { filters: { hullType: "catamaran" } },
  },
  "sailboats-for-sale": {
    slug: "sailboats-for-sale",
    href: "/sailboats-for-sale",
    title: "Sailboats for Sale",
    heading: "Sailboats for Sale",
    description:
      "Browse sailboats for sale on OnlyHulls with direct seller access, cleaner inventory, and AI-assisted discovery.",
    intro:
      "This page focuses on sailboats and monohull-style listings with useful rig data and cleaner buyer-facing inventory.",
    eyebrow: "Popular Sailboat Market",
    queryWhere: `(
      NOT ${buildCatamaranWhereSql()}
      AND COALESCE(NULLIF(TRIM(d.specs->>'rig_type'), ''), '') <> ''
    )`,
    queryParams: CATAMARAN_MAKES,
    countLabel: "live sailboat listings",
    relatedLinks: buildSeoHubLinks("/sailboats-for-sale"),
    browseScope: { filters: { hullType: "monohull" } },
  },
};

export const MAKE_HUBS: Record<string, SeoHubDefinition> = {
  lagoon: {
    slug: "lagoon",
    href: "/boats/make/lagoon",
    title: "Lagoon Boats for Sale",
    heading: "Lagoon Boats for Sale",
    description:
      "Browse Lagoon boats for sale on OnlyHulls, including catamarans and owner-focused listings with stronger metadata.",
    intro:
      "Lagoon is one of the most searched multihull brands in the market. This page keeps the active Lagoon inventory in one indexable place.",
    eyebrow: "Popular Make",
    queryWhere: "LOWER(b.make) = $1",
    queryParams: ["lagoon"],
    countLabel: "live Lagoon listings",
    relatedLinks: buildSeoHubLinks("/boats/make/lagoon"),
    browseScope: { search: "Lagoon" },
  },
  leopard: {
    slug: "leopard",
    href: "/boats/make/leopard",
    title: "Leopard Boats for Sale",
    heading: "Leopard Boats for Sale",
    description:
      "Browse Leopard boats for sale on OnlyHulls with cleaner location data and direct paths to seller or broker listings.",
    intro:
      "Leopard remains one of the strongest liveaboard and charter-driven catamaran searches, so it deserves its own crawlable hub.",
    eyebrow: "Popular Make",
    queryWhere: "LOWER(b.make) = $1",
    queryParams: ["leopard"],
    countLabel: "live Leopard listings",
    relatedLinks: buildSeoHubLinks("/boats/make/leopard"),
    browseScope: { search: "Leopard" },
  },
  bali: {
    slug: "bali",
    href: "/boats/make/bali",
    title: "Bali Boats for Sale",
    heading: "Bali Boats for Sale",
    description:
      "Browse Bali boats for sale on OnlyHulls with cleaner inventory, direct listing paths, and better buyer-facing data.",
    intro:
      "Bali is one of the strongest modern catamaran brands in buyer searches, so it gets its own crawlable make hub here.",
    eyebrow: "Popular Make",
    queryWhere: "LOWER(b.make) = $1",
    queryParams: ["bali"],
    countLabel: "live Bali listings",
    relatedLinks: buildSeoHubLinks("/boats/make/bali"),
    browseScope: { search: "Bali" },
  },
  catana: {
    slug: "catana",
    href: "/boats/make/catana",
    title: "Catana Boats for Sale",
    heading: "Catana Boats for Sale",
    description:
      "Browse Catana boats for sale on OnlyHulls with stronger location coverage and cleaner buyer-facing inventory.",
    intro:
      "Catana attracts serious bluewater catamaran buyers, so this hub keeps that inventory in one high-intent make page.",
    eyebrow: "Popular Make",
    queryWhere: "LOWER(b.make) = $1",
    queryParams: ["catana"],
    countLabel: "live Catana listings",
    relatedLinks: buildSeoHubLinks("/boats/make/catana"),
    browseScope: { search: "Catana" },
  },
};

export const LOCATION_HUBS: Record<string, SeoHubDefinition> = {
  florida: {
    slug: "florida",
    href: "/boats/location/florida",
    browseHref: "/boats?location=florida",
    title: "Boats for Sale in Florida",
    heading: "Boats for Sale in Florida",
    description:
      "Browse boats for sale in Florida on OnlyHulls, including catamarans and sailboats with stronger location coverage and direct contact paths.",
    intro:
      "Florida is one of the deepest regional markets in the current catalog, so this page captures a strong local-intent search pattern.",
    eyebrow: "Top Boat Market",
    ...buildLocationMarketQuery("florida"),
    countLabel: "live Florida listings",
    relatedLinks: buildSeoHubLinks("/boats/location/florida"),
    browseScope: { location: "florida" },
  },
  caribbean: {
    slug: "caribbean",
    href: "/boats/location/caribbean",
    browseHref: "/boats?location=caribbean",
    title: "Boats for Sale in the Caribbean",
    heading: "Boats for Sale in the Caribbean",
    description:
      "Browse boats for sale in the Caribbean on OnlyHulls, from island-based catamarans to cruising boats with better location signals.",
    intro:
      "The Caribbean hub groups high-intent island markets like Puerto Rico, the Bahamas, Tortola, and the Virgin Islands into one rankable page.",
    eyebrow: "Cruising Region",
    ...buildLocationMarketQuery("caribbean"),
    countLabel: "live Caribbean listings",
    relatedLinks: buildSeoHubLinks("/boats/location/caribbean"),
    browseScope: { location: "caribbean" },
  },
  "puerto-rico": {
    slug: "puerto-rico",
    href: "/boats/location/puerto-rico",
    browseHref: "/boats?location=puerto%20rico",
    title: "Boats for Sale in Puerto Rico",
    heading: "Boats for Sale in Puerto Rico",
    description:
      "Browse boats for sale in Puerto Rico on OnlyHulls with stronger local intent, better photos, and direct seller paths.",
    intro:
      "Puerto Rico is a strong Caribbean search market with recurring island inventory, so it deserves a dedicated local landing page.",
    eyebrow: "Island Market",
    ...buildLocationMarketQuery("puerto-rico"),
    countLabel: "live Puerto Rico listings",
    relatedLinks: buildSeoHubLinks("/boats/location/puerto-rico"),
    browseScope: { location: "puerto-rico" },
  },
  bahamas: {
    slug: "bahamas",
    href: "/boats/location/bahamas",
    browseHref: "/boats?location=bahamas",
    title: "Boats for Sale in the Bahamas",
    heading: "Boats for Sale in the Bahamas",
    description:
      "Browse boats for sale in the Bahamas on OnlyHulls, from island-based catamarans to cruising boats with cleaner location data.",
    intro:
      "The Bahamas is one of the clearest Caribbean cruising search patterns, so this page gives it a stable, rankable regional hub.",
    eyebrow: "Island Market",
    ...buildLocationMarketQuery("bahamas"),
    countLabel: "live Bahamas listings",
    relatedLinks: buildSeoHubLinks("/boats/location/bahamas"),
    browseScope: { location: "bahamas" },
  },
};

export async function getSeoHubData(hub: SeoHubDefinition) {
  const [boats, total, locationBounds] = await Promise.all([
    getSeoHubBoats(hub.queryWhere, hub.queryParams || []),
    getSeoHubBoatCount(hub.queryWhere, hub.queryParams || []),
    getSeoHubLocationBounds(hub.queryWhere, hub.queryParams || []),
  ]);

  return { boats, total, locationBounds };
}

// Hubs with fewer than this many active boats get robots noindex so Google
// doesn't flag them as thin content. They stay reachable via internal links
// until inventory recovers.
const HUB_MIN_INDEXABLE_INVENTORY = 3;

export function buildSeoHubMetadata(
  hub: SeoHubDefinition,
  options: { inventoryCount?: number; locale?: string } = {}
): Metadata {
  const appUrl = getPublicAppUrl();
  const canonical = `${appUrl}${hub.href}`;
  const inventoryCount = options.inventoryCount;
  const thinContent =
    typeof inventoryCount === "number" && inventoryCount < HUB_MIN_INDEXABLE_INVENTORY;
  // Non-default locales share the same canonical as English via cookie
  // detection, which would create duplicate-content noise in Google's
  // index. Noindex them until the /es path split lands.
  const nonDefaultLocale =
    typeof options.locale === "string" && options.locale !== "en";
  const shouldNoindex = thinContent || nonDefaultLocale;

  return {
    title: hub.title,
    description: hub.description,
    metadataBase: new URL(appUrl),
    alternates: {
      canonical,
    },
    robots: shouldNoindex ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      type: "website",
      url: canonical,
      title: `${hub.title} | OnlyHulls`,
      description: hub.description,
      images: ["/og-image.png"],
    },
    twitter: {
      card: "summary_large_image",
      title: `${hub.title} | OnlyHulls`,
      description: hub.description,
      images: ["/og-image.png"],
    },
  };
}

export function getCategoryHub(slug: string) {
  return CATEGORY_HUBS[slug] ?? null;
}

export function getMakeHub(slug: string) {
  return MAKE_HUBS[slug] ?? null;
}

export function getLocationHub(slug: string) {
  return LOCATION_HUBS[slug] ?? null;
}

export function requireSeoHub<T extends SeoHubDefinition | null>(hub: T): Exclude<T, null> {
  if (!hub) notFound();
  return hub as Exclude<T, null>;
}

export function buildHubCollectionSchema(hub: SeoHubDefinition, boats: BoatRow[], total: number) {
  const appUrl = getPublicAppUrl();
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: hub.heading,
    description: hub.description,
    url: `${appUrl}${hub.href}`,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: total,
      itemListElement: boats.slice(0, 10).map((boat, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${appUrl}/boats/${boat.slug || boat.id}`,
        name: `${boat.year} ${boat.make} ${boat.model}`,
      })),
    },
  };
}

export function buildHubBreadcrumbSchema(hub: SeoHubDefinition) {
  const appUrl = getPublicAppUrl();
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "OnlyHulls",
        item: appUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: hub.heading,
        item: `${appUrl}${hub.href}`,
      },
    ],
  };
}

export function getRelevantSeoHubLinksForBoat(input: {
  make?: string | null;
  locationText?: string | null;
  characterTags?: string[] | null;
}) {
  const links: SeoHubLink[] = [];
  const seen = new Set<string>();
  const makeSlug = String(input.make || "").trim().toLowerCase();
  const location = String(input.locationText || "").trim().toLowerCase();
  const tagSet = new Set((input.characterTags || []).map((tag) => tag.toLowerCase()));

  const push = (link: SeoHubLink | undefined) => {
    if (!link || seen.has(link.href)) return;
    seen.add(link.href);
    links.push(link);
  };

  push(STATIC_HUB_LOOKUP[`/boats/make/${makeSlug}`]);

  if (tagSet.has("catamaran") || CATAMARAN_MAKES.includes(makeSlug)) {
    push(STATIC_HUB_LOOKUP["/catamarans-for-sale"]);
  } else {
    push(STATIC_HUB_LOOKUP["/sailboats-for-sale"]);
  }

  if (location.includes("puerto rico")) {
    push(STATIC_HUB_LOOKUP["/boats/location/puerto-rico"]);
    push(STATIC_HUB_LOOKUP["/boats/location/caribbean"]);
  } else if (location.includes("bahamas")) {
    push(STATIC_HUB_LOOKUP["/boats/location/bahamas"]);
    push(STATIC_HUB_LOOKUP["/boats/location/caribbean"]);
  } else if (location.includes("florida")) {
    push(STATIC_HUB_LOOKUP["/boats/location/florida"]);
  } else if (
    location.includes("caribbean") ||
    location.includes("virgin islands") ||
    location.includes("tortola") ||
    location.includes("grenada") ||
    location.includes("st martin") ||
    location.includes("martinique")
  ) {
    push(STATIC_HUB_LOOKUP["/boats/location/caribbean"]);
  }

  for (const fallback of buildSeoHubLinks("__none__")) {
    if (links.length >= 4) break;
    push(fallback);
  }

  return links.slice(0, 4);
}

const STATIC_HUB_LOOKUP = Object.fromEntries(
  buildSeoHubLinks("__none__").map((link) => [link.href, link])
);
