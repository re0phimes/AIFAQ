# FAQ Toolbar Wrap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent the logged-in FAQ toolbar from compressing the pagination summary by letting the action area wrap responsively.

**Architecture:** Add a file-contract test that locks the responsive toolbar structure in `components/FAQList.tsx`, then make the smallest className changes needed so the left action cluster can wrap and the right pagination summary keeps an independent non-shrinking slot.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4 utilities, PowerShell contract checks.

---

### Task 1: Lock the toolbar layout contract before UI changes

**Files:**
- Create: `scripts/faq-toolbar-layout-contract.test.ps1`
- Test: `scripts/faq-toolbar-layout-contract.test.ps1`

**Step 1: Write the failing test**

Create a contract test that requires `components/FAQList.tsx` to contain all of these layout markers:

```text
assert.match(source, /<div className="flex flex-wrap items-start justify-between gap-3"/);
assert.match(source, /<div className="min-w-0 flex-1"/);
assert.match(source, /<div className="flex flex-wrap items-center gap-2"/);
assert.match(source, /<div className="shrink-0 text-xs text-subtext sm:text-right"/);
```

**Step 2: Run test to verify it fails**

Run: `powershell.exe -NoProfile -File scripts/faq-toolbar-layout-contract.test.ps1`
Expected: FAIL because the toolbar still uses the old single-row shell and the pagination summary is still a plain paragraph.

**Step 3: Write minimal implementation**

No production code yet; only create the contract test.

**Step 4: Re-run to confirm RED still holds**

Run: `powershell.exe -NoProfile -File scripts/faq-toolbar-layout-contract.test.ps1`
Expected: FAIL for the missing responsive layout markers.

### Task 2: Implement the responsive toolbar wrap

**Files:**
- Modify: `components/FAQList.tsx`

**Step 1: Update the toolbar shell**

Change the outer toolbar container so it wraps and aligns its two regions independently.

**Step 2: Update the left action region**

Wrap the current button groups in an intermediate `min-w-0 flex-1` container, keeping the existing internal `flex-wrap` action cluster.

**Step 3: Update the pagination summary region**

Replace the inline paragraph placement with a dedicated `div` that uses non-shrinking right alignment and preserves the existing summary text.

**Step 4: Run the contract test**

Run: `powershell.exe -NoProfile -File scripts/faq-toolbar-layout-contract.test.ps1`
Expected: PASS.

### Task 3: Verify the edited files stay healthy

**Files:**
- Verify: `components/FAQList.tsx`
- Verify: `scripts/faq-toolbar-layout-contract.test.ps1`

**Step 1: Re-run the contract check**

Run: `powershell.exe -NoProfile -File scripts/faq-toolbar-layout-contract.test.ps1`
Expected: PASS.

**Step 2: Record the resulting diff**

Run: `git diff -- components/FAQList.tsx scripts/faq-toolbar-layout-contract.test.ps1 docs/plans/2026-03-06-faq-toolbar-wrap-design.md docs/plans/2026-03-06-faq-toolbar-wrap-plan.md`
Expected: Only the responsive toolbar changes, new contract test, and planning docs appear.


