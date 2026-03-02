# Profile Favorites Non-Navigation Detail Design

Date: 2026-03-02  
Branch: main

## Overview

Current profile favorites items link to `/faq/:id`, but all `/faq/<number>` pages currently return 404 in production due to route param handling mismatch with Next.js 16.  
User requirement: favorites page should not navigate away; it should behave like homepage interaction.

Target behavior:
- `Brief` mode: click item to expand inline
- `Detailed` mode: click item to open modal

## Problem Analysis

### Observed symptoms
- Production URL `https://aifaq.phimes.top/faq/1` returns 404.
- Favorites item title currently uses `href=/faq/${faq_id}`, so all such clicks fail.
- User also prefers non-navigation interaction instead of detail-page navigation.

### Root cause (for `/faq/[id]` 404)
- `app/faq/[id]/page.tsx` reads `params` synchronously.
- In this project (Next.js 16), dynamic route params are handled asynchronously.
- This causes `params.id` to resolve incorrectly, producing `NaN` and triggering `notFound()`.

## Design Decisions

### 1) Profile interaction model (approved)
- Align profile favorites with homepage mode behavior.
- Keep both modes:
  - `Brief`: inline expansion in list
  - `Detailed`: modal detail (`DetailModal`)

### 2) Favorite item interaction
- Remove navigation dependency from favorites cards.
- Replace clickable `Link` title with interaction callback trigger.
- Preserve existing favorite/status actions.

### 3) `/faq/[id]` page role and presentation
- Keep `/faq/[id]` for direct links and external entry.
- Present as page-version of detailed content (same information density as modal):
  - header metadata
  - markdown answer
  - images/references
  - vote/favorite actions
- Fix params handling to avoid global 404 regression.

## Architecture

### Components
- `app/profile/ProfileClient.tsx`
  - add mode-aware open behavior similar to homepage
  - own modal state for favorites detailed view
  - manage inline open state for brief view
- `components/FavoriteCard.tsx`
  - switch from navigation card to interactive card
  - support inline expanded body in brief mode
- `app/faq/[id]/page.tsx`
  - align param parsing with Next.js 16 route contract
  - keep direct-access experience available

### Data flow
- Favorites page uses existing favorites payload from server (`faq` object embedded in favorite rows).
- No extra fetch required for opening item in list/modal.
- Existing vote/favorite/status endpoints remain unchanged.

## Error Handling

- Invalid/non-numeric `id` for `/faq/[id]` => `404` (unchanged).
- Missing FAQ in DB => `404` (unchanged).
- Favorites item with unavailable FAQ content => graceful disabled/unavailable display in profile list.
- No hard redirect from favorites interactions.

## Testing and Acceptance

1. `/faq/1` (or any valid existing id) no longer fails due to params parsing.
2. In profile page:
   - `Brief` mode: item click expands inline.
   - `Detailed` mode: item click opens modal.
3. Favorites interaction does not navigate to `/faq/:id`.
4. Vote/favorite actions continue to work in modal/page detail.
5. Existing build and type checks pass.

## Scope

In scope:
- Profile interaction refactor to non-navigation detail experience
- `/faq/[id]` param handling fix and presentation alignment

Out of scope:
- Major visual redesign of homepage components
- Backend schema changes
- New endpoints

