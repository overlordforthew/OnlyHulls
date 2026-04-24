import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  getLocaleFromAcceptLanguage,
  isSupportedLocale,
} from "./config";

// Locale resolution order:
//  1. x-locale header set by middleware.ts based on the /es path prefix.
//     This is the authoritative signal once /es URL split is live.
//  2. Explicit locale from next-intl request context (rare — used by tests).
//  3. User cookie.
//  4. Accept-Language header.
//  5. DEFAULT_LOCALE.
export default getRequestConfig(async ({ requestLocale }) => {
  const headerStore = await headers();
  const routeLocale = headerStore.get("x-locale");
  if (isSupportedLocale(routeLocale)) {
    return {
      locale: routeLocale,
      messages: (await import(`../messages/${routeLocale}.json`)).default,
    };
  }

  const explicitLocale = await requestLocale;
  let locale = isSupportedLocale(explicitLocale) ? explicitLocale : null;

  if (!locale) {
    const cookieStore = await cookies();
    const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
    locale = isSupportedLocale(cookieLocale) ? cookieLocale : null;
  }

  if (!locale) {
    locale = getLocaleFromAcceptLanguage(headerStore.get("accept-language"));
  }

  const activeLocale = locale || DEFAULT_LOCALE;

  return {
    locale: activeLocale,
    messages: (await import(`../messages/${activeLocale}.json`)).default,
  };
});
