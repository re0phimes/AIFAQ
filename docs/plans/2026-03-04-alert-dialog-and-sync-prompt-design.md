# Unified Action Dialog + Login Prompt Dedupe Design

Date: 2026-03-04

## Context

Current UX has two issues:

1. Login-time local preference import prompt can appear repeatedly.
2. User-blocking prompts still use native `window.alert` / `window.confirm`, inconsistent with page style.

Confirmed requirements:

- Keep root-cause analysis first, then solution.
- Replace all user-blocking alerts/confirms with consistent in-page dialog.
- Clicking backdrop means default cancel.
- Include admin review page alerts.
- Unauthenticated favorite click should be alert-only (no navigation).

## Root Cause Analysis (Repeated Prompt)

In `app/FAQPage.tsx`, when user dismisses import:

- Branch writes `dismissedConflictKey` correctly.
- Later common sync-meta write uses stale `syncMeta.dismissedConflictKey` and overwrites the newly written key.

Result: same conflict key is not persisted, prompt suppression fails, same prompt can reappear.

Also, the login sync effect has re-entry risk:

- Effect depends on mutable render context (including language-related updates).
- No in-flight/idempotency guard around prompt sequence.

This amplifies repeated prompt behavior in multi-run scenarios.

## Goals

1. Fix repeated login import prompt for same conflict.
2. Unify blocking prompt UX across pages with one in-page dialog system.
3. Standardize default cancel behavior (backdrop + ESC).
4. Keep implementation minimal and reusable (no over-engineered global queue).

## Non-goals

1. No redesign of existing business flows.
2. No queueing/prioritization framework for multiple dialogs.
3. No changes to non-blocking toast behavior.

## Proposed Approach (Chosen)

Use a shared `ActionDialog` + `useActionDialog` abstraction, and patch login sync flow to be idempotent.

### Why this approach

- Solves current incidents directly.
- Keeps API ergonomics close to native alert/confirm (`await showConfirm(...)`).
- Ensures style and behavior consistency across home/admin without duplicated per-page modal logic.

## Architecture

### 1) Shared blocking dialog

Create `components/ActionDialog.tsx`:

- Modes:
  - `kind: "alert"` (single action)
  - `kind: "confirm"` (confirm/cancel)
- Behavior:
  - Backdrop click => cancel
  - ESC => cancel
  - Close button => cancel
- Style:
  - Reuse existing design tokens (`bg-panel`, `border-border`, `text-text`, `bg-primary`)
  - Centered fixed overlay (`z-50`)

Create `components/useActionDialog.tsx` (or `lib/`):

- `showAlert(options): Promise<void>`
- `showConfirm(options): Promise<boolean>`
- `dialogNode` for rendering near page root

### 2) Login sync dedupe fix

In `app/FAQPage.tsx`:

- Refactor sync meta update to single final write (no branch overwrite of `dismissedConflictKey`).
- Add guards:
  - `syncInFlightRef` (avoid concurrent prompt flow)
  - `lastHandledConflictKeyRef` (avoid same-run duplicate handling)
- Remove unnecessary effect churn dependencies; read runtime text values at execution time.

## Scope of Replacement

Replace all blocking native prompt calls in active app code:

1. `app/FAQPage.tsx`
- login import confirm
- focus-empty navigation confirm

2. `components/FAQItem.tsx`
- unauthenticated favorite alert
- behavior: alert only, no redirect/login action

3. `app/admin/review/page.tsx`
- action failure alerts

## Data Flow

### Login-time reconciliation flow

1. Fetch server preferences.
2. Compute `localHash`, `serverHash`, unsynced state.
3. Evaluate `shouldPromptImport`.
4. If prompt needed:
- `showConfirm(...)`
- confirm -> call import API, apply merged prefs, update sync meta.
- cancel -> store `dismissedConflictKey` for current conflict, then apply server prefs.
5. Persist sync meta once with finalized values.

Guarantee: same `userId:localHash:serverHash` conflict is suppressed after dismissal until local/server content changes.

## Error Handling

1. Dialog promise safety
- Always resolve on close/cancel; never leave pending promise.

2. Preference sync API failures
- GET failure: keep current local state, no destructive overwrite.
- Import failure: fallback to non-import path without infinite reprompt loop.

3. Admin action failures
- Show unified alert dialog with error message.

## UX and Accessibility

1. Keyboard
- ESC closes dialog as cancel.

2. Backdrop
- Click backdrop = default cancel.

3. Mobile
- Width constrained to viewport (`min(92vw, 28rem)` style intent).

4. Language
- Dialog text follows current `zh/en` context.

## Validation Checklist

1. Repeated prompt prevention
- Dismiss same conflict once -> no repeated prompt on refresh/re-entry.
- Change local or server prefs -> new conflict key -> prompt appears again.

2. Blocking prompt consistency
- No native `window.alert` / `window.confirm` in app pages.

3. Behavior correctness
- Backdrop click and ESC always equal cancel.
- Unauthenticated favorite action shows alert-only prompt.

4. Admin coverage
- Review-page failures use unified dialog.

## Risks and Mitigations

1. Risk: dialog state leaks between pages
- Mitigation: keep hook state local to each page root and reset after resolve.

2. Risk: async re-entry during login sync
- Mitigation: in-flight + handled-conflict refs and single-write sync meta.

3. Risk: style mismatch
- Mitigation: strictly use existing token classes and modal conventions.
