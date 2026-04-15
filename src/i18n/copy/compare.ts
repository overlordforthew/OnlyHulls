export interface CompareAnalysisCopy {
  units: {
    perFoot: string;
  };
  listingPath: {
    imported: (source: string) => string;
    directFeatured: string;
    directOnlyHulls: string;
  };
  quickFactors: {
    lowestBuyIn: {
      label: string;
      onlyWinner: (price: string) => string;
      savings: (price: string, runnerUpTitle: string) => string;
    };
    pricePerFootEdge: {
      label: string;
      detail: (pricePerFoot: string) => string;
    };
    newestBuild: {
      label: string;
      onlyWinner: (year: number) => string;
      advantage: (yearDelta: number, runnerUpTitle: string) => string;
    };
    longestHull: {
      label: string;
      onlyWinner: (length: string) => string;
      advantage: (length: string, advantageFeet: string, runnerUpTitle: string) => string;
    };
    shallowerDraft: {
      label: string;
      onlyWinner: (draft: string) => string;
      advantage: (draft: string, marginFeet: string, runnerUpTitle: string) => string;
    };
    accommodationEdge: {
      label: string;
      detail: (parts: string[]) => string;
      cabins: (count: string) => string;
      berths: (count: string) => string;
      heads: (count: string) => string;
    };
  };
  actionRecommendation: {
    directPath: string;
    importedPath: string;
    condition: (score: number) => string;
    images: (count: number) => string;
    specificLocationShown: string;
    detail: (reasons: string) => string;
  };
  insights: {
    lowestBuyIn: string;
    highestAskingPrice: string;
    lowerPricePerFoot: string;
    higherPricePerFoot: string;
    newestBuildYear: string;
    oldestBuildYear: string;
    longerLoa: string;
    smallerFootprint: string;
    shallowerDraft: string;
    deeperDraft: string;
    strongerAccommodation: string;
    lighterAccommodation: string;
    betterConditionSignal: string;
    weakerConditionSignal: string;
    directListing: string;
    importedListing: string;
    locationRefining: string;
    thinSpecs: string;
  };
  bestFit: {
    bluewater: {
      label: string;
      lengthReason: (length: string) => string;
      tagReason: string;
    };
    liveaboard: {
      label: string;
      cabinsReason: (cabins: string, heads: string) => string;
      tagReason: string;
    };
    shallowWater: {
      label: string;
      reason: (draft: string) => string;
    };
    familyCrew: {
      label: string;
      berthsReason: (berths: string) => string;
      tagReason: string;
    };
    fastFirstContact: {
      label: string;
      reason: string;
    };
    valueFirst: {
      label: string;
      reason: string;
    };
  };
}

export interface ComparePageCopy {
  badge: string;
  heading: string;
  subtitle: (maxCompareBoats: number) => string;
  loadError: string;
  shareButtonCopied: string;
  shareButtonDefault: string;
  clearCompare: string;
  shareStatusCopied: string;
  shareStatusError: string;
  shareStatusDefault: string;
  loading: string;
  missingSelected: (count: number) => string;
  addOneMore: string;
  factorHeading: string;
  factorDescription: string;
  addMoreBoats: string;
  locationBeingRefined: string;
  conditionNotScored: string;
  photosOnFile: (count: number) => string;
  photoCountSyncing: string;
  notTaggedYet: string;
  sections: {
    money: {
      title: string;
      subtitle: string;
      askingPrice: string;
      pricePerFoot: string;
      pricePerFootHelper: string;
      modelYear: string;
      approximateAge: string;
      approximateAgeValue: (years: number) => string;
    };
    boatHandling: {
      title: string;
      subtitle: string;
      lengthOverall: string;
      beam: string;
      draft: string;
      boatType: string;
      rigType: string;
      hullMaterial: string;
      keel: string;
    };
    liveability: {
      title: string;
      subtitle: string;
      cabins: string;
      berths: string;
      heads: string;
      engine: string;
      fuel: string;
      displacement: string;
    };
    listingContext: {
      title: string;
      subtitle: string;
      location: string;
      listingPath: string;
      conditionSignal: string;
      photosOnFile: string;
      characterTags: string;
    };
  };
  quickRead: {
    badge: string;
    heading: string;
    description: string;
    empty: string;
    footnote: string;
    suggestedFirstMove: string;
  };
  fallback: {
    loadingCompareSet: string;
    preparingWorkspace: string;
  };
  mobile: {
    recommendationSummary: (winnerTitle: string) => string;
    quickFactorSummary: (label: string, winnerTitle: string) => string;
    readySummary: (count: number) => string;
    loaded: (count: number) => string;
    jumpToFactors: string;
    swipeHint: string;
  };
  metrics: {
    ask: string;
    pricePerFoot: string;
    length: string;
    draft: string;
  };
  conditionBadge: (score: number) => string;
  photoUnavailable: string;
  bestFor: string;
  whyItStandsOut: string;
  watchouts: string;
  noStrongSeparator: string;
  openListing: string;
  originalSource: string;
  removeFromCompare: (title: string) => string;
  emptyState: {
    title: string;
    description: string;
    cta: string;
  };
  analysis: CompareAnalysisCopy;
}

function isSpanishLocale(locale: string) {
  return locale.toLowerCase().startsWith("es");
}

function pluralize(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

const EN_COMPARE_COPY: ComparePageCopy = {
  badge: "Compare Boats",
  heading: "Side-by-side boat comparison",
  subtitle: (maxCompareBoats) =>
    `Compare up to ${maxCompareBoats} boats on the factors that actually change a buying decision: price, size, draft, layout, and listing trust.`,
  loadError: "Unable to load the compare view right now.",
  shareButtonCopied: "Link copied",
  shareButtonDefault: "Copy compare link",
  clearCompare: "Clear compare",
  shareStatusCopied: "This shortlist link is ready to send.",
  shareStatusError: "Could not copy the compare link on this browser.",
  shareStatusDefault:
    "Copy this shortlist link to send the same compare set to a partner or your future self.",
  loading: "Loading comparison...",
  missingSelected: (count) =>
    `${pluralize(count, "selected boat", "selected boats")} could not be compared because the listing is no longer public.`,
  addOneMore:
    "Add one more boat from browse or matches so the side-by-side view can surface real tradeoffs.",
  factorHeading: "Compare factors",
  factorDescription:
    "Start with money and draft, then use the rows below to compare layout and trust.",
  addMoreBoats: "Add more boats",
  locationBeingRefined: "Location being refined",
  conditionNotScored: "Not scored yet",
  photosOnFile: (count) => pluralize(count, "image", "images"),
  photoCountSyncing: "Photo count still syncing",
  notTaggedYet: "Not tagged yet",
  sections: {
    money: {
      title: "Money",
      subtitle: "This is where budget fit and value separate fast.",
      askingPrice: "Asking price",
      pricePerFoot: "Price per foot",
      pricePerFootHelper: "Uses displayed currency and LOA when available.",
      modelYear: "Model year",
      approximateAge: "Approx. age",
      approximateAgeValue: (years) => `${years} yrs`,
    },
    boatHandling: {
      title: "Boat & handling",
      subtitle: "Hull size, beam, and draft are usually the first hard filters.",
      lengthOverall: "Length overall",
      beam: "Beam",
      draft: "Draft",
      boatType: "Boat type",
      rigType: "Rig type",
      hullMaterial: "Hull material",
      keel: "Keel",
    },
    liveability: {
      title: "Liveability & systems",
      subtitle: "Useful for deciding whether the boat fits how you will actually use it.",
      cabins: "Cabins",
      berths: "Berths",
      heads: "Heads",
      engine: "Engine",
      fuel: "Fuel",
      displacement: "Displacement",
    },
    listingContext: {
      title: "Listing context",
      subtitle:
        "These signals help a buyer judge trust, freshness, and how direct the path is.",
      location: "Location",
      listingPath: "Listing path",
      conditionSignal: "Condition signal",
      photosOnFile: "Photos on file",
      characterTags: "Character tags",
    },
  },
  quickRead: {
    badge: "Quick read",
    heading: "Where the shortlist really separates",
    description: "These are the clearest decision edges in the current compare set.",
    empty:
      "Add a couple of well-specified boats and this panel will call out the biggest differences immediately.",
    footnote:
      "Then use the matrix below for the exact numbers, layout details, and listing trust cues.",
    suggestedFirstMove: "Suggested first move",
  },
  fallback: {
    loadingCompareSet: "Loading your compare set...",
    preparingWorkspace: "Preparing the compare workspace...",
  },
  mobile: {
    recommendationSummary: (winnerTitle) => `${winnerTitle} is the cleaner first call.`,
    quickFactorSummary: (label, winnerTitle) => `${label}: ${winnerTitle}`,
    readySummary: (count) => `${pluralize(count, "boat", "boats")} ready to compare`,
    loaded: (count) => `${pluralize(count, "boat", "boats")} loaded`,
    jumpToFactors: "Jump to factors",
    swipeHint: "Swipe sideways for full columns.",
  },
  metrics: {
    ask: "Ask",
    pricePerFoot: "Price / ft",
    length: "Length",
    draft: "Draft",
  },
  conditionBadge: (score) => `Condition ${score}/10`,
  photoUnavailable: "Photo unavailable",
  bestFor: "Best for",
  whyItStandsOut: "Why it stands out",
  watchouts: "Watchouts",
  noStrongSeparator: "No strong separator surfaced yet.",
  openListing: "Open listing",
  originalSource: "Original source",
  removeFromCompare: (title) => `Remove ${title} from compare`,
  emptyState: {
    title: "No boats in compare yet",
    description:
      "Use the Compare button on browse cards or in your matches to build a shortlist worth deciding between.",
    cta: "Start browsing",
  },
  analysis: {
    units: {
      perFoot: "/ft",
    },
    listingPath: {
      imported: (source) => `Imported via ${source}`,
      directFeatured: "Direct featured listing",
      directOnlyHulls: "Direct OnlyHulls listing",
    },
    quickFactors: {
      lowestBuyIn: {
        label: "Lowest buy-in",
        onlyWinner: (price) => `${price} gets you into this compare set first.`,
        savings: (price, runnerUpTitle) => `${price} less than ${runnerUpTitle}.`,
      },
      pricePerFootEdge: {
        label: "Price per foot edge",
        detail: (pricePerFoot) => `${pricePerFoot} based on current asking price and LOA.`,
      },
      newestBuild: {
        label: "Newest build",
        onlyWinner: (year) => `${year} is the newest build in this compare set.`,
        advantage: (yearDelta, runnerUpTitle) => `${yearDelta} years newer than ${runnerUpTitle}.`,
      },
      longestHull: {
        label: "Longest hull",
        onlyWinner: (length) => `${length} overall length.`,
        advantage: (length, advantageFeet, runnerUpTitle) =>
          `${length} LOA, about ${advantageFeet}ft longer than ${runnerUpTitle}.`,
      },
      shallowerDraft: {
        label: "Shallower draft",
        onlyWinner: (draft) => `${draft} draft.`,
        advantage: (draft, marginFeet, runnerUpTitle) =>
          `${draft} draft, roughly ${marginFeet}ft shallower than ${runnerUpTitle}.`,
      },
      accommodationEdge: {
        label: "Accommodation edge",
        detail: (parts) => parts.join(" / "),
        cabins: (count) => `${count} cabins`,
        berths: (count) => `${count} berths`,
        heads: (count) => `${count} heads`,
      },
    },
    actionRecommendation: {
      directPath: "direct OnlyHulls path",
      importedPath: "cleanest imported listing path",
      condition: (score) => `condition ${score}/10`,
      images: (count) => pluralize(count, "image", "images"),
      specificLocationShown: "specific location shown",
      detail: (reasons) => `Best first call if you want the cleaner path first: ${reasons}.`,
    },
    insights: {
      lowestBuyIn: "Lowest buy-in in this compare",
      highestAskingPrice: "Highest asking price in this compare",
      lowerPricePerFoot: "Lower price per foot",
      higherPricePerFoot: "Higher price per foot",
      newestBuildYear: "Newest build year here",
      oldestBuildYear: "Oldest build year here",
      longerLoa: "Longer LOA in this shortlist",
      smallerFootprint: "Smaller overall footprint",
      shallowerDraft: "Shallower draft",
      deeperDraft: "Deeper draft to account for",
      strongerAccommodation: "Stronger accommodation layout",
      lighterAccommodation: "Lighter accommodation spec sheet",
      betterConditionSignal: "Better condition signal",
      weakerConditionSignal: "Weaker condition signal",
      directListing: "Direct listing inside OnlyHulls",
      importedListing: "Imported listing; confirm the source details before acting",
      locationRefining: "Location still being refined",
      thinSpecs: "Thin spec sheet for a clean decision",
    },
    bestFit: {
      bluewater: {
        label: "Bluewater cruising",
        lengthReason: (length) => `${length} overall length gives it a stronger offshore posture.`,
        tagReason: "Its bluewater tags make it a more natural offshore shortlist candidate.",
      },
      liveaboard: {
        label: "Liveaboard setup",
        cabinsReason: (cabins, heads) => `${cabins} and ${heads} support longer stays aboard.`,
        tagReason: "The liveaboard-ready signals point to an easier onboard setup.",
      },
      shallowWater: {
        label: "Shallow-water cruising",
        reason: (draft) => `${draft} draft opens up thinner anchorages and coastal routes.`,
      },
      familyCrew: {
        label: "Family crew",
        berthsReason: (berths) => `${berths} give a family or guest crew more sleeping flexibility.`,
        tagReason: "Family-friendly signals suggest an easier cruising setup with guests aboard.",
      },
      fastFirstContact: {
        label: "Fast first contact",
        reason:
          "Direct listing, strong condition signal, and healthy photo depth make this easier to act on.",
      },
      valueFirst: {
        label: "Value-first shortlist",
        reason: "The current price per foot keeps this one in the stronger value conversation.",
      },
    },
  },
};

const ES_COMPARE_COPY: ComparePageCopy = {
  badge: "Comparar barcos",
  heading: "Comparación de barcos lado a lado",
  subtitle: (maxCompareBoats) =>
    `Compara hasta ${maxCompareBoats} barcos en los factores que realmente cambian una decisión de compra: precio, tamaño, calado, distribución y confianza del anuncio.`,
  loadError: "No se pudo cargar la comparación ahora mismo.",
  shareButtonCopied: "Enlace copiado",
  shareButtonDefault: "Copiar enlace",
  clearCompare: "Limpiar comparación",
  shareStatusCopied: "Este enlace de shortlist ya está listo para compartir.",
  shareStatusError: "No se pudo copiar el enlace de comparación en este navegador.",
  shareStatusDefault:
    "Copia este enlace de shortlist para enviar el mismo grupo de comparación a otra persona o guardarlo para después.",
  loading: "Cargando comparación...",
  missingSelected: (count) =>
    `${pluralize(count, "barco seleccionado", "barcos seleccionados")} no se pudo comparar porque el anuncio ya no es público.`,
  addOneMore:
    "Añade un barco más desde explorar o desde tus matches para que la vista lado a lado muestre diferencias reales.",
  factorHeading: "Factores de comparación",
  factorDescription:
    "Empieza por precio y calado, y luego usa las filas de abajo para comparar distribución y señales de confianza.",
  addMoreBoats: "Añadir más barcos",
  locationBeingRefined: "Ubicación en revisión",
  conditionNotScored: "Aún sin puntuación",
  photosOnFile: (count) => pluralize(count, "imagen", "imágenes"),
  photoCountSyncing: "La cantidad de fotos todavía se está sincronizando",
  notTaggedYet: "Aún sin etiquetas",
  sections: {
    money: {
      title: "Dinero",
      subtitle: "Aquí es donde el presupuesto y el valor empiezan a separarse rápido.",
      askingPrice: "Precio pedido",
      pricePerFoot: "Precio por pie",
      pricePerFootHelper: "Usa la moneda mostrada y la eslora total cuando está disponible.",
      modelYear: "Año del modelo",
      approximateAge: "Edad aprox.",
      approximateAgeValue: (years) => `${years} años`,
    },
    boatHandling: {
      title: "Barco y manejo",
      subtitle: "Eslora, manga y calado suelen ser los primeros filtros duros.",
      lengthOverall: "Eslora total",
      beam: "Manga",
      draft: "Calado",
      boatType: "Tipo de barco",
      rigType: "Tipo de aparejo",
      hullMaterial: "Material del casco",
      keel: "Quilla",
    },
    liveability: {
      title: "Habitabilidad y sistemas",
      subtitle: "Útil para decidir si el barco encaja con la forma en que realmente lo vas a usar.",
      cabins: "Camarotes",
      berths: "Literas",
      heads: "Baños",
      engine: "Motor",
      fuel: "Combustible",
      displacement: "Desplazamiento",
    },
    listingContext: {
      title: "Contexto del anuncio",
      subtitle:
        "Estas señales ayudan a juzgar confianza, frescura del anuncio y qué tan directo es el camino.",
      location: "Ubicación",
      listingPath: "Ruta del anuncio",
      conditionSignal: "Señal de estado",
      photosOnFile: "Fotos disponibles",
      characterTags: "Etiquetas de carácter",
    },
  },
  quickRead: {
    badge: "Lectura rápida",
    heading: "Dónde se separa de verdad la shortlist",
    description: "Estas son las diferencias más claras dentro del grupo actual.",
    empty:
      "Añade un par de barcos con especificaciones completas y este panel marcará de inmediato las diferencias más grandes.",
    footnote:
      "Luego usa la matriz de abajo para ver los números exactos, detalles de distribución y señales de confianza del anuncio.",
    suggestedFirstMove: "Primer movimiento sugerido",
  },
  fallback: {
    loadingCompareSet: "Cargando tu grupo de comparación...",
    preparingWorkspace: "Preparando el espacio de comparación...",
  },
  mobile: {
    recommendationSummary: (winnerTitle) => `${winnerTitle} parece la primera llamada más limpia.`,
    quickFactorSummary: (label, winnerTitle) => `${label}: ${winnerTitle}`,
    readySummary: (count) => `${pluralize(count, "barco", "barcos")} listos para comparar`,
    loaded: (count) => `${pluralize(count, "barco", "barcos")} cargados`,
    jumpToFactors: "Ir a factores",
    swipeHint: "Desliza hacia los lados para ver todas las columnas.",
  },
  metrics: {
    ask: "Precio",
    pricePerFoot: "Precio / pie",
    length: "Eslora",
    draft: "Calado",
  },
  conditionBadge: (score) => `Estado ${score}/10`,
  photoUnavailable: "Foto no disponible",
  bestFor: "Ideal para",
  whyItStandsOut: "Por qué destaca",
  watchouts: "Ojo con esto",
  noStrongSeparator: "Todavía no apareció una diferencia clara.",
  openListing: "Abrir anuncio",
  originalSource: "Fuente original",
  removeFromCompare: (title) => `Quitar ${title} de la comparación`,
  emptyState: {
    title: "Todavía no hay barcos en comparación",
    description:
      "Usa el botón Comparar en las tarjetas de explorar o en tus matches para crear una shortlist que valga la pena decidir.",
    cta: "Empezar a explorar",
  },
  analysis: {
    units: {
      perFoot: "/pie",
    },
    listingPath: {
      imported: (source) => `Importado desde ${source}`,
      directFeatured: "Anuncio directo destacado",
      directOnlyHulls: "Anuncio directo en OnlyHulls",
    },
    quickFactors: {
      lowestBuyIn: {
        label: "Entrada más baja",
        onlyWinner: (price) => `${price} te mete primero en este grupo de comparación.`,
        savings: (price, runnerUpTitle) => `${price} menos que ${runnerUpTitle}.`,
      },
      pricePerFootEdge: {
        label: "Ventaja en precio por pie",
        detail: (pricePerFoot) => `${pricePerFoot} según el precio actual y la eslora total.`,
      },
      newestBuild: {
        label: "Construcción más reciente",
        onlyWinner: (year) => `${year} es la construcción más reciente de este grupo.`,
        advantage: (yearDelta, runnerUpTitle) =>
          `${yearDelta} años más nuevo que ${runnerUpTitle}.`,
      },
      longestHull: {
        label: "Casco más largo",
        onlyWinner: (length) => `${length} de eslora total.`,
        advantage: (length, advantageFeet, runnerUpTitle) =>
          `${length} de eslora, unos ${advantageFeet} pies más que ${runnerUpTitle}.`,
      },
      shallowerDraft: {
        label: "Calado más bajo",
        onlyWinner: (draft) => `${draft} de calado.`,
        advantage: (draft, marginFeet, runnerUpTitle) =>
          `${draft} de calado, aproximadamente ${marginFeet} pies menos que ${runnerUpTitle}.`,
      },
      accommodationEdge: {
        label: "Ventaja de habitabilidad",
        detail: (parts) => parts.join(" / "),
        cabins: (count) => `${count} camarotes`,
        berths: (count) => `${count} literas`,
        heads: (count) => `${count} baños`,
      },
    },
    actionRecommendation: {
      directPath: "ruta directa dentro de OnlyHulls",
      importedPath: "ruta importada más limpia",
      condition: (score) => `estado ${score}/10`,
      images: (count) => pluralize(count, "imagen", "imágenes"),
      specificLocationShown: "muestra ubicación específica",
      detail: (reasons) =>
        `Mejor primera llamada si quieres empezar por la ruta más limpia: ${reasons}.`,
    },
    insights: {
      lowestBuyIn: "Entrada más barata en esta comparación",
      highestAskingPrice: "Precio pedido más alto en esta comparación",
      lowerPricePerFoot: "Menor precio por pie",
      higherPricePerFoot: "Mayor precio por pie",
      newestBuildYear: "Año de construcción más reciente aquí",
      oldestBuildYear: "Año de construcción más antiguo aquí",
      longerLoa: "Mayor eslora dentro de esta shortlist",
      smallerFootprint: "Huella general más pequeña",
      shallowerDraft: "Calado más bajo",
      deeperDraft: "Calado más profundo a tener en cuenta",
      strongerAccommodation: "Configuración de habitabilidad más fuerte",
      lighterAccommodation: "Ficha de habitabilidad más ligera",
      betterConditionSignal: "Mejor señal de estado",
      weakerConditionSignal: "Señal de estado más débil",
      directListing: "Anuncio directo dentro de OnlyHulls",
      importedListing: "Anuncio importado; confirma los detalles de origen antes de actuar",
      locationRefining: "La ubicación todavía se está refinando",
      thinSpecs: "Ficha técnica demasiado delgada para decidir con claridad",
    },
    bestFit: {
      bluewater: {
        label: "Crucero bluewater",
        lengthReason: (length) => `${length} de eslora le da una postura offshore más fuerte.`,
        tagReason:
          "Sus etiquetas bluewater lo convierten en un candidato más natural para una shortlist oceánica.",
      },
      liveaboard: {
        label: "Configuración liveaboard",
        cabinsReason: (cabins, heads) =>
          `${cabins} y ${heads} ayudan a una vida a bordo más cómoda durante más tiempo.`,
        tagReason: "Las señales liveaboard apuntan a una vida a bordo más sencilla.",
      },
      shallowWater: {
        label: "Crucero en aguas someras",
        reason: (draft) => `${draft} de calado abre fondeos más bajos y rutas costeras.`,
      },
      familyCrew: {
        label: "Tripulación familiar",
        berthsReason: (berths) =>
          `${berths} dan más flexibilidad para familia o invitados al dormir.`,
        tagReason:
          "Las señales family-friendly sugieren una configuración de crucero más fácil con invitados.",
      },
      fastFirstContact: {
        label: "Contacto rápido",
        reason:
          "Anuncio directo, buena señal de estado y una cantidad sólida de fotos hacen que sea más fácil actuar.",
      },
      valueFirst: {
        label: "Shortlist orientada a valor",
        reason: "El precio actual por pie mantiene a este barco dentro de la conversación de mejor valor.",
      },
    },
  },
};

export function getComparePageCopy(locale: string) {
  return isSpanishLocale(locale) ? ES_COMPARE_COPY : EN_COMPARE_COPY;
}
