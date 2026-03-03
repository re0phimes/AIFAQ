# Favorites Reminder And Typography Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship a unified 14-day favorite reminder flow and card relative-time display across profile page + API, and reduce oversized typography in profile-related UI.

**Architecture:** Add a shared domain helper in `lib/favorite-reminder.ts` for reminder/stat calculations, then wire both `app/profile/page.tsx` and `app/api/user/favorites/route.ts` to use it. Keep `ProfileClient`/`FavoriteCard` focused on rendering precomputed fields and apply scoped typography adjustments in profile UI components.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Node test runner (`node:test`), Tailwind CSS

---

### Task 1: Add Failing Tests For Reminder Domain Logic

**Files:**
- Create: `lib/favorite-reminder.test.ts`

**Step 1: Write failing tests first**

Cover:
1. `last_viewed_at` precedence over `created_at`
2. `elapsedDays` boundary: 13/14/15 days
3. status gating (`unread`, `learning`, `mastered`)
4. relative time labels for zh/en (days/weeks)
5. invalid date fallback behavior

**Step 2: Run tests to verify RED**

Run: `node --test --import tsx lib/favorite-reminder.test.ts`  
Expected: FAIL with module/function missing errors.

**Step 3: Commit red test**

```bash
git add lib/favorite-reminder.test.ts
git commit -m "test(profile): add failing tests for favorite reminder domain rules"
```

### Task 2: Implement Shared Reminder Helper

**Files:**
- Create: `lib/favorite-reminder.ts`
- Modify: `lib/favorite-reminder.test.ts`

**Step 1: Implement minimal code to satisfy tests**

Implement:
1. `parseDateSafe`
2. `getReferenceDate`
3. `getElapsedDays`
4. `formatRelativeTime`
5. `shouldShowNudge`
6. `computeFavoriteStats`
7. `enrichFavoriteForDisplay`

**Step 2: Run tests to verify GREEN**

Run: `node --test --import tsx lib/favorite-reminder.test.ts`  
Expected: PASS.

**Step 3: Commit helper**

```bash
git add lib/favorite-reminder.ts lib/favorite-reminder.test.ts
git commit -m "feat(profile): add shared favorite reminder domain helper"
```

### Task 3: Wire Profile Server Page To Shared Helper

**Files:**
- Modify: `app/profile/page.tsx`

**Step 1: Update mapping + stats source**

1. Enrich favorites with `relative_time_label` and `needs_nudge`
2. Replace local 90-day stale calculation with `computeFavoriteStats`
3. Keep payload compatible with existing client (`stats.stale` retained)

**Step 2: Run targeted checks**

Run: `npm run build`  
Expected: no TypeScript errors from `app/profile/page.tsx`.

**Step 3: Commit**

```bash
git add app/profile/page.tsx
git commit -m "refactor(profile): use shared reminder stats on profile page"
```

### Task 4: Wire Favorites API To Shared Helper

**Files:**
- Modify: `app/api/user/favorites/route.ts`

**Step 1: Replace duplicated reminder logic**

1. Enrich returned favorites with `relative_time_label` and `needs_nudge`
2. Use `computeFavoriteStats` for API `stats`

**Step 2: Verify**

Run: `npm run build`  
Expected: route compiles and uses shared helper types safely.

**Step 3: Commit**

```bash
git add app/api/user/favorites/route.ts
git commit -m "refactor(api): share favorite reminder calculation logic"
```

### Task 5: Render Relative Time And Nudge Badge In FavoriteCard

**Files:**
- Modify: `components/FavoriteCard.tsx`
- Modify: `app/profile/ProfileClient.tsx`
- Modify: `lib/i18n.ts`

**Step 1: Plumb display fields**

1. Extend favorite item props with `relative_time_label` and `needs_nudge`
2. Render relative-time text row in card
3. Render nudge badge for overdue `unread|learning`
4. Add i18n keys for new label/badge text if missing

**Step 2: Verify**

Run: `npm run build`  
Expected: no typing errors for the new favorite item shape.

**Step 3: Commit**

```bash
git add components/FavoriteCard.tsx app/profile/ProfileClient.tsx lib/i18n.ts
git commit -m "feat(profile): show relative time and 14-day reminder badge in favorite cards"
```

### Task 6: Typography Density Pass

**Files:**
- Modify: `app/profile/ProfileClient.tsx`
- Modify: `components/FavoriteCard.tsx`
- Modify: `components/FAQItem.tsx`

**Step 1: Apply text-scale reductions**

1. Reduce profile title and summary text size where oversized
2. Reduce card title/status/tag typography one level
3. Reduce FAQ item title/meta text one level while preserving readability
4. Keep button hit areas and spacing practical on mobile

**Step 2: Verify**

Run: `npm run build`  
Expected: build passes and class updates compile.

**Step 3: Commit**

```bash
git add app/profile/ProfileClient.tsx components/FavoriteCard.tsx components/FAQItem.tsx
git commit -m "style(profile): tighten typography scale for denser reading layout"
```

### Task 7: Final Verification

**Files:**
- Verify only

**Step 1: Run full checks**

```bash
node --test --import tsx lib/favorite-reminder.test.ts
npm run build
git status -sb
```

Expected:
1. Reminder unit tests pass
2. Build passes
3. Only intended files changed

**Step 2: Final commit (if needed)**

```bash
git add -A
git commit -m "feat(profile): ship unified reminder logic and typography refinement"
```

## Verification Checklist

- [ ] Shared reminder logic exists in `lib/favorite-reminder.ts`
- [ ] Test suite verifies 14-day boundary and status gating
- [ ] Profile page and API use the same stats/reminder logic
- [ ] Favorite card displays relative time and nudge badge
- [ ] Typography reductions applied in profile/favorite/faq components
- [ ] `npm run build` passes
