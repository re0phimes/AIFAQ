"use client";

import { useCallback, useEffect, useState } from "react";
import {
  THEME_STORAGE_KEY,
  normalizeStoredTheme,
  resolveInitialTheme,
  shouldFollowSystem,
  type ThemeMode,
} from "@/lib/theme-preference";

interface ThemeToggleProps {
  lang: "zh" | "en";
  storageKey?: string;
}

const DARK_QUERY = "(prefers-color-scheme: dark)";

function getSystemPrefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(DARK_QUERY).matches;
}

function applyTheme(theme: ThemeMode): void {
  document.documentElement.dataset.theme = theme;
}

function getInitialTheme(storageKey: string): ThemeMode {
  if (typeof window === "undefined") return "light";
  let storedRaw: string | null = null;
  try {
    storedRaw = localStorage.getItem(storageKey);
  } catch {
    storedRaw = null;
  }
  const stored = normalizeStoredTheme(storedRaw);
  return resolveInitialTheme(stored, getSystemPrefersDark());
}

export default function ThemeToggle({
  lang,
  storageKey = THEME_STORAGE_KEY,
}: ThemeToggleProps) {
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme(storageKey));

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const media = window.matchMedia ? window.matchMedia(DARK_QUERY) : null;
    const stored = normalizeStoredTheme(
      (() => {
        try {
          return localStorage.getItem(storageKey);
        } catch {
          return null;
        }
      })()
    );
    if (!media || !shouldFollowSystem(stored)) return;

    const onChange = (event: MediaQueryListEvent) => {
      const next: ThemeMode = event.matches ? "dark" : "light";
      setTheme(next);
    };

    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [storageKey]);

  const handleToggle = useCallback(() => {
    const next: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // Ignore storage write failures in private mode / restricted env.
    }
  }, [storageKey, theme]);

  const nextLabel =
    theme === "dark"
      ? lang === "zh"
        ? "浅色"
        : "Light"
      : lang === "zh"
        ? "深色"
        : "Dark";
  const ariaLabel =
    lang === "zh" ? `切换到${nextLabel}主题` : `Switch to ${nextLabel} theme`;

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={ariaLabel}
      title={ariaLabel}
      className="flex items-center gap-1.5 rounded-full border-[0.5px] border-border px-3 py-1 text-xs text-subtext hover:bg-surface transition-colors"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        className="h-3.5 w-3.5"
      >
        {theme === "dark" ? (
          <path
            d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364 6.364-1.414-1.414M7.05 7.05 5.636 5.636m12.728 0L16.95 7.05M7.05 16.95l-1.414 1.414M12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <path
            d="M21 13.01A9 9 0 1 1 10.99 3 7 7 0 0 0 21 13.01Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
      <span>{nextLabel}</span>
    </button>
  );
}
