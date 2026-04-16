export interface BoatDetailCopy {
  metadata: {
    boatNotFoundTitle: string;
    titleWithLocation: (boatTitle: string, location: string) => string;
    titleWithoutLocation: (boatTitle: string) => string;
    summaryDescription: (boatTitle: string, location: string | null, summary: string) => string;
    defaultDescription: (boatTitle: string, location: string | null, price: string) => string;
    keywordBoatForSale: string;
    sellerFallback: string;
    homeBreadcrumb: string;
    browseBreadcrumb: string;
    schemaCategory: string;
  };
  backToBrowse: string;
  previewPending: string;
  previewInactive: string;
  sampleListing: string;
  listingDescription: string;
  whyThisBoatHeading: string;
  whyThisBoatDescription: string;
  specifications: string;
  specLabels: {
    loa: string;
    beam: string;
    draft: string;
    boatType: string;
    rigType: string;
    hull: string;
    engine: string;
    cabins: string;
    berths: string;
    heads: string;
    displacement: string;
    keel: string;
    fuel: string;
  };
  character: string;
  sellerFallback: string;
  freeToMessage: string;
  whatHappensNext: string;
  contactSteps: {
    imported: (source: string) => string[];
    direct: string[];
  };
  listingTrust: string;
  trust: {
    source: string;
    photos: string;
    video: string;
    locationConfidence: string;
    externalListingFallback: string;
    importedSource: (source: string) => string;
    exclusiveOnlyHulls: string;
    images: (count: number) => string;
    clips: (count: number) => string;
    noneAttached: string;
    specificLocationProvided: string;
    locationStillBeingVerified: string;
    viewOriginalSourceListing: string;
  };
  sellerSubtitles: {
    originalListing: string;
    featuredSeller: string;
    exclusiveOnlyHulls: string;
  };
  keepComparingEyebrow: string;
  similarBoatsHeading: string;
  similarBoatsDescription: string;
  keepBrowsingMarketTitle: string;
  keepBrowsingMarketSubtitle: string;
  conditionLabel: (score: number) => string;
}

function isSpanishLocale(locale: string) {
  return locale.toLowerCase().startsWith("es");
}

function pluralize(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

const EN_BOAT_DETAIL_COPY: BoatDetailCopy = {
  metadata: {
    boatNotFoundTitle: "Boat Not Found",
    titleWithLocation: (boatTitle, location) => `${boatTitle} for sale in ${location}`,
    titleWithoutLocation: (boatTitle) => `${boatTitle} for sale`,
    summaryDescription: (boatTitle, location, summary) =>
      `${boatTitle} for sale${location ? ` in ${location}` : ""}. ${summary}`,
    defaultDescription: (boatTitle, location, price) =>
      `${boatTitle} boat for sale${location ? ` in ${location}` : ""} on OnlyHulls. View price, photos, specs, and seller contact details. Listed at ${price}.`,
    keywordBoatForSale: "boat for sale",
    sellerFallback: "OnlyHulls Seller",
    homeBreadcrumb: "OnlyHulls",
    browseBreadcrumb: "Browse Boats",
    schemaCategory: "Boat",
  },
  backToBrowse: "Back to Browse",
  previewPending:
    "Preview mode: this listing is pending review and is only visible to the seller and admins.",
  previewInactive: "Preview mode: this listing is not live to buyers right now.",
  sampleListing: "This is a sample listing for demonstration purposes.",
  listingDescription: "Listing Description",
  whyThisBoatHeading: "Why this listing deserves a closer look",
  whyThisBoatDescription:
    "A fast read on the setup, market context, and best next comparison move.",
  specifications: "Specifications",
  specLabels: {
    loa: "LOA",
    beam: "Beam",
    draft: "Draft",
    boatType: "Boat Type",
    rigType: "Rig Type",
    hull: "Hull",
    engine: "Engine",
    cabins: "Cabins",
    berths: "Berths",
    heads: "Heads",
    displacement: "Displacement",
    keel: "Keel",
    fuel: "Fuel",
  },
  character: "Character",
  sellerFallback: "Seller",
  freeToMessage: "Free to message sellers.",
  whatHappensNext: "What happens next",
  contactSteps: {
    imported: (source) => [
      "We keep this boat in your browsing flow so you can return and compare later.",
      `You will review the original ${source} listing in a new tab before reaching out.`,
      "You still avoid broker commission from OnlyHulls itself.",
    ],
    direct: [
      "Your request goes directly toward the seller of this listing.",
      "OnlyHulls does not add broker commission to the introduction.",
      "You can come back to this listing later because your interest stays attached to your account.",
    ],
  },
  listingTrust: "Listing trust",
  trust: {
    source: "Source",
    photos: "Photos",
    video: "Video",
    locationConfidence: "Location confidence",
    externalListingFallback: "External Listing",
    importedSource: (source) => `Imported from ${source}`,
    exclusiveOnlyHulls: "Exclusive to OnlyHulls",
    images: (count) => pluralize(count, "image", "images"),
    clips: (count) => pluralize(count, "clip", "clips"),
    noneAttached: "None attached",
    specificLocationProvided: "Specific location provided",
    locationStillBeingVerified: "Location still being verified",
    viewOriginalSourceListing: "View original source listing",
  },
  sellerSubtitles: {
    originalListing: "Original Listing",
    featuredSeller: "Featured Seller",
    exclusiveOnlyHulls: "Exclusive to OnlyHulls",
  },
  keepComparingEyebrow: "Keep Comparing",
  similarBoatsHeading: "Similar boats to consider",
  similarBoatsDescription:
    "These listings line up with this boat on make, location, or buyer-intent tags so you can compare the market without restarting your search.",
  keepBrowsingMarketTitle: "Keep browsing this market",
  keepBrowsingMarketSubtitle:
    "Jump into the strongest make, region, and boat-type hubs connected to this listing.",
  conditionLabel: (score) => `Condition: ${score}/10`,
};

const ES_BOAT_DETAIL_COPY: BoatDetailCopy = {
  metadata: {
    boatNotFoundTitle: "Barco no encontrado",
    titleWithLocation: (boatTitle, location) => `${boatTitle} en venta en ${location}`,
    titleWithoutLocation: (boatTitle) => `${boatTitle} en venta`,
    summaryDescription: (boatTitle, location, summary) =>
      `${boatTitle} en venta${location ? ` en ${location}` : ""}. ${summary}`,
    defaultDescription: (boatTitle, location, price) =>
      `${boatTitle} en venta${location ? ` en ${location}` : ""} en OnlyHulls. Consulta precio, fotos, especificaciones y datos de contacto del vendedor. Publicado en ${price}.`,
    keywordBoatForSale: "barco en venta",
    sellerFallback: "Vendedor de OnlyHulls",
    homeBreadcrumb: "OnlyHulls",
    browseBreadcrumb: "Explorar barcos",
    schemaCategory: "Barco",
  },
  backToBrowse: "Volver a explorar",
  previewPending:
    "Modo vista previa: este anuncio está pendiente de revisión y solo es visible para el vendedor y los administradores.",
  previewInactive: "Modo vista previa: este anuncio no está activo para compradores en este momento.",
  sampleListing: "Este es un anuncio de ejemplo con fines de demostración.",
  listingDescription: "Descripción del anuncio",
  whyThisBoatHeading: "Por qué este anuncio merece una mirada más cercana",
  whyThisBoatDescription:
    "Una lectura rápida del barco, del mercado y del siguiente paso más útil para compararlo.",
  specifications: "Especificaciones",
  specLabels: {
    loa: "Eslora",
    beam: "Manga",
    draft: "Calado",
    boatType: "Tipo de barco",
    rigType: "Tipo de aparejo",
    hull: "Casco",
    engine: "Motor",
    cabins: "Camarotes",
    berths: "Literas",
    heads: "Baños",
    displacement: "Desplazamiento",
    keel: "Quilla",
    fuel: "Combustible",
  },
  character: "Carácter",
  sellerFallback: "Vendedor",
  freeToMessage: "Es gratis escribir a los vendedores.",
  whatHappensNext: "Qué pasa después",
  contactSteps: {
    imported: (source) => [
      "Mantenemos este barco dentro de tu flujo de navegación para que puedas volver y compararlo más tarde.",
      `Revisarás el anuncio original de ${source} en una nueva pestaña antes de contactar.`,
      "Aun así evitas pagar comisión de broker a OnlyHulls.",
    ],
    direct: [
      "Tu solicitud va directamente al vendedor de este anuncio.",
      "OnlyHulls no añade comisión de broker a la presentación.",
      "Puedes volver a este anuncio más tarde porque tu interés queda asociado a tu cuenta.",
    ],
  },
  listingTrust: "Confianza del anuncio",
  trust: {
    source: "Origen",
    photos: "Fotos",
    video: "Video",
    locationConfidence: "Confianza en la ubicación",
    externalListingFallback: "Anuncio externo",
    importedSource: (source) => `Importado desde ${source}`,
    exclusiveOnlyHulls: "Exclusivo de OnlyHulls",
    images: (count) => pluralize(count, "imagen", "imágenes"),
    clips: (count) => pluralize(count, "clip", "clips"),
    noneAttached: "Ninguno adjunto",
    specificLocationProvided: "Ubicación específica disponible",
    locationStillBeingVerified: "La ubicación todavía se está verificando",
    viewOriginalSourceListing: "Ver anuncio original",
  },
  sellerSubtitles: {
    originalListing: "Anuncio original",
    featuredSeller: "Vendedor destacado",
    exclusiveOnlyHulls: "Exclusivo de OnlyHulls",
  },
  keepComparingEyebrow: "Sigue comparando",
  similarBoatsHeading: "Barcos similares para considerar",
  similarBoatsDescription:
    "Estos anuncios se alinean con este barco por marca, ubicación o etiquetas de intención del comprador para que puedas comparar el mercado sin reiniciar tu búsqueda.",
  keepBrowsingMarketTitle: "Sigue explorando este mercado",
  keepBrowsingMarketSubtitle:
    "Entra en los hubs más fuertes por marca, región y tipo de barco conectados con este anuncio.",
  conditionLabel: (score) => `Estado: ${score}/10`,
};

export function getBoatDetailCopy(locale: string) {
  return isSpanishLocale(locale) ? ES_BOAT_DETAIL_COPY : EN_BOAT_DETAIL_COPY;
}
