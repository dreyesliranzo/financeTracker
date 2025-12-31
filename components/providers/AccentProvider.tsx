"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "ledgerly-accent";

export type AccentOption = {
  value: string;
  label: string;
  description: string;
};

const accentOptions: AccentOption[] = [
  { value: "iris", label: "Iris", description: "Cool blue with violet glow." },
  { value: "emerald", label: "Emerald", description: "Green focus with teal glow." },
  { value: "sunset", label: "Sunset", description: "Warm amber with coral glow." },
  { value: "cyan", label: "Cyan", description: "Crisp cyan with mint glow." }
];

type AccentContextValue = {
  accent: string;
  options: AccentOption[];
  setAccent: (value: string) => void;
};

const AccentContext = createContext<AccentContextValue>({
  accent: "iris",
  options: accentOptions,
  setAccent: () => {}
});

export function AccentProvider({ children }: { children: ReactNode }) {
  const [accent, setAccent] = useState("iris");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (stored) {
      setAccent(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-accent", accent);
    localStorage.setItem(STORAGE_KEY, accent);
  }, [accent]);

  const value = useMemo(
    () => ({
      accent,
      options: accentOptions,
      setAccent
    }),
    [accent]
  );

  return <AccentContext.Provider value={value}>{children}</AccentContext.Provider>;
}

export function useAccent() {
  return useContext(AccentContext);
}
