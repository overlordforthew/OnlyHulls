"use client";

import { useState, useEffect } from "react";

const themes = [
  {
    name: "Ocean",
    icon: "🌊",
    vars: {
      "--background": "#ffffff",
      "--foreground": "#0f172a",
      "--primary": "#0369a1",
      "--primary-light": "#0ea5e9",
      "--primary-dark": "#075985",
      "--accent": "#f59e0b",
      "--muted": "#f1f5f9",
      "--border": "#e2e8f0",
    },
  },
  {
    name: "Sunset",
    icon: "🌅",
    vars: {
      "--background": "#fffbf5",
      "--foreground": "#1c1917",
      "--primary": "#ea580c",
      "--primary-light": "#fb923c",
      "--primary-dark": "#c2410c",
      "--accent": "#eab308",
      "--muted": "#fef3c7",
      "--border": "#fed7aa",
    },
  },
  {
    name: "Deep Navy",
    icon: "⚓",
    vars: {
      "--background": "#0b1120",
      "--foreground": "#e2e8f0",
      "--primary": "#c9a84c",
      "--primary-light": "#e2c86d",
      "--primary-dark": "#a68932",
      "--accent": "#38bdf8",
      "--muted": "#1a2332",
      "--border": "#2a3a4e",
    },
  },
  {
    name: "Tropical",
    icon: "🌴",
    vars: {
      "--background": "#f0fdfa",
      "--foreground": "#134e4a",
      "--primary": "#0d9488",
      "--primary-light": "#2dd4bf",
      "--primary-dark": "#0f766e",
      "--accent": "#f59e0b",
      "--muted": "#ccfbf1",
      "--border": "#99f6e4",
    },
  },
  {
    name: "Midnight",
    icon: "🔥",
    vars: {
      "--background": "#09090b",
      "--foreground": "#fafafa",
      "--primary": "#e11d48",
      "--primary-light": "#fb7185",
      "--primary-dark": "#be123c",
      "--accent": "#a855f7",
      "--muted": "#18181b",
      "--border": "#27272a",
    },
  },
];

export default function ThemeSwitcher() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const root = document.documentElement;
    const theme = themes[index];
    Object.entries(theme.vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  }, [index]);

  const next = () => setIndex((i) => (i + 1) % themes.length);

  return (
    <button
      onClick={next}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-foreground/90 px-4 py-3 text-sm font-medium text-background shadow-lg backdrop-blur transition-all hover:scale-105 active:scale-95"
      title={`Theme: ${themes[index].name} — Click to switch`}
    >
      <span className="text-lg">{themes[index].icon}</span>
      <span className="hidden sm:inline">{themes[index].name}</span>
    </button>
  );
}
