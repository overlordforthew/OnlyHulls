"use client";

import { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";

interface ThemeSwitcherProps {
  variant?: "floating" | "inline" | "menu";
  className?: string;
  onToggle?: () => void;
}

export default function ThemeSwitcher({
  variant = "floating",
  className = "",
  onToggle,
}: ThemeSwitcherProps) {
  const t = useTranslations("themeSwitcher");
  const [isLight, setIsLight] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("oh-theme") === "light";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("light", isLight);
  }, [isLight]);

  function toggle() {
    const next = !isLight;
    setIsLight(next);
    if (next) {
      document.documentElement.classList.add("light");
      localStorage.setItem("oh-theme", "light");
    } else {
      document.documentElement.classList.remove("light");
      localStorage.setItem("oh-theme", "dark");
    }
    onToggle?.();
  }

  const label = isLight ? t("switchToDark") : t("switchToLight");
  const Icon = isLight ? Moon : Sun;

  if (variant === "menu") {
    return (
      <button
        type="button"
        onClick={toggle}
        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary transition-all hover:bg-muted hover:text-foreground ${className}`.trim()}
        title={label}
        aria-pressed={isLight}
      >
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </button>
    );
  }

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={toggle}
        className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-colors hover:border-primary ${className}`.trim()}
        title={label}
        aria-label={label}
        aria-pressed={isLight}
      >
        <Icon className="h-4 w-4 text-text-secondary" />
        <span className="sr-only">{label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={`fixed bottom-20 right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface shadow-lg backdrop-blur transition-all hover:border-primary hover:scale-105 active:scale-95 sm:bottom-20 sm:right-6 ${className}`.trim()}
      title={label}
      aria-pressed={isLight}
    >
      <Icon className="h-4.5 w-4.5 text-text-secondary" />
    </button>
  );
}
