import test from "node:test";
import assert from "node:assert/strict";
import {
  computeFavoriteStats,
  enrichFavoriteForDisplay,
  formatRelativeTime,
  getElapsedDays,
  getReferenceDate,
  shouldShowNudge,
} from "./favorite-reminder";

type LearningStatus = "unread" | "learning" | "mastered";

interface FavoriteForTest {
  learning_status: LearningStatus;
  created_at: string | Date | null;
  last_viewed_at: string | Date | null;
}

const NOW = new Date("2026-03-03T00:00:00.000Z");

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

test("getReferenceDate prefers last_viewed_at over created_at", () => {
  const favorite: FavoriteForTest = {
    learning_status: "learning",
    created_at: daysAgo(40),
    last_viewed_at: daysAgo(5),
  };

  const reference = getReferenceDate(favorite);
  assert.ok(reference instanceof Date);
  assert.equal(reference?.toISOString(), daysAgo(5));
});

test("getElapsedDays clamps future dates to 0", () => {
  const future = new Date("2026-03-10T00:00:00.000Z");
  assert.equal(getElapsedDays(future, NOW), 0);
});

test("shouldShowNudge applies 14-day threshold and status gate", () => {
  const unread13: FavoriteForTest = {
    learning_status: "unread",
    created_at: daysAgo(13),
    last_viewed_at: null,
  };
  const unread14: FavoriteForTest = {
    learning_status: "unread",
    created_at: daysAgo(14),
    last_viewed_at: null,
  };
  const learning15: FavoriteForTest = {
    learning_status: "learning",
    created_at: daysAgo(50),
    last_viewed_at: daysAgo(15),
  };
  const mastered20: FavoriteForTest = {
    learning_status: "mastered",
    created_at: daysAgo(20),
    last_viewed_at: null,
  };

  assert.equal(shouldShowNudge(unread13, NOW), false);
  assert.equal(shouldShowNudge(unread14, NOW), true);
  assert.equal(shouldShowNudge(learning15, NOW), true);
  assert.equal(shouldShowNudge(mastered20, NOW), false);
});

test("formatRelativeTime renders zh/en day and week labels", () => {
  assert.equal(formatRelativeTime(3, "zh"), "3 天前");
  assert.equal(formatRelativeTime(3, "en"), "3 days ago");
  assert.equal(formatRelativeTime(14, "zh"), "2 周前");
  assert.equal(formatRelativeTime(14, "en"), "2 weeks ago");
});

test("enrichFavoriteForDisplay returns unknown label and no nudge for invalid dates", () => {
  const favorite: FavoriteForTest = {
    learning_status: "unread",
    created_at: "not-a-date",
    last_viewed_at: null,
  };

  const enrichedZh = enrichFavoriteForDisplay(favorite, "zh", NOW);
  const enrichedEn = enrichFavoriteForDisplay(favorite, "en", NOW);
  assert.equal(enrichedZh.relative_time_label, "时间未知");
  assert.equal(enrichedEn.relative_time_label, "Unknown time");
  assert.equal(enrichedZh.needs_nudge, false);
});

test("computeFavoriteStats counts nudge candidates with shared rule", () => {
  const favorites: FavoriteForTest[] = [
    { learning_status: "unread", created_at: daysAgo(20), last_viewed_at: null },
    { learning_status: "learning", created_at: daysAgo(30), last_viewed_at: daysAgo(16) },
    { learning_status: "mastered", created_at: daysAgo(120), last_viewed_at: daysAgo(1) },
  ];

  const stats = computeFavoriteStats(favorites, NOW);
  assert.deepEqual(stats, {
    total: 3,
    unread: 1,
    learning: 1,
    mastered: 1,
    stale: 2,
  });
});
