export const SUPPORTED_LOCALES = ["en", "es"] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "en";
export const LOCALE_COOKIE_NAME = "NEXT_LOCALE";

const LOCALE_SET = new Set<string>(SUPPORTED_LOCALES);

export function isSupportedLocale(value: string | null | undefined): value is AppLocale {
  return typeof value === "string" && LOCALE_SET.has(value);
}

export function resolveLocale(value: string | null | undefined): AppLocale {
  return isSupportedLocale(value) ? value : DEFAULT_LOCALE;
}

export function getLocaleFromAcceptLanguage(
  headerValue: string | null | undefined
): AppLocale {
  if (!headerValue) {
    return DEFAULT_LOCALE;
  }

  const ranked = headerValue
    .split(",")
    .map((part) => {
      const [rawLanguage, ...params] = part.trim().split(";");
      const qualityParam = params.find((param) => param.trim().startsWith("q="));
      const quality = qualityParam ? Number.parseFloat(qualityParam.split("=")[1] || "1") : 1;

      return {
        language: rawLanguage.toLowerCase(),
        quality: Number.isFinite(quality) ? quality : 0,
      };
    })
    .sort((left, right) => right.quality - left.quality);

  for (const { language } of ranked) {
    const baseLanguage = language.split("-")[0];
    if (isSupportedLocale(baseLanguage)) {
      return baseLanguage;
    }
  }

  return DEFAULT_LOCALE;
}
