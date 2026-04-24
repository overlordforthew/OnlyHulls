import { DEFAULT_LOCALE } from "./config";

// Prefix an internal href with the locale path segment when the current
// locale is not the default. English stays at the root; Spanish gets /es/foo.
// Absolute URLs and hash-only fragments pass through unchanged.
export function localizedHref(href: string, locale: string): string {
  if (!href) return href;
  if (locale === DEFAULT_LOCALE) return href;
  if (href.startsWith("#") || href.startsWith("http://") || href.startsWith("https://")) {
    return href;
  }
  if (href === "/") return `/${locale}`;
  if (href.startsWith(`/${locale}/`) || href === `/${locale}`) return href;
  return `/${locale}${href.startsWith("/") ? "" : "/"}${href}`;
}

// Build the full set of hreflang alternates for a given en href. Returns a
// { en, es, "x-default" } map suitable for Next.js Metadata's alternates.languages.
export function buildLanguageAlternates(
  appUrl: string,
  enHref: string
): Record<string, string> {
  const cleanHref = enHref === "/" ? "" : enHref;
  return {
    en: `${appUrl}${cleanHref || "/"}`,
    es: `${appUrl}/es${cleanHref}`,
    "x-default": `${appUrl}${cleanHref || "/"}`,
  };
}
