# Content Layer Upgrade Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add brief/detailed answer toggle, image extraction from blog/arXiv sources, Chinese/English bilingual support, and upgrade the admin dashboard with review workflow and statistics.

**Architecture:** Extend the existing DB schema with new columns (answer_brief, answer_en, answer_brief_en, question_en, images). Expand the AI pipeline in `lib/ai.ts` to generate bilingual content and select images. Add a new `lib/image-extractor.ts` for fetching candidate images from source URLs. Upgrade the admin dashboard from a simple submit form to a full content management system with review workflow. Update all frontend components (FAQItem, ReadingView, FAQList) to support brief/detailed toggle and language switching.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 5, Vercel Postgres, Tailwind CSS v4, react-markdown, OpenAI-compatible API

**Design doc:** `docs/plans/2026-02-27-content-layer-upgrade-design.md`

---

## Task 1: DB Schema Migration & Type Updates

**Files:**
- Modify: `lib/db.ts`
- Modify: `src/types/faq.ts`

**Step 1: Update TypeScript types**

Add `FAQImage` interface and extend `FAQItem` in `src/types/faq.ts`:

```typescript
export interface FAQImage {
  url: string;
  caption: string;
  source: "blog" | "paper";
}

export interface FAQItem {
  id: number;
  question: string;
  questionEn?: string;
  date: string;
  tags: string[];
  categories: string[];
  references: Reference[];
  answer: string;
  answerBrief?: string;
  answerEn?: string;
  answerBriefEn?: string;
  images?: FAQImage[];
  upvoteCount: number;
  downvoteCount: number;
  difficulty?: "beginner" | "intermediate" | "advanced" | null;
}
```

**Step 2: Update DB schema in `lib/db.ts`**

Add new columns to `initDB()`:

```sql
ALTER TABLE faq_items ADD COLUMN IF NOT EXISTS answer_brief TEXT;
ALTER TABLE faq_items ADD COLUMN IF NOT EXISTS answer_en TEXT;
ALTER TABLE faq_items ADD COLUMN IF NOT EXISTS answer_brief_en TEXT;
ALTER TABLE faq_items ADD COLUMN IF NOT EXISTS question_en TEXT;
ALTER TABLE faq_items ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]';
```

Add status migration:

```sql
UPDATE faq_items SET status = 'published' WHERE status = 'ready';
```

Update `DBFaqItem` interface to add new fields:

```typescript
export interface DBFaqItem {
  // ...existing fields...
  answer_brief: string | null;
  answer_en: string | null;
  answer_brief_en: string | null;
  question_en: string | null;
  images: FAQImage[];
  status: "pending" | "processing" | "review" | "published" | "rejected" | "failed";
}
```

Update `rowToFaqItem()` to map new fields.

Update `updateFaqStatus()` to accept new fields: `answer_brief`, `answer_en`, `answer_brief_en`, `question_en`, `images`.

Rename `getReadyFaqItems()` to `getPublishedFaqItems()` — query `WHERE status = 'published'` instead of `'ready'`.

**Step 3: Update `app/page.tsx`**

Change `getReadyFaqItems()` call to `getPublishedFaqItems()`. Map new DB fields to FAQItem:

```typescript
const dbItems = await getPublishedFaqItems();
items = dbItems.map((item) => ({
  // ...existing mappings...
  answerBrief: item.answer_brief ?? undefined,
  answerEn: item.answer_en ?? undefined,
  answerBriefEn: item.answer_brief_en ?? undefined,
  questionEn: item.question_en ?? undefined,
  images: item.images ?? [],
}));
```

**Step 4: Update `app/api/admin/faq/route.ts`**

Change `getReadyFaqItems()` to `getPublishedFaqItems()` in `processAIAnalysis`. Change target status from `"ready"` to `"review"` (AI completes → goes to review, not directly published).

**Step 5: Update `app/api/admin/faq/[id]/route.ts`**

Same rename. Change `"ready"` to `"review"` in `retryAnalysis`. Add new PATCH actions: `"publish"` (set status to `"published"`), `"reject"` (set status to `"rejected"`).

**Step 6: Update `scripts/seed-faq.ts`**

Change `'ready'` to `'published'` in the INSERT statement.

**Step 7: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 8: Commit**

```bash
git add src/types/faq.ts lib/db.ts app/page.tsx app/api/admin/faq/route.ts app/api/admin/faq/\[id\]/route.ts scripts/seed-faq.ts
git commit -m "feat(db): add bilingual + image fields, migrate status ready→published"
```

---

## Task 2: Image Extractor Module

**Files:**
- Create: `lib/image-extractor.ts`

**Step 1: Create `lib/image-extractor.ts`**

```typescript
export interface CandidateImage {
  url: string;
  alt: string;
  caption: string;
  context: string;  // surrounding text (~200 chars)
  source: "blog" | "paper";
}

/**
 * Fetch a blog page and extract <img> elements with surrounding context.
 * Filters out logos, icons, and tiny images.
 */
export async function extractImagesFromBlog(blogUrl: string): Promise<CandidateImage[]> {
  // 1. fetch blogUrl HTML
  // 2. Parse with regex or simple HTML parsing (no heavy deps)
  //    - Extract all <img> tags: src, alt
  //    - For each img, grab ~200 chars of text before and after
  // 3. Filter: skip if src contains logo/icon/favicon, or if no src
  // 4. Resolve relative URLs against blogUrl
  // 5. Return max 10 candidates
}

/**
 * Fetch arXiv paper via ar5iv HTML version and extract <figure> elements.
 * ar5iv URL format: https://ar5iv.labs.arxiv.org/html/{arxivId}
 */
export async function extractImagesFromArxiv(arxivId: string): Promise<CandidateImage[]> {
  // 1. Construct ar5iv URL: `https://ar5iv.labs.arxiv.org/html/${arxivId}`
  // 2. fetch HTML
  // 3. Extract all <figure> elements:
  //    - img src from <img> inside <figure>
  //    - caption from <figcaption>
  // 4. Filter: skip if src contains logo/icon
  // 5. Return max 10 candidates
}

/**
 * Given a list of references, extract candidate images from all sources.
 */
export async function extractCandidateImages(
  references: { type: string; url?: string }[]
): Promise<CandidateImage[]> {
  const candidates: CandidateImage[] = [];

  for (const ref of references) {
    if (!ref.url) continue;
    try {
      if (ref.type === "blog" && ref.url) {
        const imgs = await extractImagesFromBlog(ref.url);
        candidates.push(...imgs);
      } else if (ref.type === "paper") {
        // Extract arXiv ID from URL like https://arxiv.org/abs/1512.03385
        const match = ref.url.match(/arxiv\.org\/abs\/(\d+\.\d+)/);
        if (match) {
          const imgs = await extractImagesFromArxiv(match[1]);
          candidates.push(...imgs);
        }
      }
    } catch {
      // Skip failed extractions silently
    }
  }

  return candidates;
}
```

Implementation notes:
- Use simple regex-based HTML parsing to avoid adding dependencies (no cheerio/jsdom)
- For blog: match `<img[^>]*>` and extract src/alt attributes
- For arXiv: match `<figure[\\s\\S]*?</figure>` blocks
- Context extraction: find the img position in HTML, grab surrounding text (strip tags)
- URL resolution: use `new URL(src, baseUrl)` for relative paths

**Step 2: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add lib/image-extractor.ts
git commit -m "feat: add image extractor for blog and arXiv sources"
```

---

## Task 3: Expand AI Pipeline

**Files:**
- Modify: `lib/ai.ts`

**Step 1: Update `AIAnalysisResult` interface**

```typescript
interface AIAnalysisResult {
  tags: string[];
  categories: string[];
  references: Reference[];
  answer: string;           // Chinese detailed (expanded)
  answer_brief: string;     // Chinese brief
  answer_en: string;        // English detailed
  answer_brief_en: string;  // English brief
  question_en: string;      // English question
  images: Array<{ url: string; caption: string; source: "blog" | "paper" }>;
}
```

**Step 2: Update `analyzeFAQ` function signature**

Add `candidateImages` parameter:

```typescript
export async function analyzeFAQ(
  question: string,
  answerRaw: string,
  existingTags: string[],
  candidateImages?: CandidateImage[]
): Promise<AIAnalysisResult>
```

**Step 3: Update the system prompt**

Expand the prompt to include:
- Generate `answer_brief`: if original answer ≤ 500 chars, keep as-is; if > 500 chars, compress to ≤ 500 chars
- Generate `answer`: expand the original answer with more derivations, examples, comparisons
- Generate `answer_en` and `answer_brief_en`: English translations of detailed and brief versions
- Generate `question_en`: English translation of the question
- If `candidateImages` provided: select 0-3 most relevant images from the candidate list, output as `images` array with url, caption, source

**Step 4: Update validation logic**

Add validation for new fields: `answer_brief`, `answer_en`, `answer_brief_en`, `question_en` must be strings. `images` must be an array. Provide defaults for missing fields.

**Step 5: Update callers**

In `app/api/admin/faq/route.ts` `processAIAnalysis`:
1. Import `extractCandidateImages` from `lib/image-extractor.ts`
2. After getting the FAQ item, extract candidate images from its references
3. Pass candidates to `analyzeFAQ`
4. Pass all new fields to `updateFaqStatus`

In `app/api/admin/faq/[id]/route.ts` `retryAnalysis`: same changes.

**Step 6: Verify build compiles**

Run: `npx tsc --noEmit`

**Step 7: Commit**

```bash
git add lib/ai.ts app/api/admin/faq/route.ts app/api/admin/faq/\[id\]/route.ts
git commit -m "feat(ai): expand pipeline for bilingual content + image selection"
```

---

## Task 4: Frontend — Brief/Detailed Toggle in FAQItem

**Files:**
- Modify: `components/FAQItem.tsx`

**Step 1: Add `viewMode` state and toggle UI**

Add state: `const [detailed, setDetailed] = useState(false);`

After the answer-wrapper opens, before the ReactMarkdown block, add toggle buttons:

```tsx
{/* Brief/Detailed toggle */}
{item.answerBrief && (
  <div className="mb-3 flex gap-1">
    <button
      onClick={(e) => { e.stopPropagation(); setDetailed(false); }}
      className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
        !detailed ? "bg-primary text-white" : "text-subtext hover:bg-surface"
      }`}
    >
      精简
    </button>
    <button
      onClick={(e) => { e.stopPropagation(); setDetailed(true); }}
      className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
        detailed ? "bg-primary text-white" : "text-subtext hover:bg-surface"
      }`}
    >
      详细
    </button>
  </div>
)}
```

**Step 2: Switch answer content based on mode**

Replace `{item.answer}` in ReactMarkdown with:

```tsx
{detailed ? item.answer : (item.answerBrief ?? item.answer)}
```

**Step 3: Add image gallery in detailed mode**

After the ReactMarkdown block, when `detailed` and images exist:

```tsx
{detailed && item.images && item.images.length > 0 && (
  <div className="mt-4 space-y-3">
    {item.images.map((img, i) => (
      <figure key={i} className="overflow-hidden rounded-lg border border-border">
        <a href={img.url} target="_blank" rel="noopener noreferrer">
          <img
            src={img.url}
            alt={img.caption}
            className="w-full object-contain"
            loading="lazy"
          />
        </a>
        <figcaption className="bg-surface/50 px-3 py-2 text-xs text-subtext">
          {img.caption}
          <span className="ml-2 text-[10px] text-subtext/60">
            [{img.source === "blog" ? "博客" : "论文"}]
          </span>
        </figcaption>
      </figure>
    ))}
  </div>
)}
```

**Step 4: Verify build compiles**

Run: `npx tsc --noEmit`

**Step 5: Commit**

```bash
git add components/FAQItem.tsx
git commit -m "feat(ui): add brief/detailed toggle and image gallery to FAQItem"
```

---

## Task 5: Frontend — Brief/Detailed Toggle in ReadingView

**Files:**
- Modify: `components/ReadingView.tsx`

**Step 1: Add global and per-item detail state**

```typescript
const [globalDetailed, setGlobalDetailed] = useState(false);
const [itemDetailOverrides, setItemDetailOverrides] = useState<Map<number, boolean>>(new Map());

function isDetailed(id: number): boolean {
  return itemDetailOverrides.get(id) ?? globalDetailed;
}

function toggleItemDetail(id: number): void {
  setItemDetailOverrides(prev => {
    const next = new Map(prev);
    next.set(id, !isDetailed(id));
    return next;
  });
}
```

**Step 2: Add global toggle buttons to toolbar**

After the "全部折叠" button, add:

```tsx
<button
  onClick={() => { setGlobalDetailed(false); setItemDetailOverrides(new Map()); }}
  className={`rounded-full border-[0.5px] border-border px-2 py-1 text-xs ${
    !globalDetailed ? "bg-primary text-white" : "text-subtext hover:bg-surface"
  }`}
>
  全部精简
</button>
<button
  onClick={() => { setGlobalDetailed(true); setItemDetailOverrides(new Map()); }}
  className={`rounded-full border-[0.5px] border-border px-2 py-1 text-xs ${
    globalDetailed ? "bg-primary text-white" : "text-subtext hover:bg-surface"
  }`}
>
  全部详细
</button>
```

**Step 3: Add per-item toggle and image display**

Inside each article, before the ReactMarkdown block, add the same brief/detailed toggle as FAQItem. Use `isDetailed(item.id)` to determine which answer to show. Add image gallery when detailed.

**Step 4: Verify build compiles**

Run: `npx tsc --noEmit`

**Step 5: Commit**

```bash
git add components/ReadingView.tsx
git commit -m "feat(ui): add brief/detailed toggle to ReadingView"
```

---

## Task 6: Frontend — Language Switcher

**Files:**
- Modify: `components/FAQList.tsx`
- Modify: `components/FAQItem.tsx`
- Modify: `components/ReadingView.tsx`

**Step 1: Add language state to FAQList**

```typescript
const [lang, setLang] = useState<"zh" | "en">("zh");
```

Add language toggle in the header area (after the subtitle):

```tsx
<div className="flex gap-1">
  <button
    onClick={() => setLang("zh")}
    className={`rounded-full px-2 py-0.5 text-xs ${
      lang === "zh" ? "bg-primary text-white" : "text-subtext hover:bg-surface"
    }`}
  >
    中文
  </button>
  <button
    onClick={() => setLang("en")}
    className={`rounded-full px-2 py-0.5 text-xs ${
      lang === "en" ? "bg-primary text-white" : "text-subtext hover:bg-surface"
    }`}
  >
    EN
  </button>
</div>
```

**Step 2: Pass `lang` prop to FAQItem and ReadingView**

Add `lang: "zh" | "en"` to `FAQItemProps` and `ReadingViewProps`.

**Step 3: Update FAQItem to use lang**

- Question display: `lang === "en" && item.questionEn ? item.questionEn : item.question`
- Answer display: when `lang === "en"`, use `answerBriefEn` / `answerEn` instead of `answerBrief` / `answer`
- Vote button labels: conditionally show English labels

**Step 4: Update ReadingView similarly**

Same pattern for question and answer display.

**Step 5: Update search to work with both languages**

In FAQList filter logic, when `lang === "en"`, also search `questionEn` and `answerEn` fields.

**Step 6: Verify build compiles**

Run: `npx tsc --noEmit`

**Step 7: Commit**

```bash
git add components/FAQList.tsx components/FAQItem.tsx components/ReadingView.tsx
git commit -m "feat(ui): add Chinese/English language switcher"
```

---

## Task 7: Admin Dashboard Upgrade — Overview Panel

**Files:**
- Modify: `app/admin/page.tsx`
- Modify: `app/api/admin/faq/route.ts`

**Step 1: Add stats endpoint**

In `app/api/admin/faq/route.ts`, the existing GET already returns all items. The frontend will compute stats from the full list. No new endpoint needed.

**Step 2: Add Overview section to admin page**

At the top of AdminDashboard, compute stats from `items`:

```typescript
const stats = useMemo(() => {
  const published = items.filter(i => i.status === "published").length;
  const review = items.filter(i => i.status === "review").length;
  const failed = items.filter(i => i.status === "failed").length;
  const thisWeek = items.filter(i => {
    const d = new Date(i.created_at);
    const now = new Date();
    return (now.getTime() - d.getTime()) < 7 * 24 * 60 * 60 * 1000;
  }).length;
  const totalUp = items.reduce((s, i) => s + (i.upvote_count ?? 0), 0);
  const totalDown = items.reduce((s, i) => s + (i.downvote_count ?? 0), 0);
  const topDownvoted = [...items]
    .sort((a, b) => (b.downvote_count ?? 0) - (a.downvote_count ?? 0))
    .slice(0, 5);
  return { total: items.length, published, review, failed, thisWeek, totalUp, totalDown, topDownvoted };
}, [items]);
```

Render as a grid of stat cards above the content list.

**Step 3: Update `FaqItem` interface in admin page**

Add new fields to match the expanded DB schema:

```typescript
interface FaqItem {
  // ...existing...
  answer_brief: string | null;
  answer_en: string | null;
  answer_brief_en: string | null;
  question_en: string | null;
  images: Array<{ url: string; caption: string; source: string }>;
  upvote_count: number;
  downvote_count: number;
  status: "pending" | "processing" | "review" | "published" | "rejected" | "failed";
}
```

Update `STATUS_STYLES` and `STATUS_LABELS` to include `review`, `published`, `rejected`.

**Step 4: Verify build compiles**

Run: `npx tsc --noEmit`

**Step 5: Commit**

```bash
git add app/admin/page.tsx
git commit -m "feat(admin): add overview stats panel"
```

---

## Task 8: Admin Dashboard Upgrade — Content Management

**Files:**
- Modify: `app/admin/page.tsx`
- Modify: `app/api/admin/faq/[id]/route.ts`

**Step 1: Add filter and sort controls**

Above the FAQ list, add filter buttons:

```tsx
const [statusFilter, setStatusFilter] = useState<string>("all");
const [sortBy, setSortBy] = useState<"newest" | "votes" | "downvotes">("newest");
```

Filter and sort the items list before rendering.

**Step 2: Add three-tab answer preview**

When an item is expanded, show tabs: `原始答案 | 精简版 | 详细版 | English`

```tsx
const [previewTab, setPreviewTab] = useState<"raw" | "brief" | "detailed" | "en">("raw");
```

Each tab shows the corresponding answer field in a `<pre>` block.

**Step 3: Add image preview section**

Below the answer tabs, show the images array:

```tsx
{item.images && item.images.length > 0 && (
  <div>
    <p className="mb-1 text-xs font-medium text-slate-secondary">关联图片:</p>
    <div className="grid grid-cols-2 gap-2">
      {item.images.map((img, i) => (
        <div key={i} className="rounded border border-gray-200 p-1">
          <img src={img.url} alt={img.caption} className="w-full rounded" />
          <p className="mt-1 text-xs text-gray-500">{img.caption}</p>
        </div>
      ))}
    </div>
  </div>
)}
```

**Step 4: Add publish/reject/regenerate actions**

Add action buttons based on status:

```tsx
{item.status === "review" && (
  <div className="flex gap-2">
    <button onClick={() => handlePublish(item.id)} className="...bg-green-600...">
      发布
    </button>
    <button onClick={() => handleReject(item.id)} className="...bg-red-50...">
      退回
    </button>
  </div>
)}
{item.status === "published" && (
  <button onClick={() => handleUnpublish(item.id)} className="...">
    下架
  </button>
)}
```

Implement `handlePublish`, `handleReject`, `handleUnpublish` — all call PATCH `/api/admin/faq/{id}` with appropriate action.

**Step 5: Update API route to handle new actions**

In `app/api/admin/faq/[id]/route.ts`, add handlers:

```typescript
if (body.action === "publish") {
  await updateFaqStatus(numId, "published");
  return NextResponse.json({ ok: true });
}
if (body.action === "reject") {
  await updateFaqStatus(numId, "rejected");
  return NextResponse.json({ ok: true });
}
if (body.action === "unpublish") {
  await updateFaqStatus(numId, "review");
  return NextResponse.json({ ok: true });
}
```

**Step 6: Add vote display**

Show upvote/downvote counts on each item card.

**Step 7: Verify build compiles**

Run: `npx tsc --noEmit`

**Step 8: Commit**

```bash
git add app/admin/page.tsx app/api/admin/faq/\[id\]/route.ts
git commit -m "feat(admin): add content management with review workflow"
```

---

## Task 9: Migration Script

**Files:**
- Create: `scripts/migrate-content.ts`

**Step 1: Create migration script**

```typescript
// scripts/migrate-content.ts
// 1. Connect to Neon DB
// 2. Read all faq_items (regardless of status)
// 3. For each item that lacks answer_brief or answer_en:
//    a. Extract candidate images from references
//    b. Call expanded analyzeFAQ
//    c. Update DB with all new fields
//    d. Keep existing status (published items stay published)
// 4. Support resume: skip items that already have answer_brief AND answer_en
// 5. Log progress: "Processing N/total: question..."
// 6. Rate limit: 2-second delay between API calls
```

Key implementation details:
- Import `sql` from `@vercel/postgres`
- Import `analyzeFAQ` from `../lib/ai`
- Import `extractCandidateImages` from `../lib/image-extractor`
- Query: `SELECT * FROM faq_items ORDER BY id ASC`
- Skip condition: `item.answer_brief IS NOT NULL AND item.answer_en IS NOT NULL`
- Update query: direct SQL UPDATE with all new fields
- Error handling: log error and continue to next item

**Step 2: Add npm script**

In `package.json`, add:

```json
"migrate-content": "npx tsx scripts/migrate-content.ts"
```

**Step 3: Verify script compiles**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add scripts/migrate-content.ts package.json
git commit -m "feat: add content migration script for bilingual + image generation"
```

---

## Task 10: Final Integration & Cleanup

**Files:**
- All modified files

**Step 1: Run full type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 2: Run lint**

Run: `npm run lint`
Fix any lint errors.

**Step 3: Test build**

Run: `npm run build`
Expected: Build succeeds (may have warnings about missing env vars, that's OK)

**Step 4: Review all changes**

Run: `git diff --stat`
Verify all changes are intentional and no debug code remains.

**Step 5: Final commit if needed**

```bash
git add -A
git commit -m "chore: fix lint and build issues from content layer upgrade"
```
