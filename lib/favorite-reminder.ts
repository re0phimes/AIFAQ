export type LearningStatus = "unread" | "learning" | "mastered";
export type ReminderLang = "zh" | "en";

export interface FavoriteReminderItem {
  learning_status: LearningStatus;
  created_at: string | Date | null;
  last_viewed_at: string | Date | null;
}

export interface FavoriteStats {
  total: number;
  unread: number;
  learning: number;
  mastered: number;
  stale: number;
}

export function parseDateSafe(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getReferenceDate(item: FavoriteReminderItem): Date | null {
  return parseDateSafe(item.last_viewed_at) ?? parseDateSafe(item.created_at);
}

export function getElapsedDays(referenceDate: Date, now = new Date()): number {
  const diff = now.getTime() - referenceDate.getTime();
  const elapsed = Math.floor(diff / (24 * 60 * 60 * 1000));
  return elapsed < 0 ? 0 : elapsed;
}

export function formatRelativeTime(elapsedDays: number, lang: ReminderLang): string {
  const safeDays = elapsedDays < 0 ? 0 : elapsedDays;
  if (safeDays >= 14) {
    const weeks = Math.floor(safeDays / 7);
    if (lang === "en") return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
    return `${weeks} 周前`;
  }
  if (lang === "en") return `${safeDays} day${safeDays === 1 ? "" : "s"} ago`;
  return `${safeDays} 天前`;
}

export function shouldShowNudge(
  item: FavoriteReminderItem,
  now = new Date(),
  thresholdDays = 14
): boolean {
  if (item.learning_status !== "unread" && item.learning_status !== "learning") return false;
  const reference = getReferenceDate(item);
  if (!reference) return false;
  return getElapsedDays(reference, now) >= thresholdDays;
}

export function enrichFavoriteForDisplay<T extends FavoriteReminderItem>(
  favorite: T,
  lang: ReminderLang,
  now = new Date(),
  thresholdDays = 14
): T & { relative_time_label: string; needs_nudge: boolean } {
  const reference = getReferenceDate(favorite);
  const relative_time_label = reference
    ? formatRelativeTime(getElapsedDays(reference, now), lang)
    : (lang === "en" ? "Unknown time" : "时间未知");
  return {
    ...favorite,
    relative_time_label,
    needs_nudge: shouldShowNudge(favorite, now, thresholdDays),
  };
}

export function computeFavoriteStats(
  favorites: FavoriteReminderItem[],
  now = new Date(),
  thresholdDays = 14
): FavoriteStats {
  let unread = 0;
  let learning = 0;
  let mastered = 0;
  let stale = 0;

  for (const favorite of favorites) {
    if (favorite.learning_status === "unread") unread += 1;
    else if (favorite.learning_status === "learning") learning += 1;
    else if (favorite.learning_status === "mastered") mastered += 1;

    if (shouldShowNudge(favorite, now, thresholdDays)) stale += 1;
  }

  return {
    total: favorites.length,
    unread,
    learning,
    mastered,
    stale,
  };
}
