# Header Logo Color Refresh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refresh the home-page brand logo so it uses a black / red / gold identity, has a stable hover state, and links to the current page top.

**Architecture:** Keep the existing inline SVG logo component, introduce explicit brand color tokens in global theme CSS, and wire the brand block to `/#top` so navigation stays simple and framework-native. Validate the change with a lightweight file-contract test because this repo does not currently include a React component test harness.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4 theme tokens, Node test runner with `tsx`.

---

### Task 1: Lock the logo contract before UI changes

**Files:**
- Create: `scripts/logo-contract.test.ps1`
- Test: `scripts/logo-contract.test.ps1`

**Step 1: Write the failing test**

Create assertions that require:

```ts
assert.match(globalsCss, /--app-color-brand-ai:/);
assert.match(globalsCss, /--app-color-brand-faq:/);
assert.match(brandLogo, /href="\/#top"/);
assert.match(brandLogo, /text-brand-ai/);
assert.match(brandLogo, /text-brand-faq/);
assert.match(homePage, /id="top"/);
```

**Step 2: Run test to verify it fails**

Run: `powershell.exe -NoProfile -File scripts/logo-contract.test.ps1`
Expected: FAIL because the new tokens, link target, and anchor do not exist yet.

**Step 3: Write minimal implementation**

No production code yet; only create the contract test.

**Step 4: Re-run to confirm RED still holds**

Run: `powershell.exe -NoProfile -File scripts/logo-contract.test.ps1`
Expected: FAIL for the intended missing contract.

### Task 2: Implement the colored clickable logo

**Files:**
- Modify: `components/BrandLogo.tsx`
- Modify: `app/globals.css`

**Step 1: Update color tokens**

Add brand tokens for AI red and FAQ gold in `app/globals.css`, and expose them through `@theme inline`.

**Step 2: Update the logo component**

- Wrap the brand in a link to `/#top`.
- Add `aria-label`.
- Use `text-brand-ai` and `text-brand-faq` for the wordmark split.
- Color the internal SVG details with red/gold while keeping the outer stroke theme-aware.
- Use subtle hover motion only (no rotate/skew).

**Step 3: Run the contract test**

Run: `powershell.exe -NoProfile -File scripts/logo-contract.test.ps1`
Expected: PASS.

### Task 3: Wire the page-top anchor and verify integration

**Files:**
- Modify: `app/page.tsx`
- Verify: `components/FAQList.tsx`

**Step 1: Add the anchor target**

Set `id="top"` on the home page root container so `/#top` resolves on the current page.

**Step 2: Check header fit**

Verify the existing `BrandLogo` usage in `components/FAQList.tsx` still fits the compact header layout without extra wrapper changes.

**Step 3: Run verification**

Run:
- `powershell.exe -NoProfile -File scripts/logo-contract.test.ps1`
- `npx eslint components/BrandLogo.tsx app/page.tsx app/globals.css scripts/logo-contract.test.ts`
- `npm run build`

Expected:
- Contract test PASS
- ESLint clean
- Production build succeeds
