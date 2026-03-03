import { THEME_STORAGE_KEY } from "./theme-preference";

export function buildThemeInitScript(
  storageKey: string = THEME_STORAGE_KEY
): string {
  return `(() => {
    try {
      const raw = localStorage.getItem(${JSON.stringify(storageKey)});
      const stored = raw === "light" || raw === "dark" || raw === "system" ? raw : "system";
      const media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
      const prefersDark = media ? media.matches : false;
      const next = stored === "dark" || stored === "light" ? stored : (prefersDark ? "dark" : "light");
      document.documentElement.dataset.theme = next;
    } catch (_) {}
  })();`;
}
