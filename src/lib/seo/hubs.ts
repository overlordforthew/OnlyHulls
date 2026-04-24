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

// Programmatic hub expansion. Every catamaran/sailboat × known-location
// pair gets auto-generated via resolveProgrammaticHub(). The single dynamic
// /[programmaticSlug] route serves them all and thin-content gating still
// applies per-request via generateMetadata's inventory count.
type ProgrammaticCategory = {
  slug: string;
  // Parent static hub the programmatic route specialises — so the synthesized
  // relatedLinks surface the correct "broader search" anchor alongside the
  // location. Used by buildProgrammaticHubSiblingLinks to prioritise parents.
  staticHubHref: string;
  // Classification used by getRelevantSeoHubLinksForBoat to map a boat's hull
  // signal (catamaran tag / catamaran make) onto the right programmatic axis.
  hullAxis: "catamaran" | "monohull";
  heading: (location: string) => string;
  title: (location: string) => string;
  description: (location: string) => string;
  intro: (location: string) => string;
  eyebrow: (location: string) => string;
  countLabel: (location: string) => string;
  scopeFilters: NonNullable<SeoHubBrowseScope["filters"]>;
  buildWhereSql: (paramOffset: number) => { sql: string; params: unknown[] };
};

const PROGRAMMATIC_CATEGORIES: ProgrammaticCategory[] = [
  {
    slug: "catamarans-for-sale-in",
    staticHubHref: "/catamarans-for-sale",
    hullAxis: "catamaran",
    heading: (loc) => `Catamarans for Sale in ${loc}`,
    title: (loc) => `Catamarans for Sale in ${loc}`,
    description: (loc) =>
      `Browse catamarans for sale in ${loc} on OnlyHulls — cleaner listings, stronger location data, and direct seller paths.`,
    intro: (loc) =>
      `This page narrows the OnlyHulls catamaran catalog to ${loc} listings only. Direct broker / owner contact, no middleman commission, cleaner geocoding than general catamaran search.`,
    eyebrow: (loc) => `Catamaran × ${loc}`,
    countLabel: (loc) => `live ${loc} catamarans`,
    scopeFilters: { hullType: "catamaran" },
    buildWhereSql: (offset) => ({
      sql: buildCatamaranWhereSql(offset),
      params: [...CATAMARAN_MAKES],
    }),
  },
  {
    slug: "sailboats-for-sale-in",
    staticHubHref: "/sailboats-for-sale",
    hullAxis: "monohull",
    heading: (loc) => `Sailboats for Sale in ${loc}`,
    title: (loc) => `Sailboats for Sale in ${loc}`,
    description: (loc) =>
      `Browse sailboats and monohulls for sale in ${loc} on OnlyHulls with direct seller paths and AI-assisted discovery.`,
    intro: (loc) =>
      `This page narrows OnlyHulls monohulls to ${loc} listings with useful rig data and cleaner buyer-facing inventory.`,
    eyebrow: (loc) => `Sailboat × ${loc}`,
    countLabel: (loc) => `live ${loc} sailboats`,
    scopeFilters: { hullType: "monohull" },
    buildWhereSql: (offset) => ({
      sql: `(
        NOT ${buildCatamaranWhereSql(offset)}
        AND COALESCE(NULLIF(TRIM(d.specs->>'rig_type'), ''), '') <> ''
      )`,
      params: [...CATAMARAN_MAKES],
    }),
  },
];

function synthesizeProgrammaticHub(
  category: ProgrammaticCategory,
  locationSlug: string
): SeoHubDefinition | null {
  const locationHub = LOCATION_HUBS[locationSlug];
  if (!locationHub) return null;
  // Location hubs' heading format is "Boats for Sale in {Location}" — strip
  // the prefix to get a display-ready location label for the programmatic
  // hub copy.
  const locationLabel =
    locationHub.heading.replace(/^Boats for Sale in\s+/i, "") || locationHub.slug;
  const categoryWhere = category.buildWhereSql(0);
  const locationWhere = buildLocationMarketQuery(locationSlug, categoryWhere.params.length);
  const href = `/${category.slug}-${locationSlug}`;
  return {
    slug: href.slice(1),
    href,
    title: category.title(locationLabel),
    heading: category.heading(locationLabel),
    description: category.description(locationLabel),
    intro: category.intro(locationLabel),
    eyebrow: category.eyebrow(locationLabel),
    queryWhere: `(${categoryWhere.sql} AND ${locationWhere.queryWhere})`,
    queryParams: [...categoryWhere.params, ...locationWhere.queryParams],
    countLabel: category.countLabel(locationLabel),
    // Sibling programmatic hubs first (same category × other locations, then
    // same location × other categories) so cross-axis discovery gets priority
    // over generic static hubs. Parent static hubs (the category and the
    // location) appear next as higher-authority anchors, then the remaining
    // static set fills to the end.
    relatedLinks: [
      ...buildProgrammaticHubSiblingLinks(category.slug, locationSlug),
      ...buildSeoHubLinks(href).filter((link) =>
        link.href === category.staticHubHref || link.href === locationHub.href
      ),
      ...buildSeoHubLinks(href).filter(
        (link) => link.href !== category.staticHubHref && link.href !== locationHub.href
      ),
    ],
    browseScope: {
      filters: category.scopeFilters,
      location: locationSlug,
    },
  };
}

// Enumerate sibling programmatic hubs for a given (category, location) pair:
// same-category × other-locations, then same-location × other-categories.
// Used to cross-link programmatic pages so crawlers (and users) discover the
// full matrix once they land on one page in it.
function buildProgrammaticHubSiblingLinks(
  currentCategorySlug: string,
  currentLocationSlug: string
): SeoHubLink[] {
  const links: SeoHubLink[] = [];
  // Same category × other locations
  for (const locationSlug of Object.keys(LOCATION_HUBS)) {
    if (locationSlug === currentLocationSlug) continue;
    const category = PROGRAMMATIC_CATEGORIES.find((c) => c.slug === currentCategorySlug);
    if (!category) continue;
    const synth = synthesizeProgrammaticHubWithoutSiblings(category, locationSlug);
    if (synth) links.push({ href: synth.href, label: synth.heading, description: synth.description });
  }
  // Other categories × same location
  for (const category of PROGRAMMATIC_CATEGORIES) {
    if (category.slug === currentCategorySlug) continue;
    const synth = synthesizeProgrammaticHubWithoutSiblings(category, currentLocationSlug);
    if (synth) links.push({ href: synth.href, label: synth.heading, description: synth.description });
  }
  return links;
}

// Lightweight variant used by buildProgrammaticHubSiblingLinks to avoid
// recursing through synthesizeProgrammaticHub's own sibling build. Produces
// just the fields needed to format a link, not a full SeoHubDefinition.
function synthesizeProgrammaticHubWithoutSiblings(
  category: ProgrammaticCategory,
  locationSlug: string
): { href: string; heading: string; description: string } | null {
  const locationHub = LOCATION_HUBS[locationSlug];
  if (!locationHub) return null;
  const locationLabel =
    locationHub.heading.replace(/^Boats for Sale in\s+/i, "") || locationHub.slug;
  return {
    href: `/${category.slug}-${locationSlug}`,
    heading: category.heading(locationLabel),
    description: category.description(locationLabel),
  };
}

// Lookup used by the dynamic /[programmaticSlug] route. Returns null for
// any slug that doesn't match the {category}-{location} pattern or whose
// location piece isn't a known LOCATION_HUBS slug.
export function resolveProgrammaticHub(slug: string): SeoHubDefinition | null {
  for (const category of PROGRAMMATIC_CATEGORIES) {
    const prefix = `${category.slug}-`;
    if (slug.startsWith(prefix)) {
      const locationSlug = slug.slice(prefix.length);
      return synthesizeProgrammaticHub(category, locationSlug);
    }
  }
  return null;
}

// Enumerate every valid programmatic slug (category × known-location cross
// product). Used by the sitemap to broadcast them; inventory gating is
// applied downstream against live counts.
export function listProgrammaticHubSlugs(): string[] {
  const slugs: string[] = [];
  for (const category of PROGRAMMATIC_CATEGORIES) {
    for (const locationSlug of Object.keys(LOCATION_HUBS)) {
      slugs.push(`${category.slug}-${locationSlug}`);
    }
  }
  return slugs;
}

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
  const locale = options.locale === "es" ? "es" : "en";
  const canonical =
    locale === "en" ? `${appUrl}${hub.href}` : `${appUrl}/es${hub.href}`;
  const inventoryCount = options.inventoryCount;
  const thinContent =
    typeof inventoryCount === "number" && inventoryCount < HUB_MIN_INDEXABLE_INVENTORY;

  return {
    title: hub.title,
    description: hub.description,
    metadataBase: new URL(appUrl),
    alternates: {
      canonical,
      // hreflang matrix so Google understands the en/es pair. x-default
      // points at en to match Google's recommendation for unknown-locale
      // fallback.
      languages: {
        en: `${appUrl}${hub.href}`,
        es: `${appUrl}/es${hub.href}`,
        "x-default": `${appUrl}${hub.href}`,
      },
    },
    robots: thinContent ? { index: false, follow: true } : { index: true, follow: true },
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
  const isCatamaran = tagSet.has("catamaran") || CATAMARAN_MAKES.includes(makeSlug);

  const push = (link: SeoHubLink | undefined) => {
    if (!link || seen.has(link.href)) return;
    seen.add(link.href);
    links.push(link);
  };

  // Resolve the best location slug from the boat's location_text. This also
  // lets us synthesize a programmatic hub link ({hull} × {location}) when both
  // signals are present — the highest-intent internal link we can show on a
  // boat detail page.
  const locationSlug = (() => {
    if (location.includes("puerto rico")) return "puerto-rico";
    if (location.includes("bahamas")) return "bahamas";
    if (location.includes("florida")) return "florida";
    if (
      location.includes("caribbean") ||
      location.includes("virgin islands") ||
      location.includes("tortola") ||
      location.includes("grenada") ||
      location.includes("st martin") ||
      location.includes("martinique")
    )
      return "caribbean";
    return null;
  })();

  if (locationSlug) {
    const categorySlug = isCatamaran ? "catamarans-for-sale-in" : "sailboats-for-sale-in";
    const programmatic = PROGRAMMATIC_CATEGORIES.find((c) => c.slug === categorySlug);
    if (programmatic) {
      const synth = synthesizeProgrammaticHubWithoutSiblings(programmatic, locationSlug);
      if (synth) {
        push({ href: synth.href, label: synth.heading, description: synth.description });
      }
    }
  }

  push(STATIC_HUB_LOOKUP[`/boats/make/${makeSlug}`]);

  if (isCatamaran) {
    push(STATIC_HUB_LOOKUP["/catamarans-for-sale"]);
  } else {
    push(STATIC_HUB_LOOKUP["/sailboats-for-sale"]);
  }

  if (locationSlug === "puerto-rico") {
    push(STATIC_HUB_LOOKUP["/boats/location/puerto-rico"]);
    push(STATIC_HUB_LOOKUP["/boats/location/caribbean"]);
  } else if (locationSlug === "bahamas") {
    push(STATIC_HUB_LOOKUP["/boats/location/bahamas"]);
    push(STATIC_HUB_LOOKUP["/boats/location/caribbean"]);
  } else if (locationSlug === "florida") {
    push(STATIC_HUB_LOOKUP["/boats/location/florida"]);
  } else if (locationSlug === "caribbean") {
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
