export interface RootLayoutCopy {
  defaultTitle: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  ogAlt: string;
  twitterDescription: string;
  organizationDescription: string;
  websiteDescription: string;
}

export interface BoatsLayoutCopy {
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  ogAlt: string;
  twitterDescription: string;
}

export interface CompareLayoutCopy {
  title: string;
  description: string;
  ogDescription: string;
  twitterDescription: string;
}

export interface AuthLayoutCopy {
  signInTitle: string;
  signUpTitle: string;
  forgotPasswordTitle: string;
  resetPasswordTitle: string;
}

function isSpanishLocale(locale: string) {
  return locale.toLowerCase().startsWith("es");
}

const EN_ROOT_LAYOUT_COPY: RootLayoutCopy = {
  defaultTitle: "OnlyHulls | AI-Powered Boat Marketplace",
  description:
    "AI-powered boat marketplace for catamarans, sailboats, and serious buyers. Better matching, cleaner listings, and direct seller connections.",
  ogTitle: "OnlyHulls | AI-Powered Boat Marketplace",
  ogDescription:
    "Discover catamarans and sailboats with AI-powered matching, cleaner inventory, and direct seller connections.",
  ogAlt: "OnlyHulls - AI-Powered Boat Marketplace",
  twitterDescription: "AI-powered boat matching, cleaner listings, and direct seller connections.",
  organizationDescription:
    "AI-powered boat marketplace for catamarans, sailboats, and serious buyers.",
  websiteDescription:
    "AI-powered boat marketplace for catamarans, sailboats, and serious buyers.",
};

const ES_ROOT_LAYOUT_COPY: RootLayoutCopy = {
  defaultTitle: "OnlyHulls | Marketplace de barcos con IA",
  description:
    "Marketplace de barcos con IA para catamaranes, veleros y compradores serios. Mejor matching, anuncios más limpios y contacto directo con vendedores.",
  ogTitle: "OnlyHulls | Marketplace de barcos con IA",
  ogDescription:
    "Descubre catamaranes y veleros con matching impulsado por IA, inventario más limpio y contacto directo con vendedores.",
  ogAlt: "OnlyHulls - Marketplace de barcos con IA",
  twitterDescription:
    "Matching de barcos con IA, anuncios más limpios y contacto directo con vendedores.",
  organizationDescription:
    "Marketplace de barcos con IA para catamaranes, veleros y compradores serios.",
  websiteDescription:
    "Marketplace de barcos con IA para catamaranes, veleros y compradores serios.",
};

const EN_BOATS_LAYOUT_COPY: BoatsLayoutCopy = {
  title: "Browse Boats for Sale",
  description:
    "Browse catamarans and sailboats for sale on OnlyHulls. Search cleaner listings, compare boats, and connect directly with sellers.",
  ogTitle: "Browse Boats for Sale | OnlyHulls",
  ogDescription:
    "Browse catamarans and sailboats for sale on OnlyHulls. Search cleaner listings, compare boats, and connect directly with sellers.",
  ogAlt: "Browse boats for sale on OnlyHulls",
  twitterDescription:
    "Browse catamarans and sailboats for sale on OnlyHulls. Search cleaner listings, compare boats, and connect directly with sellers.",
};

const ES_BOATS_LAYOUT_COPY: BoatsLayoutCopy = {
  title: "Explorar barcos en venta",
  description:
    "Explora catamaranes y veleros en venta en OnlyHulls. Busca anuncios más limpios, compara barcos y contacta directamente con vendedores.",
  ogTitle: "Explorar barcos en venta | OnlyHulls",
  ogDescription:
    "Explora catamaranes y veleros en venta en OnlyHulls. Busca anuncios más limpios, compara barcos y contacta directamente con vendedores.",
  ogAlt: "Explorar barcos en venta en OnlyHulls",
  twitterDescription:
    "Explora catamaranes y veleros en venta en OnlyHulls. Busca anuncios más limpios, compara barcos y contacta directamente con vendedores.",
};

const EN_COMPARE_LAYOUT_COPY: CompareLayoutCopy = {
  title: "Compare Boats",
  description:
    "Compare boat listings side by side on OnlyHulls. Review price, draft, layout, trust signals, and share your shortlist with one link.",
  ogDescription:
    "Review boat shortlists side by side, compare the factors that matter, and share the same compare set with one link.",
  twitterDescription:
    "Compare boat shortlists side by side on OnlyHulls and share the same compare set with one link.",
};

const ES_COMPARE_LAYOUT_COPY: CompareLayoutCopy = {
  title: "Comparar barcos",
  description:
    "Compara anuncios de barcos lado a lado en OnlyHulls. Revisa precio, calado, distribución, señales de confianza y comparte tu shortlist con un solo enlace.",
  ogDescription:
    "Revisa shortlists de barcos lado a lado, compara los factores que importan y comparte el mismo grupo con un solo enlace.",
  twitterDescription:
    "Compara shortlists de barcos lado a lado en OnlyHulls y comparte el mismo grupo de comparación con un solo enlace.",
};

const EN_AUTH_LAYOUT_COPY: AuthLayoutCopy = {
  signInTitle: "Sign In",
  signUpTitle: "Create Account",
  forgotPasswordTitle: "Forgot Password",
  resetPasswordTitle: "Reset Password",
};

const ES_AUTH_LAYOUT_COPY: AuthLayoutCopy = {
  signInTitle: "Iniciar sesión",
  signUpTitle: "Crear cuenta",
  forgotPasswordTitle: "Olvidé mi contraseña",
  resetPasswordTitle: "Restablecer contraseña",
};

export function getRootLayoutCopy(locale: string) {
  return isSpanishLocale(locale) ? ES_ROOT_LAYOUT_COPY : EN_ROOT_LAYOUT_COPY;
}

export function getBoatsLayoutCopy(locale: string) {
  return isSpanishLocale(locale) ? ES_BOATS_LAYOUT_COPY : EN_BOATS_LAYOUT_COPY;
}

export function getCompareLayoutCopy(locale: string) {
  return isSpanishLocale(locale) ? ES_COMPARE_LAYOUT_COPY : EN_COMPARE_LAYOUT_COPY;
}

export function getAuthLayoutCopy(locale: string) {
  return isSpanishLocale(locale) ? ES_AUTH_LAYOUT_COPY : EN_AUTH_LAYOUT_COPY;
}
