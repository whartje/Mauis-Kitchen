"use client";

import { useState, useEffect } from "react";

export type Theme = "dark" | "light";

export function useTheme() {
  // Read from DOM class (set by the inline FOUC-prevention script) after mount
  const [theme, setThemeState] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const current = document.documentElement.classList.contains("light") ? "light" : "dark";
    setThemeState(current);
    setMounted(true);
  }, []);

  function setTheme(next: Theme) {
    setThemeState(next);
    try {
      localStorage.setItem("mauisKitchen_theme", next);
    } catch {}
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(next);
  }

  return { theme, setTheme, mounted };
}
