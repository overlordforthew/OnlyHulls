export type SupportedCurrency = "USD" | "EUR" | "GBP";

export const DEFAULT_CURRENCY: SupportedCurrency = "USD";
export const PREFERRED_CURRENCY_COOKIE = "preferred_currency";
export const PREFERRED_CURRENCY_SELECTED_COOKIE = "preferred_currency_selected";

const EURO_REGIONS = new Set([
  "AT",
  "BE",
  "CY",
  "DE",
  "EE",
  "ES",
  "FI",
  "FR",
  "GR",
  "HR",
  "IE",
  "IT",
  "LT",
  "LU",
  "LV",
  "MT",
  "NL",
  "PT",
  "SI",
  "SK",
]);

const USD_TO_CURRENCY_RATE: Record<SupportedCurrency, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.78,
};

export function normalizeSupportedCurrency(value: string | null | undefined): SupportedCurrency {
  return value === "EUR" || value === "GBP" ? value : "USD";
}

export function convertUsdToCurrency(amountUsd: number, currency: SupportedCurrency): number {
  return amountUsd * USD_TO_CURRENCY_RATE[currency];
}

export function convertCurrencyToUsd(amount: number, currency: SupportedCurrency): number {
  return amount / USD_TO_CURRENCY_RATE[currency];
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function formatCurrencyAmount(
  amount: number,
  currency: string,
  maximumFractionDigits = 0
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits,
  }).format(amount);
}

function isFiniteAmount(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function readBrowserPersistedCurrency(): SupportedCurrency | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(PREFERRED_CURRENCY_COOKIE);
  if (stored) {
    return normalizeSupportedCurrency(stored);
  }

  const match = document.cookie.match(
    new RegExp(`(?:^|; )${PREFERRED_CURRENCY_COOKIE}=([^;]+)`)
  );
  return match ? normalizeSupportedCurrency(decodeURIComponent(match[1])) : null;
}

function hasExplicitCurrencySelection(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const stored = window.localStorage.getItem(PREFERRED_CURRENCY_SELECTED_COOKIE);
  if (stored === "1") {
    return true;
  }

  return new RegExp(`(?:^|; )${PREFERRED_CURRENCY_SELECTED_COOKIE}=1(?:;|$)`).test(
    document.cookie
  );
}

function detectBrowserCurrency(): SupportedCurrency {
  if (typeof navigator === "undefined") {
    return DEFAULT_CURRENCY;
  }

  const locales = [navigator.language, ...(navigator.languages || [])].filter(Boolean);

  for (const locale of locales) {
    const normalizedLocale = locale.replace(/_/g, "-");
    const regionMatch = normalizedLocale.match(/-([A-Za-z]{2})(?:$|-)/);
    const region = regionMatch?.[1]?.toUpperCase();

    if (region === "GB") {
      return "GBP";
    }

    if (region && EURO_REGIONS.has(region)) {
      return "EUR";
    }
  }

  return DEFAULT_CURRENCY;
}

function deriveUsdAmount(
  amount: number,
  nativeCurrency: string,
  amountUsd: number | null | undefined
): number | null {
  if (isFiniteAmount(amountUsd)) {
    return amountUsd;
  }

  const normalizedNative = normalizeSupportedCurrency(nativeCurrency);
  if (normalizedNative === nativeCurrency) {
    return convertCurrencyToUsd(amount, normalizedNative);
  }

  return nativeCurrency === "USD" ? amount : null;
}

export function getDisplayedPrice(options: {
  amount: number;
  nativeCurrency: string;
  amountUsd?: number | null;
  preferredCurrency?: string | null;
}): {
  primary: string;
  secondary: string | null;
  appliedCurrency: SupportedCurrency | string;
  usedConversion: boolean;
} {
  const preferredCurrency = normalizeSupportedCurrency(options.preferredCurrency);
  const nativeCurrency = options.nativeCurrency || DEFAULT_CURRENCY;
  const usdAmount = deriveUsdAmount(options.amount, nativeCurrency, options.amountUsd);

  if (usdAmount !== null) {
    const converted = convertUsdToCurrency(usdAmount, preferredCurrency);
    const primary = formatCurrencyAmount(converted, preferredCurrency);

    if (preferredCurrency !== nativeCurrency) {
      return {
        primary,
        secondary: `Native price ${formatCurrencyAmount(options.amount, nativeCurrency)}`,
        appliedCurrency: preferredCurrency,
        usedConversion: true,
      };
    }

    if (preferredCurrency !== "USD") {
      return {
        primary,
        secondary: `Approx. ${formatCurrencyAmount(usdAmount, "USD")} USD`,
        appliedCurrency: preferredCurrency,
        usedConversion: true,
      };
    }

    return {
      primary,
      secondary: nativeCurrency !== "USD" ? `Native price ${formatCurrencyAmount(options.amount, nativeCurrency)}` : null,
      appliedCurrency: preferredCurrency,
      usedConversion: nativeCurrency !== preferredCurrency,
    };
  }

  return {
    primary: formatCurrencyAmount(options.amount, nativeCurrency),
    secondary: null,
    appliedCurrency: nativeCurrency,
    usedConversion: false,
  };
}

export function readPreferredCurrencyFromBrowser(): SupportedCurrency {
  if (typeof window === "undefined") {
    return DEFAULT_CURRENCY;
  }

  if (hasExplicitCurrencySelection()) {
    return readBrowserPersistedCurrency() || DEFAULT_CURRENCY;
  }

  return detectBrowserCurrency();
}

export function persistPreferredCurrency(currency: SupportedCurrency) {
  if (typeof document === "undefined") {
    return;
  }

  const normalized = normalizeSupportedCurrency(currency);
  document.cookie = `${PREFERRED_CURRENCY_COOKIE}=${encodeURIComponent(normalized)}; Path=/; Max-Age=31536000; SameSite=Lax`;
  document.cookie = `${PREFERRED_CURRENCY_SELECTED_COOKIE}=1; Path=/; Max-Age=31536000; SameSite=Lax`;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(PREFERRED_CURRENCY_COOKIE, normalized);
    window.localStorage.setItem(PREFERRED_CURRENCY_SELECTED_COOKIE, "1");
  }
}

export function getBudgetRangeUsd(
  budgetRange: Record<string, unknown> | null | undefined
): { min: number | null; max: number | null; currency: SupportedCurrency } {
  const currency = normalizeSupportedCurrency(
    typeof budgetRange?.currency === "string" ? budgetRange.currency : null
  );

  const minUsd = asFiniteNumber(budgetRange?.min_usd);
  const maxUsd = asFiniteNumber(budgetRange?.max_usd);
  if (minUsd !== null || maxUsd !== null) {
    return { min: minUsd, max: maxUsd, currency };
  }

  const min = asFiniteNumber(budgetRange?.min);
  const max = asFiniteNumber(budgetRange?.max);

  return {
    min: min !== null ? convertCurrencyToUsd(min, currency) : null,
    max: max !== null ? convertCurrencyToUsd(max, currency) : null,
    currency,
  };
}
