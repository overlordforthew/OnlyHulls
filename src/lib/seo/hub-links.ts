export interface SeoHubLink {
  href: string;
  label: string;
  description: string;
}

export const STATIC_SEO_HUB_LINKS: SeoHubLink[] = [
  {
    href: "/catamarans-for-sale",
    label: "Catamarans for Sale",
    description: "Browse multihulls and cruising cats with real inventory.",
  },
  {
    href: "/sailboats-for-sale",
    label: "Sailboats for Sale",
    description: "Explore monohulls and sailing boats that fit real buyer intent.",
  },
  {
    href: "/boats/make/lagoon",
    label: "Lagoon Boats",
    description: "High-intent Lagoon searches with cleaner listings and strong inventory depth.",
  },
  {
    href: "/boats/make/leopard",
    label: "Leopard Boats",
    description: "Leopard catamarans and related liveaboard-friendly listings.",
  },
  {
    href: "/boats/location/florida",
    label: "Florida Boats",
    description: "A high-volume regional page with direct inventory in Florida.",
  },
  {
    href: "/boats/location/caribbean",
    label: "Caribbean Boats",
    description: "Listings centered on Caribbean cruising and island-based inventory.",
  },
];

export function buildSeoHubLinks(currentHref: string): SeoHubLink[] {
  return STATIC_SEO_HUB_LINKS.filter((link) => link.href !== currentHref);
}
