# Profile Page Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 404 error when clicking favorite items and redesign cards with alphaxiv-inspired style, mobile-first.

**Architecture:** Create standalone FavoriteCard component with new visual design (shadows, rounded corners, status borders). Replace collapsible sections with horizontal filter tabs. Use client-side state for filtering instead of server reload.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS

---

## Task 1: Create FavoriteCard Component

**Files:**
- Create: `components/FavoriteCard.tsx`

**Step 1: Create component with new design**

```tsx
"use client";

import Link from "next/link";
import { t, translateTag } from "@/lib/i18n";
import type { FAQItem } from "@/src/types/faq";

interface FavoriteItem {
  faq_id: number;
  faq: FAQItem;
  learning_status: 'unread' | 'learning' | 'mastered';
}

interface FavoriteCardProps {
  item: FavoriteItem;
  lang: "zh" | "en";
  onUpdateStatus: (faqId: number, status: 'learning' | 'mastered') => void;
  onToggleFavorite: (faqId: number) => void;
  showMasterButton?: boolean;
  isPending?: boolean;
}

export default function FavoriteCard({
  item,
  lang,
  onUpdateStatus,
  onToggleFavorite,
  showMasterButton,
  isPending,
}: FavoriteCardProps) {
  const { faq_id, faq, learning_status } = item;

  // Status-based styling
  const statusStyles = {
    unread: '',
    learning: 'border-l-4 border-l-blue-500 bg-blue-50/30',
    mastered: 'border-l-4 border-l-green-500 bg-green-50/30',
  };

  return (
    <article
      className={`
        rounded-2xl bg-white shadow-sm
        transition-all duration-200
        hover:-translate-y-0.5 hover:shadow-md
        active:scale-[0.98]
        ${statusStyles[learning_status]}
        ${isPending ? 'opacity-50 grayscale' : ''}
      `}
    >
      <div className="p-4 md:p-5">
        {/* Header: ID + Title */}
        <div className="flex items-start gap-3">
          <span className="shrink-0 font-brand text-lg font-bold text-primary">
            #{faq_id}
          </span>
          <Link
            href={`/faq/${faq_id}`}
            className="flex-1 text-base font-medium leading-snug text-text hover:text-primary line-clamp-2"
          >
            {lang === "en" && faq.questionEn ? faq.questionEn : faq.question}
          </Link>
        </div>

        {/* Summary */}
        {faq.answerBrief && (
          <p className="mt-2 text-sm text-subtext line-clamp-2">
            {lang === "en" && faq.answerBriefEn ? faq.answerBriefEn : faq.answerBrief}
          </p>
        )}

        {/* Metadata row */}
        <div className="mt-3 flex items-center gap-2 text-xs text-subtext">
          {faq.difficulty && (
            <span className="capitalize">{faq.difficulty}</span>
          )}
          {faq.difficulty && faq.upvoteCount > 0 && (
            <span>·</span>
          )}
          {faq.upvoteCount > 0 && (
            <span>{faq.upvoteCount} votes</span>
          )}
          {(faq.difficulty || faq.upvoteCount > 0) && faq.date && (
            <span>·</span>
          )}
          {faq.date && (
            <span>{faq.date}</span>
          )}
        </div>

        {/* Tags */}
        {faq.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {faq.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-primary"
              >
                {translateTag(tag, lang)}
              </span>
            ))}
            {faq.tags.length > 3 && (
              <span className="text-xs text-subtext">+{faq.tags.length - 3}</span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex items-center gap-2">
          {showMasterButton && (
            <button
              onClick={() => onUpdateStatus(faq_id, 'mastered')}
              className="flex-1 rounded-full border border-green-500 py-2 text-sm font-medium text-green-600 hover:bg-green-50 transition-colors"
            >
              {t("markAsMastered", lang)}
            </button>
          )}
          {!showMasterButton && learning_status === 'unread' && (
            <button
              onClick={() => onUpdateStatus(faq_id, 'learning')}
              className="flex-1 rounded-full bg-primary py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
            >
              {t("startLearning", lang)}
            </button>
          )}
          <button
            onClick={() => onToggleFavorite(faq_id)}
            className="flex items-center justify-center gap-1 rounded-full bg-amber-50 px-4 py-2 text-sm font-medium text-amber-600 hover:bg-amber-100 transition-colors"
            title={t("unfavorite", lang)}
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/>
            </svg>
            <span className="hidden sm:inline">{t("saved", lang)}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
```

**Step 2: Check TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add components/FavoriteCard.tsx
git commit -m "feat: add FavoriteCard component with new design"
```

---

## Task 2: Update ProfileClient with New Layout

**Files:**
- Modify: `app/profile/ProfileClient.tsx`

**Step 1: Add imports and client-side state**

Add to imports:
```tsx
import FavoriteCard from "@/components/FavoriteCard";
import Toast from "@/components/Toast";
import { useState, useCallback } from "react";
```

Add new state variables after existing state:
```tsx
const [filter, setFilter] = useState<'all' | 'unread' | 'learning' | 'mastered'>('all');
const [pendingRemovals, setPendingRemovals] = useState<Set<number>>(new Set());
const [toast, setToast] = useState<{ message: string; faqId: number } | null>(null);
```

**Step 2: Add client-side handlers**

Replace handleUpdateStatus with client-side version:
```tsx
const handleUpdateStatus = async (faqId: number, status: 'learning' | 'mastered') => {
  try {
    const res = await fetch(`/api/favorites/${faqId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      // Update local state instead of reloading
      setFavorites(prev => prev.map(f =>
        f.faq_id === faqId ? { ...f, learning_status: status } : f
      ));
      // Update stats
      setStats(prev => ({
        ...prev,
        unread: status === 'learning' ? prev.unread - 1 : prev.unread,
        learning: status === 'mastered' ? prev.learning - 1 : prev.learning + (status === 'learning' ? 1 : 0),
        mastered: status === 'mastered' ? prev.mastered + 1 : prev.mastered
      }));
    }
  } catch (error) {
    console.error('Failed to update status:', error);
  }
};
```

Add favorite toggle handler:
```tsx
const handleToggleFavorite = async (faqId: number) => {
  try {
    const res = await fetch(`/api/faq/${faqId}/favorite`, { method: 'POST' });
    if (res.ok) {
      const { favorited } = await res.json();
      if (!favorited) {
        setPendingRemovals(prev => new Set(prev).add(faqId));
        setToast({ message: t("removedFromFavorites", lang), faqId });
      }
    }
  } catch (error) {
    console.error('Failed to toggle favorite:', error);
  }
};

const handleUndo = async (faqId: number) => {
  try {
    const res = await fetch(`/api/faq/${faqId}/favorite`, { method: 'POST' });
    if (res.ok) {
      const { favorited } = await res.json();
      if (favorited) {
        setPendingRemovals(prev => {
          const next = new Set(prev);
          next.delete(faqId);
          return next;
        });
        setToast(null);
      }
    }
  } catch (error) {
    console.error('Failed to undo:', error);
  }
};

const handleToastClose = (faqId: number) => {
  if (pendingRemovals.has(faqId)) {
    setFavorites(prev => prev.filter(f => f.faq_id !== faqId));
    setStats(prev => ({
      ...prev,
      total: prev.total - 1,
      [favorites.find(f => f.faq_id === faqId)?.learning_status || 'unread']:
        prev[favorites.find(f => f.faq_id === faq_id)?.learning_status || 'unread'] - 1
    }));
    setPendingRemovals(prev => {
      const next = new Set(prev);
      next.delete(faqId);
      return next;
    });
  }
  setToast(null);
};
```

**Step 3: Replace stats cards with inline stats**

Replace the stats cards section (lines 84-97):
```tsx
{/* Stats */}
<p className="text-sm text-subtext">
  {t("totalFavorites", lang)} {stats.total} · {t("learningStatus", lang)} {stats.learning} · {t("masteredStatus", lang)} {stats.mastered}
</p>
```

**Step 4: Replace collapsible sections with filter tabs**

Replace the favorites list section (lines 117-158) with:
```tsx
{/* Filter Tabs */}
<div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
  {[
    { key: 'all', label: `${t("all", lang)} (${stats.total})` },
    { key: 'unread', label: `${t("unread", lang)} (${stats.unread})` },
    { key: 'learning', label: `${t("learning", lang)} (${stats.learning})` },
    { key: 'mastered', label: `${t("mastered", lang)} (${stats.mastered})` },
  ].map(({ key, label }) => (
    <button
      key={key}
      onClick={() => setFilter(key as typeof filter)}
      className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
        filter === key
          ? 'bg-primary text-white'
          : 'bg-surface text-subtext hover:bg-bg'
      }`}
    >
      {label}
    </button>
  ))}
</div>

{/* Favorites List */}
{filteredFavorites.length === 0 ? (
  <div className="py-16 text-center">
    <p className="text-subtext">{t("noFavorites", lang)}</p>
  </div>
) : (
  <div className="space-y-4">
    {filteredFavorites.map(item => (
      <FavoriteCard
        key={item.faq_id}
        item={item}
        lang={lang}
        onUpdateStatus={handleUpdateStatus}
        onToggleFavorite={handleToggleFavorite}
        showMasterButton={item.learning_status === 'learning'}
        isPending={pendingRemovals.has(item.faq_id)}
      />
    ))}
  </div>
)}
```

**Step 5: Add filtered favorites computation**

Add before return statement:
```tsx
const filteredFavorites = favorites
  .filter(f => filter === 'all' || f.learning_status === filter)
  .filter(f => !pendingRemovals.has(f.faq_id));
```

**Step 6: Add Toast component**

Add after header section:
```tsx
{/* Toast */}
{toast && (
  <Toast
    message={toast.message}
    action={{ label: t("undo", lang), onClick: () => handleUndo(toast.faqId) }}
    onClose={() => handleToastClose(toast.faqId)}
    duration={5000}
  />
)}
```

**Step 7: Remove FavoritesSection component**

Delete the FavoritesSection function (lines 167-215).

**Step 8: Check TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 9: Commit**

```bash
git add app/profile/ProfileClient.tsx
git commit -m "feat(profile): redesign with filter tabs and new FavoriteCard"
```

---

## Task 3: Add Missing i18n Keys

**Files:**
- Modify: `lib/i18n.ts` (or wherever translations are defined)

**Step 1: Add new translation keys**

```typescript
all: { zh: '全部', en: 'All' },
startLearning: { zh: '开始学习', en: 'Start Learning' },
saved: { zh: '已收藏', en: 'Saved' },
noFavorites: { zh: '暂无收藏', en: 'No favorites yet' },
removedFromFavorites: { zh: '已从收藏移除', en: 'Removed from favorites' },
undo: { zh: '撤销', en: 'Undo' },
```

**Step 2: Commit**

```bash
git add lib/i18n.ts
git commit -m "feat(i18n): add profile page translation keys"
```

---

## Task 4: Test and Verify

**Step 1: Run development server**

Run: `npm run dev`
Expected: Server starts without errors

**Step 2: Manual testing checklist**

- [ ] Profile page loads without errors
- [ ] Favorite cards display with new design (shadows, rounded corners)
- [ ] Status colors show correctly (blue for learning, green for mastered)
- [ ] Filter tabs work (all/unread/learning/mastered)
- [ ] Clicking favorite item navigates to /faq/[id]
- [ ] "开始学习" button works for unread items
- [ ] "标记已掌握" button works for learning items
- [ ] Remove favorite shows toast with undo
- [ ] Undo restores the item
- [ ] Mobile view looks good (cards full width, touch targets adequate)

**Step 3: Build verification**

Run: `npm run build`
Expected: Build succeeds without errors

**Step 4: Commit any fixes**

```bash
git add .
git commit -m "fix: address review feedback"
```

---

## Summary

| Task | File(s) | Lines Changed |
|------|---------|---------------|
| 1 | `components/FavoriteCard.tsx` | +130 (new file) |
| 2 | `app/profile/ProfileClient.tsx` | ~150 modified |
| 3 | `lib/i18n.ts` | +6 keys |

**Key Changes:**
- New FavoriteCard component with shadows, rounded-2xl, status-based left border
- Horizontal filter tabs instead of collapsible sections
- Client-side filtering and state updates (no page reload)
- Toast with undo for removing favorites
- Mobile-optimized touch targets and layout
