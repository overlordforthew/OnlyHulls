import type { SeoHubLink } from "@/lib/seo/hub-links";
import { synthesizeProgrammaticHubCopyForLocale, type SeoHubDefinition } from "@/lib/seo/hubs";

export interface SeoHubPageCopy {
  browseAllBoats: string;
  getAiMatched: string;
  liveListings: (count: number) => string;
  showingHubSubset: (shown: number, total: number) => string;
  seeAllListings: (count: number) => string;
  noBoatsTitle: string;
  noBoatsDescription: string;
  broaderSearchHeading: string;
  broaderSearchDescription: string;
  whyPageMattersHeading: string;
  whyPageMattersDescription: string;
  relatedBoatSearches: string;
  links: Record<string, { label: string; description: string }>;
  hubs: Record<
    string,
    {
      title: string;
      heading: string;
      description: string;
      intro: string;
      eyebrow: string;
    }
  >;
}

function isSpanishLocale(locale: string) {
  return locale.toLowerCase().startsWith("es");
}

function pluralize(count: number, singular: string, plural: string) {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

const EN_SEO_COPY: SeoHubPageCopy = {
  browseAllBoats: "Browse all boats",
  getAiMatched: "Get AI matched",
  liveListings: (count) => pluralize(count, "live listing", "live listings"),
  showingHubSubset: (shown, total) =>
    `Showing ${shown.toLocaleString()} of ${total.toLocaleString()} live listings on this hub.`,
  seeAllListings: (count) => `See all ${count.toLocaleString()} in browse`,
  noBoatsTitle: "No boats are live on this hub yet",
  noBoatsDescription:
    "The page is ready, but the current catalog does not have enough clean live listings here yet.",
  broaderSearchHeading: "Need a broader search?",
  broaderSearchDescription:
    "This hub is live but still narrow. If you want more options right now, open a wider browse page or let the matcher fan out to nearby markets.",
  whyPageMattersHeading: "Why this page matters",
  whyPageMattersDescription:
    "OnlyHulls uses hub pages like this to keep strong inventory clusters in one crawlable place. Buyers can browse cleaner listings faster, and search engines get a stable URL with real market intent instead of a temporary filtered query string.",
  relatedBoatSearches: "Related boat searches",
  links: {
    "/catamarans-for-sale": {
      label: "Catamarans for Sale",
      description: "Browse multihulls and cruising cats with real inventory.",
    },
    "/sailboats-for-sale": {
      label: "Sailboats for Sale",
      description: "Explore monohulls and sailing boats that fit real buyer intent.",
    },
    "/boats/make/lagoon": {
      label: "Lagoon Boats",
      description: "High-intent Lagoon searches with cleaner listings and strong inventory depth.",
    },
    "/boats/make/leopard": {
      label: "Leopard Boats",
      description: "Leopard catamarans and related liveaboard-friendly listings.",
    },
    "/boats/make/bali": {
      label: "Bali Boats",
      description: "Browse Bali catamarans in a dedicated make hub with cleaner listings.",
    },
    "/boats/make/catana": {
      label: "Catana Boats",
      description: "High-intent Catana inventory for bluewater buyers and catamaran searches.",
    },
    "/boats/location/florida": {
      label: "Florida Boats",
      description: "A high-volume regional page with direct inventory in Florida.",
    },
    "/boats/location/caribbean": {
      label: "Caribbean Boats",
      description: "Listings centered on Caribbean cruising and island-based inventory.",
    },
    "/boats/location/puerto-rico": {
      label: "Puerto Rico Boats",
      description: "Island-based inventory in Puerto Rico with stronger local search intent.",
    },
    "/boats/location/bahamas": {
      label: "Bahamas Boats",
      description: "Cruising and island inventory centered on the Bahamas market.",
    },
  },
  hubs: {
    "/catamarans-for-sale": {
      title: "Catamarans for Sale",
      heading: "Catamarans for Sale",
      description:
        "Browse catamarans for sale on OnlyHulls with cleaner data, better photos, and direct seller connections.",
      intro:
        "Explore catamarans for sale with cleaner listing data, stronger location coverage, and direct paths to sellers or source listings.",
      eyebrow: "Popular Catamaran Market",
    },
    "/sailboats-for-sale": {
      title: "Sailboats for Sale",
      heading: "Sailboats for Sale",
      description:
        "Browse sailboats for sale on OnlyHulls with direct seller access, cleaner inventory, and AI-assisted discovery.",
      intro:
        "This page focuses on sailboats and monohull-style listings with useful rig data and cleaner buyer-facing inventory.",
      eyebrow: "Popular Sailboat Market",
    },
    "/boats/make/lagoon": {
      title: "Lagoon Boats for Sale",
      heading: "Lagoon Boats for Sale",
      description:
        "Browse Lagoon boats for sale on OnlyHulls, including catamarans and owner-focused listings with stronger metadata.",
      intro:
        "Lagoon is one of the most searched multihull brands in the market. This page keeps the active Lagoon inventory in one indexable place.",
      eyebrow: "Popular Make",
    },
    "/boats/make/leopard": {
      title: "Leopard Boats for Sale",
      heading: "Leopard Boats for Sale",
      description:
        "Browse Leopard boats for sale on OnlyHulls with cleaner location data and direct paths to seller or broker listings.",
      intro:
        "Leopard remains one of the strongest liveaboard and charter-driven catamaran searches, so it deserves its own crawlable hub.",
      eyebrow: "Popular Make",
    },
    "/boats/make/bali": {
      title: "Bali Boats for Sale",
      heading: "Bali Boats for Sale",
      description:
        "Browse Bali boats for sale on OnlyHulls with cleaner inventory, direct listing paths, and better buyer-facing data.",
      intro:
        "Bali is one of the strongest modern catamaran brands in buyer searches, so it gets its own crawlable make hub here.",
      eyebrow: "Popular Make",
    },
    "/boats/make/catana": {
      title: "Catana Boats for Sale",
      heading: "Catana Boats for Sale",
      description:
        "Browse Catana boats for sale on OnlyHulls with stronger location coverage and cleaner buyer-facing inventory.",
      intro:
        "Catana attracts serious bluewater catamaran buyers, so this hub keeps that inventory in one high-intent make page.",
      eyebrow: "Popular Make",
    },
    "/boats/location/florida": {
      title: "Boats for Sale in Florida",
      heading: "Boats for Sale in Florida",
      description:
        "Browse boats for sale in Florida on OnlyHulls, including catamarans and sailboats with stronger location coverage and direct contact paths.",
      intro:
        "Florida is one of the deepest regional markets in the current catalog, so this page captures a strong local-intent search pattern.",
      eyebrow: "Top Boat Market",
    },
    "/boats/location/caribbean": {
      title: "Boats for Sale in the Caribbean",
      heading: "Boats for Sale in the Caribbean",
      description:
        "Browse boats for sale in the Caribbean on OnlyHulls, from island-based catamarans to cruising boats with better location signals.",
      intro:
        "The Caribbean hub groups high-intent island markets like Puerto Rico, the Bahamas, Tortola, and the Virgin Islands into one rankable page.",
      eyebrow: "Cruising Region",
    },
    "/boats/location/puerto-rico": {
      title: "Boats for Sale in Puerto Rico",
      heading: "Boats for Sale in Puerto Rico",
      description:
        "Browse boats for sale in Puerto Rico on OnlyHulls with stronger local intent, better photos, and direct seller paths.",
      intro:
        "Puerto Rico is a strong Caribbean search market with recurring island inventory, so it deserves a dedicated local landing page.",
      eyebrow: "Island Market",
    },
    "/boats/location/bahamas": {
      title: "Boats for Sale in the Bahamas",
      heading: "Boats for Sale in the Bahamas",
      description:
        "Browse boats for sale in the Bahamas on OnlyHulls, from island-based catamarans to cruising boats with cleaner location data.",
      intro:
        "The Bahamas is one of the clearest Caribbean cruising search patterns, so this page gives it a stable, rankable regional hub.",
      eyebrow: "Island Market",
    },
  },
};

const ES_SEO_COPY: SeoHubPageCopy = {
  browseAllBoats: "Explorar todos los barcos",
  getAiMatched: "Recibir match con IA",
  liveListings: (count) => pluralize(count, "anuncio activo", "anuncios activos"),
  showingHubSubset: (shown, total) =>
    `Mostrando ${shown.toLocaleString()} de ${total.toLocaleString()} anuncios activos en este hub.`,
  seeAllListings: (count) => `Ver los ${count.toLocaleString()} en la exploración`,
  noBoatsTitle: "Todavía no hay barcos activos en este hub",
  noBoatsDescription:
    "La página ya está lista, pero el catálogo actual todavía no tiene suficientes anuncios activos y limpios aquí.",
  broaderSearchHeading: "¿Necesitas una búsqueda más amplia?",
  broaderSearchDescription:
    "Este hub ya está activo, pero sigue siendo estrecho. Si quieres más opciones ahora mismo, abre una página de exploración más amplia o deja que el matcher se expanda a mercados cercanos.",
  whyPageMattersHeading: "Por qué importa esta página",
  whyPageMattersDescription:
    "OnlyHulls usa páginas hub como esta para mantener grupos fuertes de inventario en un solo lugar rastreable. Los compradores navegan anuncios más limpios más rápido, y los buscadores reciben una URL estable con intención de mercado real en lugar de una cadena de filtros temporal.",
  relatedBoatSearches: "Búsquedas relacionadas de barcos",
  links: {
    "/catamarans-for-sale": {
      label: "Catamaranes en venta",
      description: "Explora multicascos y catamaranes de crucero con inventario real.",
    },
    "/sailboats-for-sale": {
      label: "Veleros en venta",
      description: "Explora monocascos y veleros que encajan con intención de compra real.",
    },
    "/boats/make/lagoon": {
      label: "Barcos Lagoon",
      description: "Búsquedas de alta intención para Lagoon con anuncios más limpios y buen volumen de inventario.",
    },
    "/boats/make/leopard": {
      label: "Barcos Leopard",
      description: "Catamaranes Leopard y anuncios relacionados ideales para vida a bordo.",
    },
    "/boats/make/bali": {
      label: "Barcos Bali",
      description: "Explora catamaranes Bali en un hub dedicado por marca con anuncios más limpios.",
    },
    "/boats/make/catana": {
      label: "Barcos Catana",
      description: "Inventario Catana de alta intención para compradores bluewater y búsquedas de catamaranes.",
    },
    "/boats/location/florida": {
      label: "Barcos en Florida",
      description: "Una página regional de alto volumen con inventario directo en Florida.",
    },
    "/boats/location/caribbean": {
      label: "Barcos en el Caribe",
      description: "Anuncios centrados en el crucero caribeño y en inventario basado en islas.",
    },
    "/boats/location/puerto-rico": {
      label: "Barcos en Puerto Rico",
      description: "Inventario en Puerto Rico con una intención de búsqueda local más fuerte.",
    },
    "/boats/location/bahamas": {
      label: "Barcos en Bahamas",
      description: "Inventario de crucero e islas centrado en el mercado de Bahamas.",
    },
  },
  hubs: {
    "/catamarans-for-sale": {
      title: "Catamaranes en venta",
      heading: "Catamaranes en venta",
      description:
        "Explora catamaranes en venta en OnlyHulls con datos más limpios, mejores fotos y contacto directo con vendedores.",
      intro:
        "Explora catamaranes en venta con datos de anuncios más limpios, mejor cobertura de ubicación y caminos directos hacia vendedores o anuncios de origen.",
      eyebrow: "Mercado popular de catamaranes",
    },
    "/sailboats-for-sale": {
      title: "Veleros en venta",
      heading: "Veleros en venta",
      description:
        "Explora veleros en venta en OnlyHulls con acceso directo a vendedores, inventario más limpio y descubrimiento asistido por IA.",
      intro:
        "Esta página se centra en veleros y anuncios tipo monocasco con datos útiles de aparejo e inventario más limpio para compradores.",
      eyebrow: "Mercado popular de veleros",
    },
    "/boats/make/lagoon": {
      title: "Barcos Lagoon en venta",
      heading: "Barcos Lagoon en venta",
      description:
        "Explora barcos Lagoon en venta en OnlyHulls, incluidos catamaranes y anuncios de propietarios con mejor metadata.",
      intro:
        "Lagoon es una de las marcas multicasco más buscadas del mercado. Esta página mantiene el inventario activo de Lagoon en un solo lugar indexable.",
      eyebrow: "Marca popular",
    },
    "/boats/make/leopard": {
      title: "Barcos Leopard en venta",
      heading: "Barcos Leopard en venta",
      description:
        "Explora barcos Leopard en venta en OnlyHulls con datos de ubicación más limpios y rutas directas hacia vendedores o brokers.",
      intro:
        "Leopard sigue siendo una de las búsquedas más fuertes para catamaranes liveaboard y de charter, así que merece su propio hub rastreable.",
      eyebrow: "Marca popular",
    },
    "/boats/make/bali": {
      title: "Barcos Bali en venta",
      heading: "Barcos Bali en venta",
      description:
        "Explora barcos Bali en venta en OnlyHulls con inventario más limpio, rutas directas de anuncio y mejores datos para compradores.",
      intro:
        "Bali es una de las marcas modernas de catamaranes más fuertes en búsquedas de compradores, así que aquí tiene su propio hub por marca.",
      eyebrow: "Marca popular",
    },
    "/boats/make/catana": {
      title: "Barcos Catana en venta",
      heading: "Barcos Catana en venta",
      description:
        "Explora barcos Catana en venta en OnlyHulls con mejor cobertura de ubicación e inventario más limpio para compradores.",
      intro:
        "Catana atrae a compradores serios de catamaranes bluewater, así que este hub mantiene ese inventario en una sola página de alta intención.",
      eyebrow: "Marca popular",
    },
    "/boats/location/florida": {
      title: "Barcos en venta en Florida",
      heading: "Barcos en venta en Florida",
      description:
        "Explora barcos en venta en Florida en OnlyHulls, incluidos catamaranes y veleros con mejor cobertura de ubicación y contacto directo.",
      intro:
        "Florida es uno de los mercados regionales más profundos del catálogo actual, así que esta página captura una intención local fuerte.",
      eyebrow: "Mercado náutico principal",
    },
    "/boats/location/caribbean": {
      title: "Barcos en venta en el Caribe",
      heading: "Barcos en venta en el Caribe",
      description:
        "Explora barcos en venta en el Caribe en OnlyHulls, desde catamaranes en islas hasta barcos de crucero con mejores señales de ubicación.",
      intro:
        "El hub del Caribe agrupa mercados insulares de alta intención como Puerto Rico, Bahamas, Tortola y las Islas Vírgenes en una sola página posicionable.",
      eyebrow: "Región de crucero",
    },
    "/boats/location/puerto-rico": {
      title: "Barcos en venta en Puerto Rico",
      heading: "Barcos en venta en Puerto Rico",
      description:
        "Explora barcos en venta en Puerto Rico en OnlyHulls con mayor intención local, mejores fotos y rutas directas hacia vendedores.",
      intro:
        "Puerto Rico es un mercado fuerte de búsqueda caribeña con inventario recurrente en la isla, así que merece una landing local dedicada.",
      eyebrow: "Mercado insular",
    },
    "/boats/location/bahamas": {
      title: "Barcos en venta en Bahamas",
      heading: "Barcos en venta en Bahamas",
      description:
        "Explora barcos en venta en Bahamas en OnlyHulls, desde catamaranes basados en islas hasta barcos de crucero con datos de ubicación más limpios.",
      intro:
        "Bahamas es uno de los patrones de búsqueda caribeña de crucero más claros, así que esta página le da un hub regional estable y posicionable.",
      eyebrow: "Mercado insular",
    },
  },
};

export function getSeoHubPageCopy(locale: string) {
  return isSpanishLocale(locale) ? ES_SEO_COPY : EN_SEO_COPY;
}

export function localizeSeoHubLink(locale: string, link: SeoHubLink): SeoHubLink {
  const copy = getSeoHubPageCopy(locale);
  const translated = copy.links[link.href];

  if (translated) {
    return { ...link, label: translated.label, description: translated.description };
  }

  // Programmatic hubs aren't in the static links map — synthesize the
  // locale-specific label/description so /es panels don't leak EN text.
  const programmatic = synthesizeProgrammaticHubCopyForLocale(link.href, locale);
  if (programmatic) {
    return { ...link, label: programmatic.heading, description: programmatic.description };
  }

  return link;
}

export function localizeSeoHubDefinition(
  locale: string,
  hub: SeoHubDefinition
): SeoHubDefinition {
  const copy = getSeoHubPageCopy(locale);
  const translated = copy.hubs[hub.href];

  if (translated) {
    return {
      ...hub,
      title: translated.title,
      heading: translated.heading,
      description: translated.description,
      intro: translated.intro,
      eyebrow: translated.eyebrow,
    };
  }

  // Programmatic hubs live under a dynamic route and aren't keyed in the
  // static hubs map. Re-synthesize their copy in the target locale so /es
  // variants serve Spanish text instead of the EN-fallback they got before.
  const programmatic = synthesizeProgrammaticHubCopyForLocale(hub.href, locale);
  if (programmatic) {
    return { ...hub, ...programmatic };
  }

  return hub;
}
