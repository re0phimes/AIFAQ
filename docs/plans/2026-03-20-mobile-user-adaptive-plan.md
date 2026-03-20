# User Mobile Adaptive Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove page-level horizontal overflow for user-facing mobile reading flows while preserving readable markdown, image galleries, and modal interactions.

**Architecture:** Tighten width constraints at the container layer first, then normalize markdown overflow behavior, and finally adjust narrow-screen controls like pagination and galleries. Keep changes limited to user-facing components and global prose styles.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, global CSS

---

### Task 1: Harden User-Facing Content Containers

**Files:**
- Modify: `components/DetailModal.tsx`
- Modify: `components/FAQItem.tsx`
- Modify: `components/FavoriteCard.tsx`

**Step 1: Add width guards to modal and expanded content containers**

- Ensure modal shells and expanded content blocks use `min-w-0` / `max-w-full`
- Prevent scrollable content areas from creating page-level horizontal overflow

**Step 2: Make modal footer actions wrap safely on narrow screens**

- Allow footer actions to wrap
- Keep primary actions readable without overflowing the modal

**Step 3: Run targeted lint**

Run:

```powershell
npx eslint components/DetailModal.tsx components/FAQItem.tsx components/FavoriteCard.tsx
```

Expected: PASS

### Task 2: Normalize Markdown Overflow Behavior for Mobile

**Files:**
- Modify: `app/globals.css`
- Modify if needed: `components/AsyncMarkdownContent.tsx`
- Modify if needed: `components/MarkdownContent.tsx`

**Step 1: Constrain prose and table wrappers**

- Keep prose blocks inside parent width
- Ensure table wrappers never widen the page

**Step 2: Improve mobile behavior for long text and code blocks**

- Allow long text and inline code to wrap
- Make code blocks mobile-friendly with wrapping or contained scrolling
- Keep KaTeX display constrained to its own container

**Step 3: Run targeted lint**

Run:

```powershell
npx eslint app/globals.css components/AsyncMarkdownContent.tsx components/MarkdownContent.tsx
```

Expected: PASS

### Task 3: Tighten Mobile Controls That Commonly Overflow

**Files:**
- Modify: `components/Pagination.tsx`
- Modify if needed: `components/ImageGallery.tsx`
- Modify if needed: `components/ImageLightbox.tsx`

**Step 1: Make pagination narrow-screen safe**

- Split info and controls vertically on mobile
- Keep page buttons inside a local scroll area if needed

**Step 2: Ensure gallery and lightbox scrolling stays local**

- Keep gallery rows and thumbnail strips from widening the page
- Preserve current image interactions

**Step 3: Run targeted lint**

Run:

```powershell
npx eslint components/Pagination.tsx components/ImageGallery.tsx components/ImageLightbox.tsx
```

Expected: PASS

### Task 4: Verify the User-Side Mobile Closed Loop

**Files:**
- No new files required

**Step 1: Run full targeted lint**

Run:

```powershell
npx eslint components/DetailModal.tsx components/FAQItem.tsx components/FavoriteCard.tsx components/Pagination.tsx components/ImageGallery.tsx components/ImageLightbox.tsx components/AsyncMarkdownContent.tsx components/MarkdownContent.tsx app/globals.css
```

Expected: PASS

**Step 2: Run typecheck**

Run:

```powershell
npx tsc --noEmit
```

Expected: PASS

**Step 3: Inspect worktree**

Run:

```powershell
git status --short
git diff --stat
```

Expected: only intended user-side mobile adaptive files are changed
