# AIFAQ Design Document

## Overview

AIFAQ is a static Q&A knowledge base website for AI/ML topics, built with Next.js + Tailwind CSS, deployed on Vercel. Data source is `AI-FAQ.md` (81 FAQ entries about Transformer, attention mechanisms, normalization, etc.).

## Tech Stack

- **Framework**: Next.js (App Router, SSG via `output: 'export'`)
- **Styling**: Tailwind CSS
- **Markdown Rendering**: react-markdown + remark-math + rehype-katex
- **Deployment**: Vercel (zero-config for Next.js)

## Data Layer

### Data Flow

`AI-FAQ.md` → `scripts/parse-faq.ts` (build-time) → `data/faq.json` → page import

### Data Structure

```ts
interface FAQItem {
  id: number;
  question: string;
  date: string;
  tags: string[];
  references: Reference[];
  answer: string; // markdown
}

interface Reference {
  type: "blog" | "paper" | "other";
  title: string;
  url?: string; // arXiv auto-generated, others optional
}
```

### Parse Rules

- Split by `---` separator
- Extract: id, question, date, tags, references, answer
- Auto-generate arXiv URLs from `arXiv:XXXX.XXXXX` patterns
- Run as `prebuild` script in package.json

## Page Structure & Interaction

### Layout

Single page `/` with:
1. **Header**: "AIFAQ" title + optional GitHub link
2. **Search bar**: Full-width, prominent, with `Cmd+K` shortcut hint
3. **Tag filter**: Clickable tag list, multi-select with OR logic
4. **Result count**: "显示 X 条中的 Y 条"
5. **FAQ list**: Accordion-style, expand/collapse on click, multiple can be open

### Interaction Logic

- **Search**: Real-time client-side filter on question title + answer content
- **Tag filter**: OR logic (match any selected tag), combinable with search
- **Expand/collapse**: Click question row to toggle, multiple items can be open simultaneously
- **References**: Displayed inside expanded answer area; arXiv links clickable, blog articles show text only

## Visual Design: Editorial Technical Journal

### Color Palette

- Background: warm white `#FAF9F6`
- Primary text: deep ink `#1A1A2E`
- Accent: copper orange `#C45D3E` (tags, indicators, hover)
- Secondary: slate blue-gray `#64748B` (dates, meta)
- Code/formula bg: `#F1F0EB`

### Typography

- Headings/Questions: `Noto Serif SC` (serif, journal feel, CJK-friendly)
- Body/Answers: `Noto Sans SC` (clean, readable)
- Tags/Code: `JetBrains Mono` (monospace, technical)

### Layout Features

- Left vertical line as visual anchor, question numbers prominent beside it
- Large serif question numbers in copper orange (curated knowledge feel)
- Expanded answers get subtle left border color change (copper orange)
- Desktop: tag sidebar navigation; Mobile: horizontal scroll tags

### Motion

- Expand/collapse: CSS `max-height` + `opacity` transition
- Tag selection: background fill transition
- Page load: staggered fade-in (CSS `animation-delay`)
- Empty state for no search results

## Component Structure

```
app/
  page.tsx              — Main page (SSG)
  layout.tsx            — Global layout (fonts, meta)
  globals.css           — Tailwind globals + custom styles

components/
  SearchBar.tsx         — Search input with Cmd+K hint
  TagFilter.tsx         — Tag filter area (multi-select OR)
  FAQList.tsx           — FAQ list container (filter logic)
  FAQItem.tsx           — Single FAQ entry (expand/collapse + markdown render)
  ReferenceList.tsx     — Reference source list

scripts/
  parse-faq.ts          — Build-time AI-FAQ.md → JSON parser

data/
  faq.json              — Generated structured data (gitignored)
```

## Deployment

- `next.config.js`: `output: 'export'` for static site
- `package.json`: `prebuild` script runs `parse-faq.ts`
- Push to GitHub → Vercel auto-builds

## Out of Scope (YAGNI)

- No backend API
- No user auth/comments
- No full-text search engine (81 items, client-side sufficient)
- No dark mode toggle
- No pagination (all items rendered, expand/collapse controls visibility)

## Future Extensions

- PDF data source: add `scripts/parse-pdf.ts`, output to same `faq.json` format
- Blog article links: add URLs directly in AI-FAQ.md when ready
