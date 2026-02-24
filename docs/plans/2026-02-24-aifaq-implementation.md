# AIFAQ Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a static Q&A knowledge base website (AIFAQ) that renders 81 AI/ML FAQ entries from a markdown file, with search, tag filtering, and expand/collapse interaction.

**Architecture:** Next.js App Router with static export (`output: 'export'`). A build-time Node script parses `AI-FAQ.md` into structured JSON. The single-page React app loads this JSON and provides client-side search + tag filtering. Deployed as pure static files on Vercel.

**Tech Stack:** Next.js 14, Tailwind CSS 3, TypeScript, react-markdown, remark-math, rehype-katex, tsx (for running TS scripts)

**Design doc:** `docs/plans/2026-02-24-aifaq-design.md`

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `tailwind.config.ts`
- Create: `postcss.config.mjs`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `app/globals.css`
- Create: `.gitignore`

**Step 1: Initialize Next.js project**

```bash
cd /home/modelenv/chentianxuan/s_projects/aifaq
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-npm
```

Accept defaults. This creates the full scaffold with App Router, Tailwind, TypeScript.

**Step 2: Install additional dependencies**

```bash
npm install react-markdown remark-math rehype-katex
npm install -D tsx @types/node
```

- `react-markdown`: render markdown in React
- `remark-math` + `rehype-katex`: LaTeX math formula support
- `tsx`: run TypeScript scripts (for parse-faq.ts)

**Step 3: Configure static export**

Edit `next.config.ts` to add:
```ts
const nextConfig = {
  output: 'export',
};
```

**Step 4: Verify scaffold builds**

```bash
npm run build
```

Expected: Build succeeds, `out/` directory created with static files.

**Step 5: Commit**

```bash
git init
git add -A
git commit -m "chore: initialize Next.js project with Tailwind and dependencies"
```

---

### Task 2: FAQ Markdown Parser

**Files:**
- Create: `scripts/parse-faq.ts`
- Create: `src/types/faq.ts`
- Modify: `package.json` (add `prebuild` script)
- Create: `data/.gitkeep`

**Step 1: Create shared type definitions**

Create `src/types/faq.ts`:
```ts
export interface Reference {
  type: "blog" | "paper" | "other";
  title: string;
  url?: string;
}

export interface FAQItem {
  id: number;
  question: string;
  date: string;
  tags: string[];
  references: Reference[];
  answer: string;
}
```

**Step 2: Write the parser script**

Create `scripts/parse-faq.ts`. The parser must:

1. Read `AI-FAQ.md`
2. Skip everything before the first `---` separator (the index table)
3. Split remaining content by `---` separators
4. For each section, extract:
   - `id` and `question` from `## N. Question text` heading
   - `date` from `**日期**: YYYY-MM-DD`
   - `tags` from `**标签**: #tag1 #tag2` (strip `#` prefix)
   - `references` from lines after `**参考**:`, each starting with `- `
     - Lines matching `来源文章:` → type `"blog"`
     - Lines containing `arXiv:XXXX.XXXXX` → type `"paper"`, auto-generate URL `https://arxiv.org/abs/XXXX.XXXXX`
     - Other lines → type `"other"`
   - `answer` from everything after `### 答案` until end of section
5. Write to `data/faq.json`

Key parsing patterns:
```ts
// Heading: ## 1. 残差连接中 F(x) 代表什么？
const headingMatch = section.match(/^## (\d+)\.\s+(.+)$/m);

// Date: **日期**: 2026-02-23
const dateMatch = section.match(/\*\*日期\*\*:\s*(\d{4}-\d{2}-\d{2})/);

// Tags: **标签**: #残差连接 #Transformer
const tagsMatch = section.match(/\*\*标签\*\*:\s*(.+)$/m);
// Then split by #: tags = tagsStr.match(/#(\S+)/g).map(t => t.slice(1));

// References: lines between **参考**: and **标签**
// Each line: - 来源文章: xxx.md  OR  - Author, "Title", arXiv:XXXX.XXXXX, Year

// arXiv URL extraction
const arxivMatch = line.match(/arXiv:(\d+\.\d+)/);
// url = `https://arxiv.org/abs/${arxivMatch[1]}`

// Answer: everything after ### 答案\n\n
const answerMatch = section.match(/### 答案\s*\n\n([\s\S]+)$/);
```

**Step 3: Add prebuild script to package.json**

```json
{
  "scripts": {
    "prebuild": "tsx scripts/parse-faq.ts",
    "predev": "tsx scripts/parse-faq.ts"
  }
}
```

**Step 4: Add data/ to .gitignore**

Append to `.gitignore`:
```
data/faq.json
```

And create `data/.gitkeep` so the directory exists in git.

**Step 5: Run parser and verify output**

```bash
npx tsx scripts/parse-faq.ts
```

Expected: `data/faq.json` created with 81 entries. Spot-check:
```bash
node -e "const d=require('./data/faq.json'); console.log('Count:', d.length); console.log('First:', JSON.stringify(d[0], null, 2)); console.log('Last ID:', d[d.length-1].id);"
```

Expected output: Count 81, first entry has id=1, question about F(x), last entry has id=81.

**Step 6: Verify build still works with prebuild**

```bash
npm run build
```

Expected: prebuild runs parser first, then Next.js build succeeds.

**Step 7: Commit**

```bash
git add scripts/parse-faq.ts src/types/faq.ts data/.gitkeep package.json .gitignore
git commit -m "feat: add build-time FAQ markdown parser"
```

---

### Task 3: Global Layout, Fonts, and Theme

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Modify: `tailwind.config.ts`

**Step 1: Configure Tailwind theme with design tokens**

Edit `tailwind.config.ts` to add custom colors and fonts:
```ts
theme: {
  extend: {
    colors: {
      'warm-white': '#FAF9F6',
      'deep-ink': '#1A1A2E',
      'copper': '#C45D3E',
      'copper-light': '#D4785F',
      'slate-secondary': '#64748B',
      'code-bg': '#F1F0EB',
    },
    fontFamily: {
      serif: ['Noto Serif SC', 'serif'],
      sans: ['Noto Sans SC', 'sans-serif'],
      mono: ['JetBrains Mono', 'monospace'],
    },
  },
},
```

**Step 2: Set up globals.css**

Replace `app/globals.css` with:
- Tailwind directives (`@tailwind base/components/utilities`)
- KaTeX CSS import: `@import 'katex/dist/katex.min.css';`
- Custom CSS variables for the color palette
- Base body styles: `bg-warm-white text-deep-ink font-sans`
- Staggered fade-in animation keyframes
- Smooth expand/collapse transition utilities

**Step 3: Set up layout.tsx with Google Fonts**

Edit `app/layout.tsx`:
- Import Noto Serif SC, Noto Sans SC from `next/font/google`
- Import JetBrains Mono from `next/font/google`
- Set metadata: title "AIFAQ", description
- Apply font CSS variables to `<html>` element
- Wrap children in semantic `<main>` with max-width container

**Step 4: Verify fonts load**

```bash
npm run dev &
sleep 3
curl -s http://localhost:3000 | grep -o 'Noto'
kill %1
```

Expected: "Noto" appears in the HTML (font preload links).

**Step 5: Commit**

```bash
git add app/layout.tsx app/globals.css tailwind.config.ts
git commit -m "feat: configure theme, fonts, and global styles"
```

---

### Task 4: SearchBar Component

**Files:**
- Create: `components/SearchBar.tsx`

**Step 1: Build SearchBar component**

`components/SearchBar.tsx` — a controlled input component:
- Props: `value: string`, `onChange: (value: string) => void`
- Full-width input with search icon (inline SVG, no icon library)
- Placeholder: "搜索问题..."
- Right side hint: `⌘K` badge (decorative only for now)
- Styling: large padding, warm-white bg, subtle border, copper focus ring
- `"use client"` directive (uses state via parent)

**Step 2: Verify it renders**

Temporarily import in `app/page.tsx` with dummy state, run `npm run dev`, check browser.

**Step 3: Commit**

```bash
git add components/SearchBar.tsx
git commit -m "feat: add SearchBar component"
```

---

### Task 5: TagFilter Component

**Files:**
- Create: `components/TagFilter.tsx`

**Step 1: Build TagFilter component**

`components/TagFilter.tsx`:
- Props: `allTags: string[]`, `selectedTags: string[]`, `onToggleTag: (tag: string) => void`, `onClearTags: () => void`
- Renders a horizontal scrollable list of tag buttons
- Selected tags get copper background + white text
- Unselected tags get code-bg background + deep-ink text
- "清除" button appears when any tag is selected
- Font: `font-mono text-sm`
- Transition: `transition-colors duration-200`
- `"use client"` directive

**Step 2: Verify it renders**

Temporarily import in `app/page.tsx` with dummy tags, run `npm run dev`, check browser.

**Step 3: Commit**

```bash
git add components/TagFilter.tsx
git commit -m "feat: add TagFilter component"
```

---

### Task 6: ReferenceList Component

**Files:**
- Create: `components/ReferenceList.tsx`

**Step 1: Build ReferenceList component**

`components/ReferenceList.tsx`:
- Props: `references: Reference[]`
- Renders a list of reference sources
- Papers with URL: clickable link (copper color, opens in new tab)
- Blog articles without URL: plain text with a book icon
- Other references: plain text
- Styled as a subtle bordered section below the answer
- Label: "参考来源"

**Step 2: Commit**

```bash
git add components/ReferenceList.tsx
git commit -m "feat: add ReferenceList component"
```

---

### Task 7: FAQItem Component (Expand/Collapse + Markdown Rendering)

**Files:**
- Create: `components/FAQItem.tsx`

**Step 1: Build FAQItem component**

`components/FAQItem.tsx`:
- Props: `item: FAQItem`, `isOpen: boolean`, `onToggle: () => void`
- `"use client"` directive
- **Collapsed state**: Shows question number (large serif, copper), question title, date, tags
- **Expanded state**: Additionally shows answer (rendered markdown) + references
- Left border: gray when collapsed, copper when expanded
- Question number: `font-serif text-2xl text-copper`
- Expand indicator: chevron rotates on open (CSS transform transition)
- Answer area: uses `react-markdown` with `remarkMath` and `rehypeKatex` plugins
- Markdown code blocks: `bg-code-bg` styling
- Transition: CSS `grid-rows` trick for smooth height animation:
  ```css
  .answer-wrapper { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 300ms; }
  .answer-wrapper.open { grid-template-rows: 1fr; }
  .answer-wrapper > div { overflow: hidden; }
  ```

**Step 2: Verify markdown + math rendering**

Run `npm run dev`, manually check that:
- LaTeX formulas render (e.g., `$W_{DKV}$`, `$O(N^2)$`)
- Code blocks render with background
- Expand/collapse animation is smooth

**Step 3: Commit**

```bash
git add components/FAQItem.tsx
git commit -m "feat: add FAQItem component with markdown and math rendering"
```

---

### Task 8: FAQList Container + Main Page Assembly

**Files:**
- Create: `components/FAQList.tsx`
- Modify: `app/page.tsx`

**Step 1: Build FAQList component**

`components/FAQList.tsx`:
- `"use client"` directive
- Props: `items: FAQItem[]`
- Internal state: `searchQuery`, `selectedTags`, `openItems` (Set of ids)
- **Filter logic**:
  1. If search query is non-empty: filter items where question or answer includes query (case-insensitive)
  2. If any tags selected: further filter items that have at least one matching tag (OR logic)
- **Derived data**: `allTags` extracted from all items (sorted by frequency, descending)
- **Result count**: "显示 {total} 条中的 {filtered} 条"
- Renders: SearchBar → TagFilter → result count → list of FAQItem
- Staggered fade-in: each FAQItem gets `animation-delay: index * 30ms`

**Step 2: Wire up main page**

Edit `app/page.tsx`:
- Import FAQ data: `import faqData from '@/data/faq.json'`
- Import FAQList component
- Render header ("AIFAQ" title) + FAQList
- This is a Server Component that passes static data to the client FAQList

**Step 3: Run full dev server and verify**

```bash
npm run dev
```

Open browser, verify:
- All 81 FAQ items render
- Search filters in real-time
- Tag selection filters with OR logic
- Expand/collapse works
- Math formulas render correctly
- References display properly

**Step 4: Run production build**

```bash
npm run build
```

Expected: Static export succeeds, `out/` directory contains the site.

**Step 5: Commit**

```bash
git add components/FAQList.tsx app/page.tsx
git commit -m "feat: assemble main page with search, tag filter, and FAQ list"
```

---

### Task 9: Visual Polish and Responsive Design

**Files:**
- Modify: `app/globals.css`
- Modify: `components/FAQItem.tsx`
- Modify: `components/SearchBar.tsx`
- Modify: `components/TagFilter.tsx`
- Modify: `app/page.tsx`

**Step 1: Responsive layout adjustments**

- Mobile (< 768px): full-width layout, tags horizontal scroll, smaller question numbers
- Desktop (>= 768px): max-width container (800px), centered, comfortable reading width
- Tag filter: `overflow-x-auto` with `-webkit-overflow-scrolling: touch` on mobile

**Step 2: Empty state**

When search/filter returns 0 results, show a centered message: "没有找到匹配的问题" with a subtle illustration or icon.

**Step 3: Staggered fade-in animation**

Add to `globals.css`:
```css
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.faq-item-enter {
  animation: fadeInUp 0.3s ease-out both;
}
```

Apply `animation-delay` per item in FAQList.

**Step 4: Final visual check**

Run `npm run dev`, verify:
- Warm white background, copper accents
- Serif question numbers look like journal chapter numbers
- Smooth expand/collapse
- Mobile layout works (use browser dev tools)
- Math formulas styled correctly with code-bg background

**Step 5: Production build verification**

```bash
npm run build && npx serve out
```

Open browser, verify the static site works identically.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: visual polish, responsive design, and animations"
```

---

### Task 10: Vercel Deployment Configuration

**Files:**
- Verify: `next.config.ts` has `output: 'export'`
- Verify: `package.json` has `prebuild` script

**Step 1: Verify build output is correct**

```bash
npm run build
ls out/
```

Expected: `out/` contains `index.html` and static assets.

**Step 2: Final commit with all files**

```bash
git status
git add -A
git commit -m "chore: finalize project for Vercel deployment"
```

**Step 3: Document deployment steps**

The project is ready for Vercel deployment:
1. Push to GitHub repository
2. Connect repo to Vercel
3. Vercel auto-detects Next.js, runs `npm run build` (which triggers `prebuild` → parser → build)
4. Static files from `out/` are deployed

No special Vercel configuration needed — Next.js static export is natively supported.

---

## Task Dependency Graph

```
Task 1 (Scaffold)
  └→ Task 2 (Parser)
       └→ Task 3 (Theme/Fonts)
            ├→ Task 4 (SearchBar)
            ├→ Task 5 (TagFilter)
            ├→ Task 6 (ReferenceList)
            └→ Task 7 (FAQItem)
                 └→ Task 8 (FAQList + Page Assembly)
                      └→ Task 9 (Visual Polish)
                           └→ Task 10 (Deploy Config)
```

Tasks 4, 5, 6, 7 can be developed in parallel after Task 3.
