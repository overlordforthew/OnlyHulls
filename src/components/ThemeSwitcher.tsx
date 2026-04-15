"use client";

import { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";

export default function ThemeSwitcher() {
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
  }

  return (
    <button
      onClick={toggle}
      className="fixed bottom-20 right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface shadow-lg backdrop-blur transition-all hover:border-primary hover:scale-105 active:scale-95 sm:bottom-20 sm:right-6"
      title={isLight ? t("switchToDark") : t("switchToLight")}
    >
      {isLight ? (
        <Moon className="h-4.5 w-4.5 text-text-secondary" />
      ) : (
        <Sun className="h-4.5 w-4.5 text-text-secondary" />
      )}
    </button>
  );
}
