export type ThemeMode = "light" | "dark";
export type StoredTheme = ThemeMode | "system";

export const THEME_STORAGE_KEY = "aifaq-theme";

export function normalizeStoredTheme(raw: string | null): StoredTheme {
  if (raw === "light" || raw === "dark" || raw === "system") return raw;
  return "system";
}

export function resolveInitialTheme(
  stored: StoredTheme,
  systemPrefersDark: boolean
): ThemeMode {
  if (stored === "light" || stored === "dark") return stored;
  return systemPrefersDark ? "dark" : "light";
}

export function shouldFollowSystem(stored: StoredTheme): boolean {
  return stored === "system";
}
