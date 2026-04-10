import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicAppUrl } from "@/lib/config/urls";
import { getSeoHubBoatCount, getSeoHubBoats, type BoatRow } from "@/lib/db/queries";
import { buildSeoHubLinks, type SeoHubLink } from "@/lib/seo/hub-links";

export interface SeoHubDefinition {
  slug: string;
  href: string;
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
};

export const LOCATION_HUBS: Record<string, SeoHubDefinition> = {
  florida: {
    slug: "florida",
    href: "/boats/location/florida",
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
