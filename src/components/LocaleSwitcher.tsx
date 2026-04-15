"use client";

import { startTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  SUPPORTED_LOCALES,
  type AppLocale,
} from "@/i18n/config";

interface LocaleSwitcherProps {
  className?: string;
  compact?: boolean;
  variant?: "default" | "menu";
  onChangeComplete?: () => void;
}

function persistLocale(locale: AppLocale) {
  document.cookie = `${LOCALE_COOKIE_NAME}=${encodeURIComponent(locale)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export default function LocaleSwitcher({
  className = "",
  compact = false,
  variant = "default",
  onChangeComplete,
}: LocaleSwitcherProps) {
  const router = useRouter();
  const locale = useLocale() as AppLocale;
  const t = useTranslations("localeSwitcher");

  function handleChange(nextLocale: string) {
    const normalizedLocale = SUPPORTED_LOCALES.includes(nextLocale as AppLocale)
      ? (nextLocale as AppLocale)
      : DEFAULT_LOCALE;

    persistLocale(normalizedLocale);
    startTransition(() => {
      router.refresh();
    });
    onChangeComplete?.();
  }

  if (variant === "menu") {
    return (
      <div
        className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${className}`.trim()}
      >
        <label htmlFor="locale-switcher-menu" className="font-medium text-foreground">
          {t("label")}
        </label>
        <select
          id="locale-switcher-menu"
          aria-label={t("label")}
          value={locale}
          onChange={(event) => handleChange(event.target.value)}
          onClick={(event) => event.stopPropagation()}
          className="min-w-28 rounded-full border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:border-primary focus:border-primary focus:outline-none"
        >
          <option value="en">{t("english")}</option>
          <option value="es">{t("spanish")}</option>
        </select>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`.trim()}>
      <label
        htmlFor="locale-switcher"
        className={`text-sm ${compact ? "sr-only" : "text-foreground/60"}`}
      >
        {t("label")}
      </label>
      <select
        id="locale-switcher"
        aria-label={t("label")}
        value={locale}
        onChange={(event) => handleChange(event.target.value)}
        className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-foreground transition-colors hover:border-primary focus:border-primary focus:outline-none"
      >
        <option value="en">{t("english")}</option>
        <option value="es">{t("spanish")}</option>
      </select>
    </div>
  );
}
