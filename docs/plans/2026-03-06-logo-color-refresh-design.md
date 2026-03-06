# AIFAQ Header Logo Color Refresh Design

**Date:** 2026-03-06  
**Status:** Approved

## 1. Background

The current header logo in `components/BrandLogo.tsx` already separates the `AI` and `FAQ` wordmark colors at a basic level, but the icon still reads as monochrome in the light theme. The brand block is also not a clickable home/top affordance, and the hover state should feel stable instead of skewed.

## 2. Goals

- Give the top-left logo a clear black / red / gold identity in the white theme.
- Increase separation between the `AI` and `FAQ` wordmark segments.
- Make the full logo block clickable and able to jump to the top of the current home page.
- Replace any awkward hover tilt feeling with a stable, premium hover response.

## 3. Non-Goals

- No site-wide header redesign.
- No changes to search, filtering, auth, or FAQ interaction flows.
- No asset pipeline or image export work; keep the logo as inline SVG.

## 4. Selected Approach

Use the existing inline SVG logo and enhance it with semantic brand color tokens.

- `AI` uses a deep red accent.
- `FAQ` uses a warm gold accent.
- The icon keeps a dark outline for structure, then adds red and gold internal details for a stronger branded read.
- The brand block becomes a link to `/#top`, and the page root gets an explicit `id="top"` anchor.
- Hover feedback uses subtle upward motion, border/background polish, and color reinforcement only; no rotation or skew.

## 5. Component Design

### 5.1 `components/BrandLogo.tsx`

- Convert the root from a passive `div` into a clickable brand link.
- Keep the icon inline for crisp rendering.
- Apply red/gold fills to the inner icon motifs while leaving the outer bubble outline theme-aware.
- Add a stable hover/focus state with no tilt.

### 5.2 `app/globals.css`

- Add semantic brand color tokens for:
  - ink / outline
  - AI red
  - FAQ gold
  - supporting gold highlight if needed
- Keep them usable from Tailwind utility classes and inline SVG color references.

### 5.3 `app/page.tsx`

- Add the `top` anchor target so the header logo can jump to the current page top.

## 6. Accessibility and Interaction

- The logo link needs an explicit `aria-label` describing its navigation target.
- Keyboard focus should remain visible.
- Hover and focus should not distort geometry.

## 7. Testing and Validation

Use a small contract test to assert the intended integration points:

1. Brand color tokens exist in `app/globals.css`.
2. `BrandLogo` links to `/#top` and contains separate `AI` / `FAQ` classes.
3. The home page exposes `id="top"` for the anchor target.

Manual validation checklist:

1. In light theme, the logo reads as black + red + gold rather than black/white only.
2. Hover feels steady and does not visibly skew.
3. Clicking the logo from lower on the page returns to the top.
4. Existing header layout remains aligned on mobile and desktop.

## 8. Acceptance Criteria

- The top-left logo is visibly colored in the light theme.
- `AI` and `FAQ` are clearly distinguished.
- The hover state is stable and non-tilting.
- Clicking the logo jumps to the page top via the current-page anchor.
