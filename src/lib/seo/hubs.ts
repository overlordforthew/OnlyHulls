import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicAppUrl } from "@/lib/config/urls";
import { getSeoHubBoatCount, getSeoHubBoats, type BoatRow } from "@/lib/db/queries";
import { buildSeoHubLinks, type SeoHubLink } from "@/lib/seo/hub-links";

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

const CARIBBEAN_PATTERNS = [
  "%caribbean%",
  "%bahamas%",
  "%puerto rico%",
  "%virgin islands%",
  "%bvi%",
  "%tortola%",
  "%grenada%",
  "%antigua%",
  "%st martin%",
  "%saint martin%",
  "%st. maarten%",
  "%martinique%",
  "%st thomas%",
  "%saint thomas%",
  "%trinidad%",
  "%barbados%",
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

function buildCaribbeanWhereSql(paramOffset = 0) {
  const clauses = CARIBBEAN_PATTERNS.map(
    (_, index) => `LOWER(COALESCE(b.location_text, '')) LIKE $${paramOffset + index + 1}`
  );
  return `(${clauses.join(" OR ")})`;
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
    queryWhere: "LOWER(COALESCE(b.location_text, '')) LIKE $1",
    queryParams: ["%florida%"],
    countLabel: "live Florida listings",
    relatedLinks: buildSeoHubLinks("/boats/location/florida"),
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
    queryWhere: buildCaribbeanWhereSql(),
    queryParams: CARIBBEAN_PATTERNS,
    countLabel: "live Caribbean listings",
    relatedLinks: buildSeoHubLinks("/boats/location/caribbean"),
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
    queryWhere: "LOWER(COALESCE(b.location_text, '')) LIKE $1",
    queryParams: ["%puerto rico%"],
    countLabel: "live Puerto Rico listings",
    relatedLinks: buildSeoHubLinks("/boats/location/puerto-rico"),
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
    queryWhere: "LOWER(COALESCE(b.location_text, '')) LIKE $1",
    queryParams: ["%bahamas%"],
    countLabel: "live Bahamas listings",
    relatedLinks: buildSeoHubLinks("/boats/location/bahamas"),
  },
};

export async function getSeoHubData(hub: SeoHubDefinition) {
  const [boats, total] = await Promise.all([
    getSeoHubBoats(hub.queryWhere, hub.queryParams || []),
    getSeoHubBoatCount(hub.queryWhere, hub.queryParams || []),
  ]);

  return { boats, total };
}

export function buildSeoHubMetadata(hub: SeoHubDefinition): Metadata {
  const appUrl = getPublicAppUrl();
  const canonical = `${appUrl}${hub.href}`;

  return {
    title: hub.title,
    description: hub.description,
    metadataBase: new URL(appUrl),
    alternates: {
      canonical,
    },
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
