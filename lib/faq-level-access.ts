export type ViewerAccess = {
  role?: "admin" | "user";
  tier?: "free" | "premium";
};

type LevelFilter = 1 | 2 | "all";

function isPrivileged(viewer: ViewerAccess | null | undefined): boolean {
  return viewer?.role === "admin" || viewer?.tier === "premium";
}

export function canAccessFaqLevel(
  viewer: ViewerAccess | null | undefined,
  level: number
): boolean {
  if (level !== 1 && level !== 2) return false;
  if (isPrivileged(viewer)) return true;
  return level === 1;
}

export function normalizeFaqLevelFilter(
  viewer: ViewerAccess | null | undefined,
  requested: string | null | undefined
): LevelFilter {
  const privileged = isPrivileged(viewer);
  if (!privileged) return 1;

  if (requested === "1") return 1;
  if (requested === "2") return 2;
  if (requested === "all" || requested === undefined || requested === null || requested === "") {
    return "all";
  }
  return "all";
}

export function resolveAllowedLevels(
  viewer: ViewerAccess | null | undefined,
  requested?: string | null
): number[] {
  const filter = normalizeFaqLevelFilter(viewer, requested);
  if (filter === "all") return [1, 2];
  return [filter];
}
