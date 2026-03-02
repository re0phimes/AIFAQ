# Expand Performance Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent performance degradation when expanding all FAQ items by disabling expand-all in detailed mode and adding lazy rendering via IntersectionObserver in brief mode.

**Architecture:** Two-pronged fix — (1) guard `handleExpandAll` behind `globalDetailed` check and disable the button in UI, (2) add IntersectionObserver to FAQItem so markdown only renders when the item scrolls into view (with 200px margin and once-mode).

**Tech Stack:** React 18, IntersectionObserver API (native), Next.js App Router

---

### Task 1: Disable "Expand All" in detailed mode (FAQList.tsx)

**Files:**
- Modify: `components/FAQList.tsx:280-281` (handleExpandAll function)
- Modify: `components/FAQList.tsx:400-406` (expand all button in toolbar)
- Modify: `lib/i18n.ts:9` (add tooltip i18n key)

**Step 1: Add i18n key for disabled tooltip**

In `lib/i18n.ts`, add after the `expandAll` entry:

```ts
expandAllDisabledTip: { zh: "详细模式下请逐个查看", en: "View items individually in detailed mode" },
```

**Step 2: Guard handleExpandAll**

In `components/FAQList.tsx`, change `handleExpandAll` (line 280):

```ts
function handleExpandAll(): void {
  if (globalDetailed) return;
  setOpenItems(new Set(paginatedItems.map((item) => item.id)));
}
```

**Step 3: Disable the button in UI**

In `components/FAQList.tsx`, replace the expand-all button (line 400-406):

```tsx
<button
  onClick={handleExpandAll}
  disabled={globalDetailed}
  title={globalDetailed ? t("expandAllDisabledTip", lang) : undefined}
  className={`rounded-full border-[0.5px] border-border px-3 py-1.5
    text-xs transition-colors ${
      globalDetailed
        ? "text-subtext/40 cursor-not-allowed"
        : "text-subtext hover:bg-surface"
    }`}
>
  {t("expandAll", lang)}
</button>
```

**Step 4: Verify**

Run: `npm run build`
Expected: Build succeeds with no errors.

Manual test: Switch to detailed mode → "全部展开" button should be grayed out and show tooltip on hover.

**Step 5: Commit**

```bash
git add components/FAQList.tsx lib/i18n.ts
git commit -m "fix: disable expand-all in detailed mode to prevent performance issue"
```

---

### Task 2: Add IntersectionObserver lazy rendering to FAQItem

**Files:**
- Modify: `components/FAQItem.tsx:1-6` (add useRef import)
- Modify: `components/FAQItem.tsx:100-120` (add observer state and hook)
- Modify: `components/FAQItem.tsx:209-260` (wrap answer content with visibility check)

**Step 1: Add useRef to imports**

In `components/FAQItem.tsx` line 3, change:

```ts
import { useState, useEffect, memo } from "react";
```
to:
```ts
import { useState, useEffect, useRef, memo } from "react";
```

**Step 2: Add IntersectionObserver state and effect**

In `components/FAQItem.tsx`, after the `shouldRender` state (line 105), add:

```ts
const [isVisible, setIsVisible] = useState(false);
const answerRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (!isOpen || !answerRef.current) {
    // Don't reset isVisible — once mode
    return;
  }
  if (isVisible) return; // Already visible, no need to observe

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.disconnect();
      }
    },
    { rootMargin: "200px" }
  );
  observer.observe(answerRef.current);
  return () => observer.disconnect();
}, [isOpen, isVisible]);

// Reset visibility when item closes
useEffect(() => {
  if (!isOpen) setIsVisible(false);
}, [isOpen]);
```

**Step 3: Add ref and conditional rendering**

In `components/FAQItem.tsx`, change the answer wrapper (line 209):

```tsx
<div className={`answer-wrapper ${isOpen ? "open" : ""}`}>
  <div ref={answerRef}>
    {shouldRender && (
      isVisible ? (
        <div className={`answer-scroll px-4 pb-4 ${
          showCheckbox ? "pl-10 md:pl-14" : "pl-4 md:pl-5"
        }`}>
          {/* ... existing content unchanged ... */}
        </div>
      ) : (
        <div className={`px-4 pb-4 ${
          showCheckbox ? "pl-10 md:pl-14" : "pl-4 md:pl-5"
        }`}>
          <div className="animate-pulse space-y-2">
            <div className="h-3 w-3/4 rounded bg-surface" />
            <div className="h-3 w-full rounded bg-surface" />
            <div className="h-3 w-5/6 rounded bg-surface" />
            <div className="h-3 w-2/3 rounded bg-surface" />
          </div>
        </div>
      )
    )}
  </div>
</div>
```

The skeleton placeholder is ~50px tall, lightweight DOM. Real markdown only renders when `isVisible` becomes true (within 200px of viewport).

**Step 4: Verify**

Run: `npm run build`
Expected: Build succeeds with no errors.

Manual test:
1. Brief mode → page size 50 → "全部展开"
2. Scroll down — items should show skeleton briefly then render markdown
3. Page should remain responsive (no jank)

**Step 5: Commit**

```bash
git add components/FAQItem.tsx
git commit -m "perf: add IntersectionObserver lazy rendering for expanded FAQ items"
```
