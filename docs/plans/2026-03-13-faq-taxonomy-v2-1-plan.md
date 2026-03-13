# FAQ Taxonomy V2.1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove `patterns`, split retrieval and agent into separate first-level categories, and migrate the FAQ system to the approved `primary + secondary + topics + tool_stack` taxonomy model.

**Architecture:** Update the canonical taxonomy source first, then propagate the model change through types, DB normalization, UI filters, AI/admin write paths, and deterministic migration scripts. Finish with a DB backfill dry-run and execution path that rewrites old taxonomy values into the new schema.

**Tech Stack:** Next.js App Router, React 19, TypeScript, `@vercel/postgres`, Node `test`, `tsx`, ESLint

---

### Task 1: Update Canonical Taxonomy Source and Shared Types

**Files:**
- Modify: `data/faq-taxonomy.json`
- Modify: `src/types/faq.ts`
- Modify: `lib/taxonomy.ts`
- Modify: `lib/taxonomy.test.ts`

**Step 1: Write the failing taxonomy tests**

Add test coverage for:

- `retrieval_systems` and `agent_systems` both exist
- `retrieval_agent_systems` is no longer a valid category
- `pattern` is no longer a supported facet group

Run: `npx tsx --test lib/taxonomy.test.ts`

Expected: FAIL because the old taxonomy still exposes `retrieval_agent_systems` and `pattern`.

**Step 2: Update the canonical taxonomy model**

- replace `retrieval_agent_systems` with:
  - `retrieval_systems`
  - `agent_systems`
- remove `facets.pattern`
- expand `facets.topic`
- keep and refine `facets.tool_stack`

Update shared types so `FAQFacetGroup` no longer includes `pattern`.

**Step 3: Run tests**

Run: `npx tsx --test lib/taxonomy.test.ts`

Expected: PASS

**Step 4: Commit**

```bash
git add data/faq-taxonomy.json src/types/faq.ts lib/taxonomy.ts lib/taxonomy.test.ts
git commit -m "feat(taxonomy): split retrieval and agent categories"
```

### Task 2: Remove Patterns from Persistence and Runtime Mapping

**Files:**
- Modify: `lib/db.ts`
- Modify: `lib/faq-taxonomy-record.test.ts`
- Modify: `app/page.tsx`
- Modify: `app/faq/[id]/page.tsx`
- Modify: `app/profile/page.tsx`
- Modify: `app/admin/review/page.tsx`

**Step 1: Write the failing record-shape tests**

Update tests so runtime FAQ mapping expects:

- `topics`
- `toolStack`
- no `patterns`

Run: `npx tsx --test lib/faq-taxonomy-record.test.ts`

Expected: FAIL because runtime records still expose `patterns`.

**Step 2: Update DB/runtime mapping**

- stop exposing `patterns` in app-facing FAQ items
- keep DB column temporarily only if needed for migration staging
- ensure category normalization accepts the new split categories

**Step 3: Run tests**

Run: `npx tsx --test lib/faq-taxonomy-record.test.ts`

Expected: PASS

**Step 4: Commit**

```bash
git add lib/db.ts lib/faq-taxonomy-record.test.ts app/page.tsx app/faq/[id]/page.tsx app/profile/page.tsx app/admin/review/page.tsx
git commit -m "refactor(faq): remove patterns from runtime taxonomy shape"
```

### Task 3: Update Public and Admin UI to Use Only Categories and Topics

**Files:**
- Modify: `components/FAQList.tsx`
- Modify: `components/TagFilter.tsx`
- Modify: `components/FAQItem.tsx`
- Modify: `components/DetailModal.tsx`
- Modify: `components/FavoriteCard.tsx`
- Modify: `components/ReadingView.tsx`
- Modify: `app/faq/[id]/FAQDetailClient.tsx`
- Modify: `app/admin/review/page.tsx`
- Modify: `scripts/faq-taxonomy-home-ui-contract.test.ts`

**Step 1: Write the failing UI contract test**

Add assertions that:

- `pattern` no longer appears in public filter UI
- public taxonomy pills only show categories and topics
- admin review metadata no longer renders `模式`

Run: `npx tsx --test scripts/faq-taxonomy-home-ui-contract.test.ts`

Expected: FAIL because the current UI still references `pattern`.

**Step 2: Update UI**

- remove pattern filtering from `FAQList` and `TagFilter`
- remove pattern pills from cards, modal, reading view, and detail page
- keep topic-based filtering/search
- update admin review taxonomy display to show:
  - primary
  - secondary
  - topics
  - tool stack

**Step 3: Run tests**

Run: `npx tsx --test scripts/faq-taxonomy-home-ui-contract.test.ts`

Expected: PASS

**Step 4: Commit**

```bash
git add components/FAQList.tsx components/TagFilter.tsx components/FAQItem.tsx components/DetailModal.tsx components/FavoriteCard.tsx components/ReadingView.tsx app/faq/[id]/FAQDetailClient.tsx app/admin/review/page.tsx scripts/faq-taxonomy-home-ui-contract.test.ts
git commit -m "refactor(ui): remove pattern taxonomy from FAQ surfaces"
```

### Task 4: Update AI and Admin Write Paths

**Files:**
- Modify: `lib/ai.ts`
- Modify: `lib/import-pipeline.ts`
- Modify: `app/api/admin/faq/route.ts`
- Modify: `app/api/admin/faq/[id]/route.ts`
- Modify: `app/api/admin/faq/import/route.ts`
- Modify: `scripts/faq-taxonomy-prompt-contract.test.ts`

**Step 1: Write the failing prompt contract test**

Update tests so prompts and write paths require:

- `primary_category`
- `secondary_category`
- `topics`
- `tool_stack`
- no `patterns`

Run: `npx tsx --test scripts/faq-taxonomy-prompt-contract.test.ts`

Expected: FAIL because prompt contracts still mention `patterns`.

**Step 2: Update AI/admin contracts**

- remove `patterns` from prompt schemas
- update parser normalization logic
- keep tool stack support
- ensure admin update routes no longer accept or persist `patterns`

**Step 3: Run tests**

Run: `npx tsx --test scripts/faq-taxonomy-prompt-contract.test.ts`

Expected: PASS

**Step 4: Commit**

```bash
git add lib/ai.ts lib/import-pipeline.ts app/api/admin/faq/route.ts app/api/admin/faq/[id]/route.ts app/api/admin/faq/import/route.ts scripts/faq-taxonomy-prompt-contract.test.ts
git commit -m "refactor(ai): remove pattern taxonomy from generation contracts"
```

### Task 5: Rebuild Deterministic Migration Rules for the New Taxonomy

**Files:**
- Modify: `scripts/migrate-faq-taxonomy.ts`
- Modify: `scripts/faq-taxonomy-migration-contract.test.ts`
- Modify: `scripts/backfill-faq-taxonomy-db.ts`

**Step 1: Write the failing migration tests**

Add contract cases for:

- retrieval-first FAQ maps to `retrieval_systems`
- agent-first FAQ maps to `agent_systems`
- former pattern cases now emit `topics`
- `retrieval_agent_systems` is never emitted

Run: `npx tsx --test scripts/faq-taxonomy-migration-contract.test.ts`

Expected: FAIL because migration logic still emits old category keys or pattern output.

**Step 2: Update deterministic classification**

- split retrieval signals from agent signals
- convert former pattern concepts into topics
- stop producing `patterns`
- update DB backfill script to write:
  - `primary_category`
  - `secondary_category`
  - `topics`
  - `tool_stack`

**Step 3: Run tests**

Run: `npx tsx --test scripts/faq-taxonomy-migration-contract.test.ts`

Expected: PASS

**Step 4: Commit**

```bash
git add scripts/migrate-faq-taxonomy.ts scripts/faq-taxonomy-migration-contract.test.ts scripts/backfill-faq-taxonomy-db.ts
git commit -m "feat(migration): align FAQ backfill with taxonomy v2.1"
```

### Task 6: Execute Dry-Run and DB Backfill Validation

**Files:**
- Modify if needed: `scripts/backfill-faq-taxonomy-db.ts`

**Step 1: Run DB dry-run**

Run: `npm run faq:backfill-taxonomy -- --dry-run`

Expected:

- deterministic summary
- no `retrieval_agent_systems`
- no `patterns`
- acceptable `unmapped` count only for out-of-scope rows

**Step 2: Execute DB backfill**

Run: `npm run faq:backfill-taxonomy`

Expected: rows updated successfully

**Step 3: Re-run dry-run**

Run: `npm run faq:backfill-taxonomy -- --dry-run`

Expected: `changed: 0`

**Step 4: Commit**

```bash
git add scripts/backfill-faq-taxonomy-db.ts
git commit -m "chore(db): backfill FAQ taxonomy v2.1"
```

### Task 7: Final Verification

**Files:**
- No new files required unless fixes are found

**Step 1: Run targeted tests**

Run:

```bash
npx tsx --test lib/taxonomy.test.ts lib/faq-taxonomy-record.test.ts lib/preferences-sync.test.ts scripts/faq-taxonomy-home-ui-contract.test.ts scripts/faq-taxonomy-prompt-contract.test.ts scripts/faq-taxonomy-migration-contract.test.ts
```

Expected: PASS

**Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected: no new errors

**Step 3: Run build**

Run:

```bash
npm run build
```

Expected: PASS

**Step 4: Final delivery**

Report:

- taxonomy v2.1 implemented
- DB backfill summary
- any residual out-of-scope unmapped rows
- any unrelated lint warnings still present
