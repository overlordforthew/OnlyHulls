"use client";

import { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";

export default function ThemeSwitcher() {
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("oh-theme");
    if (saved === "light") {
      setIsLight(true);
      document.documentElement.classList.add("light");
    }
  }, []);

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
      className="fixed bottom-6 right-6 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface shadow-lg backdrop-blur transition-all hover:border-primary hover:scale-105 active:scale-95"
      title={isLight ? "Switch to dark mode" : "Switch to light mode"}
    >
      {isLight ? (
        <Moon className="h-4.5 w-4.5 text-text-secondary" />
      ) : (
        <Sun className="h-4.5 w-4.5 text-text-secondary" />
      )}
    </button>
  );
}
