import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  getLocaleFromAcceptLanguage,
  isSupportedLocale,
} from "./config";

export default getRequestConfig(async ({ requestLocale }) => {
  const explicitLocale = await requestLocale;

  let locale = isSupportedLocale(explicitLocale) ? explicitLocale : null;

  if (!locale) {
    const cookieStore = await cookies();
    const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
    locale = isSupportedLocale(cookieLocale) ? cookieLocale : null;
  }

  if (!locale) {
    const headerStore = await headers();
    locale = getLocaleFromAcceptLanguage(headerStore.get("accept-language"));
  }

  const activeLocale = locale || DEFAULT_LOCALE;

  return {
    locale: activeLocale,
    messages: (await import(`../messages/${activeLocale}.json`)).default,
  };
});
