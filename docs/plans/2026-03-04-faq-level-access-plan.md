# FAQ Level Access Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add FAQ `level` access control so free users (including anonymous) only see L1, while premium/admin can view and filter L1/L2, and admin can edit level in review with immediate effect.

**Architecture:** Introduce a first-class `level` column on `faq_items`, centralize visibility decisions in a small access-policy helper, and enforce access at every read/write entry point (home list, detail page, favorites, vote/favorite APIs). Keep admin review as the only level-edit entry. UI filtering for L1/L2 is exposed only to premium/admin.

**Tech Stack:** Next.js App Router, TypeScript, `@vercel/postgres`, NextAuth v5, node:test via `tsx --test`.

---

Related skills for execution:
- `@superpowers:using-git-worktrees`
- `@superpowers:test-driven-development`
- `@superpowers:verification-before-completion`

### Task 0: Create Dedicated Worktree

**Files:**
- Create: none
- Modify: none
- Test: none

**Step 1: Create isolated branch + worktree**

Run:
```bash
git worktree add ../AIFAQ-faq-level-access -b feat/faq-level-access
```

Expected: new directory `../AIFAQ-faq-level-access` checked out on `feat/faq-level-access`.

**Step 2: Verify clean worktree state**

Run:
```bash
cd ../AIFAQ-faq-level-access
git status --short
```

Expected: no unexpected local modifications.

**Step 3: Commit checkpoint (optional)**

No commit yet. Start implementation in this worktree only.

### Task 1: Add Access Policy Helper (TDD First)

**Files:**
- Create: `lib/faq-level-access.ts`
- Create: `lib/faq-level-access.test.ts`
- Modify: `types/next-auth.d.ts`

**Step 1: Write failing tests for visibility + filter normalization**

Add tests in `lib/faq-level-access.test.ts` for:
- free/anonymous can only access level 1
- premium can access level 1 and 2
- admin can access level 1 and 2
- invalid requested filter falls back to safe default
- free requesting `all` or `2` becomes `1`
- premium/admin requested `all|1|2` is respected

Test skeleton:
```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  canAccessFaqLevel,
  normalizeFaqLevelFilter,
  resolveAllowedLevels,
} from "./faq-level-access";
```

**Step 2: Run tests to verify they fail**

Run:
```bash
npx tsx --test lib/faq-level-access.test.ts
```

Expected: FAIL (module/functions missing).

**Step 3: Implement minimal access helper**

Implement in `lib/faq-level-access.ts`:
```ts
export type ViewerAccess = {
  role?: "admin" | "user";
  tier?: "free" | "premium";
};

export function canAccessFaqLevel(viewer: ViewerAccess | null | undefined, level: number): boolean;
export function normalizeFaqLevelFilter(
  viewer: ViewerAccess | null | undefined,
  requested: string | null | undefined
): 1 | 2 | "all";
export function resolveAllowedLevels(
  viewer: ViewerAccess | null | undefined,
  requested?: string | null
): number[];
```

Rules:
- anonymous treated as free
- free -> `[1]`
- premium/admin -> `[1,2]` by default; filter narrows as requested

**Step 4: Re-run tests**

Run:
```bash
npx tsx --test lib/faq-level-access.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add lib/faq-level-access.ts lib/faq-level-access.test.ts types/next-auth.d.ts
git commit -m "feat: add FAQ level access policy helper"
```

### Task 2: Add `level` to DB Schema and Data Model (TDD First)

**Files:**
- Modify: `lib/db.ts`
- Modify: `src/types/faq.ts`
- Create: `scripts/faq-level-db-contract.test.ts`

**Step 1: Write failing contract test for DB/type wiring**

Create `scripts/faq-level-db-contract.test.ts` to assert source-level contract:
- `lib/db.ts` contains `ALTER TABLE faq_items ADD COLUMN IF NOT EXISTS level`
- `CHECK (level IN (1,2))` exists
- `DBFaqItem` includes `level`
- `rowToFaqItem` maps `level`
- `src/types/faq.ts` includes `level?: 1 | 2`

Use file-read assertions like existing contract tests.

**Step 2: Run tests to verify they fail**

Run:
```bash
npx tsx --test scripts/faq-level-db-contract.test.ts
```

Expected: FAIL (level not yet present).

**Step 3: Implement DB and type changes**

In `lib/db.ts`:
- add schema migration:
```sql
ALTER TABLE faq_items ADD COLUMN IF NOT EXISTS level SMALLINT DEFAULT 1;
ALTER TABLE faq_items ADD CONSTRAINT faq_items_level_check CHECK (level IN (1,2));
UPDATE faq_items SET level = 1 WHERE level IS NULL;
ALTER TABLE faq_items ALTER COLUMN level SET NOT NULL;
```
- extend `DBFaqItem` with `level: 1 | 2`
- map `level` in `rowToFaqItem`
- add helper:
```ts
export async function updateFaqLevel(id: number, level: 1 | 2): Promise<void>
```

In `src/types/faq.ts`:
- add `level?: 1 | 2` to `FAQItem`.

**Step 4: Re-run tests**

Run:
```bash
npx tsx --test scripts/faq-level-db-contract.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add lib/db.ts src/types/faq.ts scripts/faq-level-db-contract.test.ts
git commit -m "feat: add FAQ level field to DB model"
```

### Task 3: Enforce Level Access on Public List + Detail (TDD First)

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/faq/[id]/page.tsx`
- Modify: `lib/db.ts`
- Create: `scripts/faq-level-public-access-contract.test.ts`

**Step 1: Write failing contract test for server-side gating**

Create `scripts/faq-level-public-access-contract.test.ts` assertions:
- `app/page.tsx` reads session (`auth`/`getServerSession`) before mapping items
- list logic applies allowed levels from helper
- `app/faq/[id]/page.tsx` denies access (calls `notFound`) when level not accessible

**Step 2: Run contract test and see fail**

Run:
```bash
npx tsx --test scripts/faq-level-public-access-contract.test.ts
```

Expected: FAIL.

**Step 3: Implement list + detail access checks**

In `app/page.tsx`:
- read session server-side
- derive allowed levels with `resolveAllowedLevels(session?.user, "all")`
- only include items with `item.level` in allowed set

In `app/faq/[id]/page.tsx`:
- fetch session before rendering
- if FAQ level inaccessible -> `notFound()`

Optional DB helper addition in `lib/db.ts` to avoid duplicate filtering:
```ts
export async function getPublishedFaqItemsByLevels(levels: number[]): Promise<DBFaqItem[]>
```

**Step 4: Re-run contract test**

Run:
```bash
npx tsx --test scripts/faq-level-public-access-contract.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add app/page.tsx app/faq/[id]/page.tsx lib/db.ts scripts/faq-level-public-access-contract.test.ts
git commit -m "feat: enforce FAQ level access on public list and detail"
```

### Task 4: Guard Favorite/Vote/Profile Paths Against L2 Leakage

**Files:**
- Modify: `app/api/faq/[id]/favorite/route.ts`
- Modify: `app/api/faq/[id]/vote/route.ts`
- Modify: `app/api/favorites/[id]/status/route.ts`
- Modify: `app/api/user/favorites/route.ts`
- Modify: `app/profile/page.tsx`
- Create: `scripts/faq-level-user-paths-contract.test.ts`

**Step 1: Write failing contract test for protected user paths**

Assertions:
- favorite/vote/status routes check FAQ level access before action
- user favorites API/profile query excludes inaccessible levels for free

**Step 2: Run test to verify fail**

Run:
```bash
npx tsx --test scripts/faq-level-user-paths-contract.test.ts
```

Expected: FAIL.

**Step 3: Implement guards**

Use `canAccessFaqLevel` with session viewer info:
- `favorite`/`vote`/`status`: reject with `403` if target FAQ is L2 for free
- `user favorites` and `profile` SQL: add `fi.level = ANY($2)` using resolved levels

Minimal check pattern:
```ts
if (!canAccessFaqLevel(viewer, faq.level)) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

**Step 4: Re-run contract test**

Run:
```bash
npx tsx --test scripts/faq-level-user-paths-contract.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add app/api/faq/[id]/favorite/route.ts app/api/faq/[id]/vote/route.ts app/api/favorites/[id]/status/route.ts app/api/user/favorites/route.ts app/profile/page.tsx scripts/faq-level-user-paths-contract.test.ts
git commit -m "feat: enforce FAQ level access across favorite and vote paths"
```

### Task 5: Add Admin Level Edit API

**Files:**
- Modify: `app/api/admin/faq/[id]/route.ts`
- Modify: `lib/db.ts`
- Create: `scripts/faq-level-admin-api-contract.test.ts`

**Step 1: Write failing contract test for admin level update action**

Assertions:
- admin patch route accepts a level update payload/action
- level validated to `1|2`
- calls DB level update helper

**Step 2: Run contract test and confirm fail**

Run:
```bash
npx tsx --test scripts/faq-level-admin-api-contract.test.ts
```

Expected: FAIL.

**Step 3: Implement admin level update path**

In `app/api/admin/faq/[id]/route.ts`:
- add action:
```ts
if (body.action === "set_level") { ... }
```
- validate `body.level` in `[1,2]`
- call `updateFaqLevel(numId, body.level)`
- return updated FAQ item

**Step 4: Re-run contract test**

Run:
```bash
npx tsx --test scripts/faq-level-admin-api-contract.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add app/api/admin/faq/[id]/route.ts lib/db.ts scripts/faq-level-admin-api-contract.test.ts
git commit -m "feat: add admin API to update FAQ level"
```

### Task 6: Update Admin Review UI (Filter + Edit Level)

**Files:**
- Modify: `app/admin/review/page.tsx`
- Create: `scripts/faq-level-review-ui-contract.test.ts`

**Step 1: Write failing UI contract test**

Assertions:
- review list has level filter tabs/select: `all|1|2`
- item type includes `level`
- detail panel has level control
- changing level calls PATCH with `action: "set_level"`

**Step 2: Run test to see fail**

Run:
```bash
npx tsx --test scripts/faq-level-review-ui-contract.test.ts
```

Expected: FAIL.

**Step 3: Implement review UI changes**

In `app/admin/review/page.tsx`:
- extend `FaqItem` with `level: 1 | 2`
- add `levelFilter` state
- apply combined filter (status + level + search)
- add detail-level toggle button group (`L1`, `L2`)
- on click:
```ts
fetch(`/api/admin/faq/${id}`, {
  method: "PATCH",
  body: JSON.stringify({ action: "set_level", level: 2 }),
})
```

**Step 4: Re-run UI contract test**

Run:
```bash
npx tsx --test scripts/faq-level-review-ui-contract.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add app/admin/review/page.tsx scripts/faq-level-review-ui-contract.test.ts
git commit -m "feat: add FAQ level filter and editor in review UI"
```

### Task 7: Add Premium/Admin L1-L2 Filter on Front Page

**Files:**
- Modify: `components/FAQList.tsx`
- Modify: `app/FAQPage.tsx`
- Modify: `lib/i18n.ts`
- Create: `scripts/faq-level-home-ui-contract.test.ts`

**Step 1: Write failing UI contract test for front-page filter behavior**

Assertions:
- `FAQList` includes `levelFilter` state
- filter controls only render for premium/admin
- filtering uses `item.level` with default fallback to 1

**Step 2: Run test and verify fail**

Run:
```bash
npx tsx --test scripts/faq-level-home-ui-contract.test.ts
```

Expected: FAIL.

**Step 3: Implement premium/admin filter controls**

In `app/FAQPage.tsx`:
- pass role + tier into `FAQList` session prop typing

In `components/FAQList.tsx`:
- add control group `All / L1 / L2`
- render only when:
```ts
const canUseLevelFilter = session?.user?.tier === "premium" || session?.user?.role === "admin";
```
- apply additional client filter:
```ts
const normalizedLevel = item.level ?? 1;
```

In `lib/i18n.ts`:
- add labels for `levelAll`, `level1`, `level2`.

**Step 4: Re-run UI contract test**

Run:
```bash
npx tsx --test scripts/faq-level-home-ui-contract.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add components/FAQList.tsx app/FAQPage.tsx lib/i18n.ts scripts/faq-level-home-ui-contract.test.ts
git commit -m "feat: add L1/L2 filter for premium and admin users"
```

### Task 8: Final Verification and Documentation

**Files:**
- Modify: `README.md` (if access model section exists; otherwise skip)
- Modify: `docs/plans/2026-03-04-faq-level-access-design.md` (optional decision note)

**Step 1: Run full targeted test suite**

Run:
```bash
npx tsx --test lib/faq-level-access.test.ts
npx tsx --test scripts/faq-level-db-contract.test.ts
npx tsx --test scripts/faq-level-public-access-contract.test.ts
npx tsx --test scripts/faq-level-user-paths-contract.test.ts
npx tsx --test scripts/faq-level-admin-api-contract.test.ts
npx tsx --test scripts/faq-level-review-ui-contract.test.ts
npx tsx --test scripts/faq-level-home-ui-contract.test.ts
```

Expected: all PASS.

**Step 2: Run lint**

Run:
```bash
npm run lint
```

Expected: no lint errors.

**Step 3: Manual verification checklist**

1. Anonymous home: no L1/L2 filter, only L1 items
2. Free login home: no L1/L2 filter, only L1 items
3. Premium login home: has `All/L1/L2`, filter works
4. Admin review: level filter works and level toggle persists immediately
5. Free opens direct `/faq/<l2-id>`: gets 404/not found

**Step 4: Commit docs/update notes**

```bash
git add README.md docs/plans/2026-03-04-faq-level-access-design.md
git commit -m "docs: document FAQ level access behavior"
```

(If no doc change needed, skip this commit.)

**Step 5: Prepare PR summary**

Include:
- schema change
- access policy matrix
- admin operations
- verification evidence (test/lint output snippets)

