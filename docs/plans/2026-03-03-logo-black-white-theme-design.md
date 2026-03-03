# AIFAQ Logo + Black/White Theme Design

**Date:** 2026-03-03  
**Status:** Approved

## 1. Background

Current home page header uses text-only brand (`AIFAQ`) and the app has a single light token set in `app/globals.css`.  
This design adds:

- Top-left branded logo (icon + `AIFAQ` wordmark)
- Black/white full-site theme switching
- Theme-aware favicon behavior

## 2. Goals

- Add a left-top brand block that includes logo icon and text.
- Provide whole-site light/dark (black/white) theme switching.
- Default behavior follows system theme on first visit.
- Persist manual theme selection for later visits.
- Keep current FAQ functionality unchanged (search/filter/pagination/modal/auth).

## 3. Non-Goals

- No redesign of business flows (login, favorites, voting, sync logic).
- No new heavyweight theme dependency.
- No per-page independent theme state.

## 4. Approach (Selected: CSS Variables + data-theme)

Use `data-theme="light|dark"` on `<html>` as the single theme source of truth.

- Define paired tokens in `app/globals.css`:
  - `:root` for light theme (white background, dark text)
  - `:root[data-theme="dark"]` for dark theme (black background, light text)
- Keep component classes on semantic tokens (`bg-bg`, `text-text`, `border-border`, etc).
- Add a small client-side theme controller for:
  - initialize from localStorage or system preference
  - write user choice to localStorage
  - optional system-theme listener only when user has not overridden

## 5. Component Design

### 5.1 New `BrandLogo` component

- Location: `components/BrandLogo.tsx`
- Responsibility:
  - Render icon (chat bubble + sparkle concept) + `AIFAQ` wordmark
  - Use CSS variables so icon/text auto-adapt across light/dark
- Usage:
  - Replace current plain title block in FAQ header

### 5.2 New `ThemeToggle` component

- Location: `components/ThemeToggle.tsx`
- Responsibility:
  - Show current mode and toggle action
  - Call shared theme setter
- Placement:
  - In top-right controls area of `components/FAQList.tsx`, close to language switch

### 5.3 Layout initialization

- File: `app/layout.tsx`
- Add a small inline script before hydration to set `data-theme` early and avoid flash.

## 6. Favicon Design

- Keep `app/favicon.ico` as compatibility fallback.
- Add theme-aware favicon assets in `public/`:
  - `favicon-light.svg`
  - `favicon-dark.svg`
- Configure `metadata.icons` in `app/layout.tsx` with `media` queries:
  - light icon for `(prefers-color-scheme: light)`
  - dark icon for `(prefers-color-scheme: dark)`

## 7. Data Flow and Persistence

Priority order:

1. User explicit choice in `localStorage` (e.g. `aifaq-theme`)
2. System preference (`prefers-color-scheme`)
3. Light fallback

Rules:

- If no explicit user choice: follow live system changes.
- If explicit user choice exists: keep user-selected mode and ignore system changes.
- Toggle updates DOM state immediately and persists choice.

## 8. Error Handling and Fallbacks

- Wrap localStorage access in `try/catch`; fallback to runtime-only switch.
- If `matchMedia` is unavailable: fallback to light mode.
- If themed SVG favicon is unsupported: browser uses `.ico` fallback.
- Any theme-init failure must not block app render.

## 9. Testing and Validation

Manual validation checklist:

1. First visit follows OS theme.
2. Manual toggle updates full-site colors immediately.
3. Refresh keeps user-selected theme.
4. If no user override, OS theme change updates page theme.
5. Header logo stays legible on both themes.
6. Favicon appears correctly for light/dark environments (at least after refresh).
7. Core interactions still work: login menu, search, tag filter, pagination, modal.

## 10. Acceptance Criteria

- Full-site black/white theme toggle is available and stable.
- Default theme follows system preference.
- User override persists across reloads.
- Top-left icon + `AIFAQ` branding is visible in header.
- Theme-aware favicon is configured with fallback.

