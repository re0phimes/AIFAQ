# FAQ Taxonomy Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current mixed `categories/tags` taxonomy with the approved learner-oriented taxonomy: 8 fixed primary categories, 1 optional secondary category, and controlled facet groups for `pattern`, `topic`, and `tool_stack`.

**Architecture:** Introduce a single canonical taxonomy source file with bilingual metadata and stable keys. Extend FAQ records and DB persistence to store `primary_category`, `secondary_category`, `patterns`, `topics`, and `tool_stack`, then migrate UI filters, preference storage, and AI-generation flows to read from the new schema while keeping legacy `tags` as searchable leaf tags.

**Tech Stack:** Next.js App Router, React 19, TypeScript, `@vercel/postgres`, Node `test`, `tsx`, ESLint

---

### Task 1: Introduce Canonical Taxonomy Source and Shared Helpers

**Files:**
- Create: `data/faq-taxonomy.json`
- Create: `lib/taxonomy.ts`
- Create: `lib/taxonomy.test.ts`
- Modify: `src/types/faq.ts`
- Modify: `lib/i18n.ts`

**Step 1: Write the failing helper tests**

Create `lib/taxonomy.test.ts` with coverage for:

- taxonomy load returns 8 primary categories
- primary category lookup works by stable `key`
- bilingual label lookup returns `zh` and `en`
- invalid category/facet values are rejected
- aliases normalize to canonical facet values

Example skeleton:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  getPrimaryCategory,
  getPrimaryCategoryOptions,
  normalizeFacetValue,
  isValidPrimaryCategoryKey,
} from "./taxonomy";

test("taxonomy exposes the approved primary categories", () => {
  const categories = getPrimaryCategoryOptions();
  assert.equal(categories.length, 8);
  assert.equal(categories[0]?.key, "fundamentals");
});

test("facet aliases normalize to canonical values", () => {
  assert.equal(normalizeFacetValue("topic", "KVCache"), "kv_cache");
});
```

**Step 2: Run test to verify it fails**

Run: `npx tsx --test lib/taxonomy.test.ts`

Expected: FAIL because `lib/taxonomy.ts` and `data/faq-taxonomy.json` do not exist yet.

**Step 3: Add the canonical taxonomy file and helper module**

Create `data/faq-taxonomy.json` with:

- `categories`: 8 primary categories with `key`, `zh`, `en`, `description`, `status`
- `facets.pattern`
- `facets.topic`
- `facets.tool_stack`
- optional `aliases` arrays for migration and normalization

Create `lib/taxonomy.ts` with:

- typed import of the taxonomy JSON
- lookup helpers for categories and facets
- validation helpers for route and AI prompt use
- translation helpers that replace hardcoded category/tag maps where possible

Update `src/types/faq.ts` to add stable taxonomy types such as:

```ts
export interface TaxonomyCategory {
  key: string;
  zh: string;
  en: string;
  description: string;
}

export interface FAQItem {
  // existing fields...
  primaryCategory: string;
  secondaryCategory?: string | null;
  patterns: string[];
  topics: string[];
  toolStack: string[];
}
```

Trim `lib/i18n.ts` so UI strings stay there, but taxonomy display names come from `lib/taxonomy.ts`.

**Step 4: Run tests and lint**

Run: `npx tsx --test lib/taxonomy.test.ts`

Expected: PASS

Run: `npm run lint -- lib/taxonomy.ts lib/taxonomy.test.ts src/types/faq.ts lib/i18n.ts`

Expected: no lint errors

**Step 5: Commit**

```bash
git add data/faq-taxonomy.json lib/taxonomy.ts lib/taxonomy.test.ts src/types/faq.ts lib/i18n.ts
git commit -m "feat(taxonomy): add canonical FAQ taxonomy source"
```

### Task 2: Extend FAQ Persistence and Runtime Types for the New Taxonomy

**Files:**
- Modify: `lib/db.ts`
- Modify: `src/types/faq.ts`
- Modify: `app/page.tsx`
- Modify: `app/faq/[id]/page.tsx`
- Modify: `app/profile/page.tsx`
- Modify: `app/admin/review/page.tsx`
- Create: `lib/faq-taxonomy-record.test.ts`

**Step 1: Write the failing record-shape tests**

Create `lib/faq-taxonomy-record.test.ts` to cover:

- DB row normalization returns empty arrays for `patterns`, `topics`, `tool_stack`
- missing `secondary_category` normalizes to `null`
- app-facing FAQ item mapping exposes `primaryCategory` and `secondaryCategory`

Example skeleton:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeFaqTaxonomyFields } from "./taxonomy";

test("normalizes nullable taxonomy fields from DB rows", () => {
  const normalized = normalizeFaqTaxonomyFields({
    primary_category: "model_architecture",
    secondary_category: null,
    patterns: null,
    topics: ["rope"],
    tool_stack: null,
  });

  assert.equal(normalized.primaryCategory, "model_architecture");
  assert.equal(normalized.secondaryCategory, null);
  assert.deepEqual(normalized.patterns, []);
  assert.deepEqual(normalized.topics, ["rope"]);
  assert.deepEqual(normalized.toolStack, []);
});
```

**Step 2: Run test to verify it fails**

Run: `npx tsx --test lib/faq-taxonomy-record.test.ts`

Expected: FAIL because normalization helpers and fields do not exist yet.

**Step 3: Add DB columns and propagate them through runtime mapping**

Modify `lib/db.ts` to:

- add `primary_category TEXT`
- add `secondary_category TEXT`
- add `patterns TEXT[] DEFAULT '{}'`
- add `topics TEXT[] DEFAULT '{}'`
- add `tool_stack TEXT[] DEFAULT '{}'`
- update `DBFaqItem`
- update `rowToFaqItem`
- update `updateFaqStatus`
- keep legacy `categories` temporarily only where backward compatibility is required during migration

Update page-level mappers in:

- `app/page.tsx`
- `app/faq/[id]/page.tsx`
- `app/profile/page.tsx`
- `app/admin/review/page.tsx`

so they pass the new fields through to the client instead of relying on old `categories`.

**Step 4: Run tests, type checks, and a build smoke test**

Run: `npx tsx --test lib/faq-taxonomy-record.test.ts`

Expected: PASS

Run: `npm run lint -- lib/db.ts app/page.tsx app/faq/[id]/page.tsx app/profile/page.tsx app/admin/review/page.tsx src/types/faq.ts`

Expected: no lint errors

Run: `npm run build`

Expected: Next.js build completes without type failures

**Step 5: Commit**

```bash
git add lib/db.ts src/types/faq.ts app/page.tsx app/faq/[id]/page.tsx app/profile/page.tsx app/admin/review/page.tsx lib/faq-taxonomy-record.test.ts
git commit -m "feat(faq): add primary and secondary taxonomy fields"
```

### Task 3: Replace Legacy Category Filtering with Taxonomy-Aware UI Filters

**Files:**
- Modify: `components/TagFilter.tsx`
- Modify: `components/FAQList.tsx`
- Modify: `components/FAQItem.tsx`
- Modify: `components/DetailModal.tsx`
- Modify: `components/FavoriteCard.tsx`
- Modify: `components/ReadingView.tsx`
- Create: `scripts/faq-taxonomy-home-ui-contract.test.ts`

**Step 1: Write the failing UI contract test**

Create `scripts/faq-taxonomy-home-ui-contract.test.ts` to assert the home filter and FAQ card UI reference:

- primary/secondary categories from the new taxonomy helpers
- facet labels from the canonical taxonomy
- no direct import of `data/tag-taxonomy.json` in `components/FAQList.tsx` and `components/TagFilter.tsx`

Example skeleton:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("FAQ list no longer imports legacy tag taxonomy", () => {
  const source = fs.readFileSync("components/FAQList.tsx", "utf8");
  assert.equal(source.includes("tag-taxonomy.json"), false);
});
```

**Step 2: Run test to verify it fails**

Run: `npx tsx --test scripts/faq-taxonomy-home-ui-contract.test.ts`

Expected: FAIL because the home UI still imports `data/tag-taxonomy.json`.

**Step 3: Rebuild filtering and display around the new schema**

Modify `components/TagFilter.tsx` and `components/FAQList.tsx` to:

- filter by `primaryCategory` and optional `secondaryCategory`
- optionally expose facet filters for `topic` and `pattern`
- stop deriving categories from `tag -> category` expansion
- preserve legacy `tags` search as leaf-term search only

Modify `components/FAQItem.tsx`, `components/DetailModal.tsx`, `components/FavoriteCard.tsx`, and `components/ReadingView.tsx` to display:

- translated primary category
- optional secondary category
- selected facet pills when useful

**Step 4: Run UI contract test and lint**

Run: `npx tsx --test scripts/faq-taxonomy-home-ui-contract.test.ts`

Expected: PASS

Run: `npm run lint -- components/TagFilter.tsx components/FAQList.tsx components/FAQItem.tsx components/DetailModal.tsx components/FavoriteCard.tsx components/ReadingView.tsx scripts/faq-taxonomy-home-ui-contract.test.ts`

Expected: no lint errors

**Step 5: Commit**

```bash
git add components/TagFilter.tsx components/FAQList.tsx components/FAQItem.tsx components/DetailModal.tsx components/FavoriteCard.tsx components/ReadingView.tsx scripts/faq-taxonomy-home-ui-contract.test.ts
git commit -m "feat(ui): switch FAQ filtering to new taxonomy"
```

### Task 4: Migrate User Focus Preferences to Stable Taxonomy Keys

**Files:**
- Modify: `app/profile/ProfileClient.tsx`
- Modify: `app/api/user/preferences/route.ts`
- Modify: `app/api/user/preferences/import/route.ts`
- Modify: `app/FAQPage.tsx`
- Modify: `lib/preferences-sync.test.ts`
- Modify: `lib/preferences-sync.ts`

**Step 1: Write the failing preference tests**

Update `lib/preferences-sync.test.ts` so focus preferences use taxonomy keys like:

- `model_architecture`
- `post_training_alignment`

Add a case for dropping invalid keys.

Example change:

```ts
test("mergePreferences unions and dedupes focus categories", () => {
  const merged = mergePreferences(
    snapshot({ focusCategories: ["model_architecture", "post_training_alignment"] }),
    snapshot({ focusCategories: ["model_architecture", "fundamentals"] })
  );

  assert.deepEqual(merged.focusCategories.sort(), [
    "fundamentals",
    "model_architecture",
    "post_training_alignment",
  ]);
});
```

**Step 2: Run test to verify current assumptions fail**

Run: `npx tsx --test lib/preferences-sync.test.ts`

Expected: at least one FAIL if legacy Chinese names are still assumed by validation or fixtures.

**Step 3: Switch preference storage and validation to canonical keys**

Modify:

- `app/profile/ProfileClient.tsx`
- `app/FAQPage.tsx`
- `app/api/user/preferences/route.ts`
- `app/api/user/preferences/import/route.ts`
- `lib/preferences-sync.ts`

to:

- use canonical category keys in API payloads, localStorage, and DB writes
- render labels via `lib/taxonomy.ts`
- validate focus preferences against canonical primary category keys

Preserve the `focus_categories` field name if that reduces migration risk, but change its contents to stable keys.

**Step 4: Run tests and lint**

Run: `npx tsx --test lib/preferences-sync.test.ts`

Expected: PASS

Run: `npm run lint -- app/profile/ProfileClient.tsx app/api/user/preferences/route.ts app/api/user/preferences/import/route.ts app/FAQPage.tsx lib/preferences-sync.ts lib/preferences-sync.test.ts`

Expected: no lint errors

**Step 5: Commit**

```bash
git add app/profile/ProfileClient.tsx app/api/user/preferences/route.ts app/api/user/preferences/import/route.ts app/FAQPage.tsx lib/preferences-sync.ts lib/preferences-sync.test.ts
git commit -m "feat(preferences): store focus categories as taxonomy keys"
```

### Task 5: Update AI Analysis and Import Pipelines to Emit the New Taxonomy

**Files:**
- Modify: `lib/ai.ts`
- Modify: `lib/import-pipeline.ts`
- Modify: `app/api/admin/faq/route.ts`
- Modify: `app/api/admin/faq/[id]/route.ts`
- Modify: `app/api/admin/faq/import/route.ts`
- Create: `scripts/faq-taxonomy-prompt-contract.test.ts`

**Step 1: Write the failing prompt contract test**

Create `scripts/faq-taxonomy-prompt-contract.test.ts` to assert:

- prompts ask for `primary_category`
- prompts ask for optional `secondary_category`
- prompts ask for `patterns`, `topics`, and `tool_stack`
- prompts no longer ask the model for old free-form `categories`

Example skeleton:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("AI analysis prompt asks for new taxonomy fields", () => {
  const source = fs.readFileSync("lib/ai.ts", "utf8");
  assert.equal(source.includes("primary_category"), true);
  assert.equal(source.includes("secondary_category"), true);
  assert.equal(source.includes("categories:"), false);
});
```

**Step 2: Run test to verify it fails**

Run: `npx tsx --test scripts/faq-taxonomy-prompt-contract.test.ts`

Expected: FAIL because the current prompt still requests legacy `categories`.

**Step 3: Update prompt shape, parsing, and admin route contracts**

Modify `lib/ai.ts` and `lib/import-pipeline.ts` so generated records include:

- `primary_category`
- `secondary_category`
- `patterns`
- `topics`
- `tool_stack`
- legacy `tags` retained as user-facing leaf tags

Update admin API handlers to persist and return the new fields.

**Step 4: Run contract test, targeted lint, and an AI dry-run smoke command if env is configured**

Run: `npx tsx --test scripts/faq-taxonomy-prompt-contract.test.ts`

Expected: PASS

Run: `npm run lint -- lib/ai.ts lib/import-pipeline.ts app/api/admin/faq/route.ts app/api/admin/faq/[id]/route.ts app/api/admin/faq/import/route.ts scripts/faq-taxonomy-prompt-contract.test.ts`

Expected: no lint errors

Optional smoke run: `npm run faq:answer-and-stage -- --question "LoRA 的 rank 为什么影响显存和效果？" --max 1 --dry-run`

Expected: output includes the new taxonomy fields if AI env vars are available

**Step 5: Commit**

```bash
git add lib/ai.ts lib/import-pipeline.ts app/api/admin/faq/route.ts app/api/admin/faq/[id]/route.ts app/api/admin/faq/import/route.ts scripts/faq-taxonomy-prompt-contract.test.ts
git commit -m "feat(ai): emit primary secondary taxonomy fields"
```

### Task 6: Create and Run a Deterministic Migration Path for Existing Content

**Files:**
- Create: `scripts/migrate-faq-taxonomy.ts`
- Create: `scripts/faq-taxonomy-migration-contract.test.ts`
- Modify: `data/faq.json`
- Modify: `scripts/seed-faq.ts`
- Modify: `app/api/seed/route.ts`
- Modify: `scripts/migrate-content.ts`
- Modify: `scripts/parse-faq.ts`

**Step 1: Write the failing migration contract test**

Create `scripts/faq-taxonomy-migration-contract.test.ts` with fixture cases such as:

- `Transformer + 残差连接` maps to `model_architecture`
- `LoRA` maps to `post_training_alignment`
- `PPO` maps to `reinforcement_learning`
- `RAG` maps to `retrieval_agent_systems`
- `KVCache` maps to `inference_deployment`

Example skeleton:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { classifyLegacyFaq } from "./migrate-faq-taxonomy";

test("LoRA content maps to post-training", () => {
  const result = classifyLegacyFaq({
    question: "LoRA 的 rank 为什么影响显存和效果？",
    tags: ["LoRA", "量化"],
    categories: ["生成式 AI / LLM"],
  });

  assert.equal(result.primary_category, "post_training_alignment");
});
```

**Step 2: Run test to verify it fails**

Run: `npx tsx --test scripts/faq-taxonomy-migration-contract.test.ts`

Expected: FAIL because the migration script does not exist yet.

**Step 3: Implement a deterministic migration script and update seed/import writers**

Create `scripts/migrate-faq-taxonomy.ts` that:

- reads existing FAQ records
- maps legacy `categories` and `tags` to the new taxonomy
- writes `primary_category`, `secondary_category`, `patterns`, `topics`, `tool_stack`
- supports `--dry-run`
- prints a summary of mapped/unmapped items

Update:

- `scripts/parse-faq.ts`
- `scripts/seed-faq.ts`
- `app/api/seed/route.ts`
- `scripts/migrate-content.ts`

so new exports and seeding flows carry the new fields.

**Step 4: Run migration tests and dry-run verification**

Run: `npx tsx --test scripts/faq-taxonomy-migration-contract.test.ts`

Expected: PASS

Run: `npx tsx scripts/migrate-faq-taxonomy.ts --dry-run`

Expected: summary includes total FAQs, mapped FAQs, and any ambiguous rows

Run: `npm run lint -- scripts/migrate-faq-taxonomy.ts scripts/faq-taxonomy-migration-contract.test.ts scripts/seed-faq.ts app/api/seed/route.ts scripts/migrate-content.ts scripts/parse-faq.ts`

Expected: no lint errors

**Step 5: Commit**

```bash
git add scripts/migrate-faq-taxonomy.ts scripts/faq-taxonomy-migration-contract.test.ts data/faq.json scripts/seed-faq.ts app/api/seed/route.ts scripts/migrate-content.ts scripts/parse-faq.ts
git commit -m "feat(migration): backfill FAQ records into new taxonomy"
```

### Task 7: Remove Legacy Taxonomy Coupling and Run Final Verification

**Files:**
- Modify: `components/FAQList.tsx`
- Modify: `components/TagFilter.tsx`
- Modify: `app/profile/ProfileClient.tsx`
- Modify: `app/api/user/preferences/route.ts`
- Modify: `app/api/user/preferences/import/route.ts`
- Modify: `lib/ai.ts`
- Modify: `scripts/categorize-tags.ts`
- Delete or retire: `data/tag-taxonomy.json`

**Step 1: Write the failing legacy-coupling check**

Add one final assertion to an existing contract test or create `scripts/faq-taxonomy-cleanup-contract.test.ts` to ensure:

- runtime files no longer import `data/tag-taxonomy.json`
- legacy category translation map is not used for primary navigation

**Step 2: Run test to verify it fails**

Run: `npx tsx --test scripts/faq-taxonomy-home-ui-contract.test.ts scripts/faq-taxonomy-prompt-contract.test.ts`

Expected: FAIL until all legacy imports are removed.

**Step 3: Remove or quarantine legacy taxonomy**

- stop importing `data/tag-taxonomy.json` in runtime code
- remove `scripts/categorize-tags.ts` from the active path or rewrite it to operate on the new taxonomy facets
- only keep legacy data files temporarily if migration rollback requires them

**Step 4: Run full verification**

Run: `npx tsx --test lib/taxonomy.test.ts lib/faq-taxonomy-record.test.ts lib/preferences-sync.test.ts scripts/faq-taxonomy-home-ui-contract.test.ts scripts/faq-taxonomy-prompt-contract.test.ts scripts/faq-taxonomy-migration-contract.test.ts`

Expected: PASS

Run: `npm run lint`

Expected: no lint errors

Run: `npm run build`

Expected: successful production build

Optional manual verification:

1. Open home page and confirm primary-category filter works.
2. Open profile settings and confirm focus categories render translated labels from the new taxonomy.
3. Open admin review flow and confirm new taxonomy fields appear in payloads.
4. Run migration dry-run and inspect ambiguous rows before production backfill.

**Step 5: Commit**

```bash
git add .
git commit -m "refactor(taxonomy): cut over FAQ site to new taxonomy model"
```

## Handoff

This plan should hand off to:

- `phi-execute` for implementation
- `phi-verify` for completion checks after the cutover

Plan complete and saved to `docs/plans/2026-03-12-faq-taxonomy-redesign-plan.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
