# FAQ Toolbar Wrap Design

**Date:** 2026-03-06  
**Status:** Approved

## 1. Background

The logged-in FAQ toolbar in `components/FAQList.tsx` adds the `ÎÒµÄ¹Ø×¢` action to an already dense control row. On narrower desktop widths, the action group and the pagination summary compete for the same horizontal space, which causes compression and awkward wrapping.

## 2. Goals

- Keep all current toolbar actions available for logged-in users.
- Let the left action area wrap naturally when width is limited.
- Preserve a clear, independent pagination summary area on the right.
- Use one responsive layout for both logged-in and logged-out states.

## 3. Non-Goals

- No functional changes to compare, focus, expand/collapse, detail mode, level filter, or sort behavior.
- No new dropdown or overflow menu.
- No copy reduction or action removal.

## 4. Selected Approach

Use a responsive two-column toolbar shell.

- The outer toolbar becomes a wrapping flex container with a gap between the action cluster and the pagination summary.
- The left action cluster keeps `flex-wrap` enabled so each logical group can move to a new line instead of compressing neighboring content.
- The pagination summary becomes its own non-growing block aligned to the right on wide widths and allowed to fall to the next line on narrower widths.
- Existing visual grouping stays intact through borders and spacing rather than introducing a new menu pattern.

## 5. Component Design

### 5.1 `components/FAQList.tsx`

- Update the toolbar shell near the list header to use `flex-wrap`, `items-start`, and a gap that supports multi-row layouts.
- Give the action region `min-w-0`, `flex-1`, and `flex-wrap` so long button groups wrap safely.
- Keep the pagination summary in a dedicated container with `shrink-0` and right alignment on larger widths.
- Preserve current button order so the most-used actions remain first.

## 6. Accessibility and Interaction

- Button hit areas and labels remain unchanged.
- Keyboard order remains the same because DOM order does not change.
- Wrapping should not hide any control or create overlap.

## 7. Testing and Validation

Use a lightweight contract test to assert the intended layout structure:

1. The toolbar shell supports wrapping and spacing between left/right regions.
2. The action cluster remains a wrapping flex container.
3. The pagination summary has its own dedicated non-shrinking alignment container.

Manual validation checklist:

1. Logged-in state shows all actions without squeezing the right summary.
2. Logged-out state still looks balanced.
3. At medium/narrow desktop widths, controls wrap instead of overlapping.
4. Pagination summary remains readable and visually separate.

## 8. Acceptance Criteria

- Logging in no longer causes the toolbar actions to squeeze the pagination summary.
- The toolbar wraps gracefully on constrained widths.
- No action is removed or functionally changed.
- Both auth states use the same stable responsive layout.
