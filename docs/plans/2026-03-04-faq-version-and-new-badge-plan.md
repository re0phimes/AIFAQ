# FAQ Version Semantics + New Badge Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure first review remains `v1`, add homepage `新增` badge (created within 7 days), keep `新增` and `30天内有更新` simultaneously visible, and backfill historical mis-versioned records safely.

**Architecture:** Fix version increment semantics centrally in `lib/db.ts` so all ingest/review paths behave consistently. Add a one-time migration script with dry-run/apply modes to correct historical version offsets. Extend homepage data mapping and FAQ item UI to render a distinct “新增” badge while preserving existing update badge logic.

**Tech Stack:** Next.js App Router, TypeScript, Vercel Postgres (`@vercel/postgres`), node:test contract tests (`tsx --test`), ESLint.

---

### Task 1: Lock expected behavior with failing contract tests

**Files:**
- Create: `scripts/faq-version-semantics-contract.test.ts`
- Create: `scripts/faq-new-badge-contract.test.ts`
- Create: `scripts/faq-version-backfill-contract.test.ts`

**Step 1: Write failing test for DB version semantics**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const db = fs.readFileSync("lib/db.ts", "utf8");

test("first review does not bump current_version", () => {
  assert.match(db, /shouldBumpVersion|hasExistingAnswer/);
  assert.match(db, /current_version\s*=\s*\$\{newVersion\}/);
});
```

**Step 2: Write failing test for homepage new badge behavior**

```ts
const faqItem = fs.readFileSync("components/FAQItem.tsx", "utf8");
assert.match(faqItem, /isNewlyCreated/);
assert.match(faqItem, /createdAt/);
assert.match(faqItem, /t\("newlyAdded"/);
```

**Step 3: Write failing test for backfill script skeleton and safety flags**

```ts
const script = fs.readFileSync("tools/faq-sync/fix-version-offset.ts", "utf8");
assert.match(script, /--dry-run/);
assert.match(script, /--apply/);
assert.match(script, /manual_review/);
```

**Step 4: Run tests to verify they fail**

Run:
```bash
npx tsx --test scripts/faq-version-semantics-contract.test.ts
npx tsx --test scripts/faq-new-badge-contract.test.ts
npx tsx --test scripts/faq-version-backfill-contract.test.ts
```

Expected: FAIL (new behaviors not implemented yet).

**Step 5: Commit**

```bash
git add scripts/faq-version-semantics-contract.test.ts scripts/faq-new-badge-contract.test.ts scripts/faq-version-backfill-contract.test.ts
git commit -m "test: add contracts for version semantics and new badge"
```

---

### Task 2: Fix core version increment semantics in DB update path

**Files:**
- Modify: `lib/db.ts`
- Test: `scripts/faq-version-semantics-contract.test.ts`

**Step 1: Implement explicit bump guard in `updateFaqStatus` answer branch**

```ts
const hasExistingAnswer = Boolean(current?.answer?.trim());
const shouldBumpVersion = hasExistingAnswer;
const oldVersion = current?.current_version ?? 1;
const newVersion = shouldBumpVersion ? oldVersion + 1 : oldVersion;

if (shouldBumpVersion) {
  await createVersion(id, oldVersion, { ... });
}
```

**Step 2: Ensure SQL update only sets `last_updated_at` when bumped**

```ts
last_updated_at = ${shouldBumpVersion ? new Date().toISOString() : current?.last_updated_at ?? null}
```

(Equivalent SQL pattern acceptable; requirement is no first-review update timestamp inflation.)

**Step 3: Run targeted contract test**

Run:
```bash
npx tsx --test scripts/faq-version-semantics-contract.test.ts
```

Expected: PASS.

**Step 4: Run quick regression contracts touching review/publish flows**

Run:
```bash
npx tsx --test scripts/faq-level-review-ui-contract.test.ts
npx tsx --test scripts/faq-level-admin-api-contract.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add lib/db.ts
git commit -m "fix: keep first review at version v1"
```

---

### Task 3: Add homepage “新增” badge data + rendering

**Files:**
- Modify: `src/types/faq.ts`
- Modify: `app/page.tsx`
- Modify: `components/FAQItem.tsx`
- Modify: `lib/i18n.ts`
- Test: `scripts/faq-new-badge-contract.test.ts`

**Step 1: Extend FAQ type with created timestamp used by UI**

```ts
createdAt?: string;
```

**Step 2: Map DB `created_at` to `FAQItem` in homepage loader**

```ts
createdAt: item.created_at?.toISOString(),
```

**Step 3: Add i18n key for new badge**

```ts
newlyAdded: { zh: "新增", en: "New" }
```

**Step 4: Implement badge condition in `FAQItem`**

```ts
const isNewlyCreated = item.createdAt &&
  (RENDER_TIME_TS - new Date(item.createdAt).getTime()) < 7 * 24 * 60 * 60 * 1000;
```

Render badge near existing update badge with distinct style.

**Step 5: Preserve simultaneous badge display**

Do not use `else` between `isNewlyCreated` and `isRecentlyUpdated`; render both independently.

**Step 6: Run targeted contract test**

Run:
```bash
npx tsx --test scripts/faq-new-badge-contract.test.ts
```

Expected: PASS.

**Step 7: Commit**

```bash
git add src/types/faq.ts app/page.tsx components/FAQItem.tsx lib/i18n.ts
git commit -m "feat: add newly created badge on homepage faq list"
```

---

### Task 4: Implement historical version-offset backfill script

**Files:**
- Create: `tools/faq-sync/fix-version-offset.ts`
- Modify: `package.json` (add script alias)
- Test: `scripts/faq-version-backfill-contract.test.ts`

**Step 1: Create script CLI options and mode guards**

```ts
// --dry-run (default), --apply required for writes
```

**Step 2: Add candidate selection query (conservative)**

- Candidate patterns:
1. `current_version = 2` and no `faq_versions`
2. `current_version >= 3`, no `version=1`, and version series starts from `2`

- Uncertain rows should be emitted as `manual_review` and skipped.

**Step 3: Add transaction-safe rewrite per FAQ**

Two-phase update to avoid unique conflicts:

```sql
UPDATE faq_versions SET version = version + 1000 WHERE faq_id = $1 AND version >= 2;
UPDATE faq_versions SET version = version - 1001 WHERE faq_id = $1 AND version >= 1002;
UPDATE faq_items SET current_version = current_version - 1 WHERE id = $1;
```

For `current_version=2` with zero versions: only decrement `current_version`.

**Step 4: Emit JSON report**

```json
{
  "mode": "dry-run|apply",
  "fixed": [...],
  "manual_review": [...],
  "skipped": [...]
}
```

**Step 5: Add npm script**

```json
"faq:fix-version-offset": "npx tsx -r ./scripts/env-loader.js tools/faq-sync/fix-version-offset.ts"
```

**Step 6: Run targeted contract test**

Run:
```bash
npx tsx --test scripts/faq-version-backfill-contract.test.ts
```

Expected: PASS.

**Step 7: Dry-run script check**

Run:
```bash
npm run faq:fix-version-offset -- --dry-run
```

Expected: report output only, no DB writes.

**Step 8: Commit**

```bash
git add tools/faq-sync/fix-version-offset.ts package.json
git commit -m "feat: add backfill script for faq version offset"
```

---

### Task 5: End-to-end verification and rollout checklist

**Files:**
- Modify (if needed): `docs/plans/2026-03-04-faq-version-and-new-badge-plan.md` (append runbook notes)

**Step 1: Run full targeted contracts**

Run:
```bash
npx tsx --test scripts/faq-version-semantics-contract.test.ts
npx tsx --test scripts/faq-new-badge-contract.test.ts
npx tsx --test scripts/faq-version-backfill-contract.test.ts
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

Expected: 0 errors (warnings may remain if pre-existing).

**Step 3: Backfill rollout procedure**

Run:
```bash
npm run faq:fix-version-offset -- --dry-run
# Review report and sample rows
npm run faq:fix-version-offset -- --apply
```

Expected: deterministic report with fixed/manual_review counts.

**Step 4: Manual product check**

1. Create/import one FAQ -> first review version remains `v1`.
2. Edit/push update -> version changes to `v2` and update badge eligible.
3. FAQ within 7 days shows `新增`.
4. Newly created and updated within windows shows both badges.

**Step 5: Final commit (if any verification-doc updates)**

```bash
git add docs/plans/2026-03-04-faq-version-and-new-badge-plan.md
git commit -m "docs: add rollout checklist for version semantic fix"
```

---

## Notes

- Execute implementation in a dedicated worktree.
- Run migration in dry-run mode first; never start with apply.
- If `manual_review` count is non-trivial, pause and inspect before apply.
