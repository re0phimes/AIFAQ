# Favorites Reminder And Typography Design

## Context

Current profile favorite reminders are based on a 90-day stale rule and do not show relative time on cards. The project now needs:

1. A 14-day review nudge based on `last_viewed_at ?? created_at`
2. Nudge visibility for `unread` and `learning` only
3. Relative time display per favorite card (days/weeks)
4. Typography density improvements in profile-related UI

## Goals

1. Keep reminder rules consistent across server page rendering and API responses
2. Avoid duplicated reminder logic across components
3. Keep existing interaction behavior unchanged (inline expand / modal)
4. Improve readability and information density with smaller, consistent text scale

## Non-Goals

1. Redesign profile interaction model
2. Change reminder to notification/push system
3. Introduce extra persistence fields

## Architecture

Introduce a shared domain helper module `lib/favorite-reminder.ts` as the single source of truth for reminder behavior.

Core helper responsibilities:

1. Resolve reminder reference time using `last_viewed_at ?? created_at`
2. Compute relative time labels (`X days ago`, `X weeks ago` and Chinese equivalents)
3. Compute nudge eligibility based on status + threshold day
4. Compute profile stats using the same rules for both page and API

This removes drift between:

1. `app/profile/page.tsx`
2. `app/api/user/favorites/route.ts`
3. `app/profile/ProfileClient.tsx`

## Data Model Shape

For each favorite item exposed to UI, add computed fields:

1. `relative_time_label: string`
2. `needs_nudge: boolean`

Keep existing fields unchanged for compatibility.

Stats payload remains:

1. `total`
2. `unread`
3. `learning`
4. `mastered`
5. `stale` (reused as 14-day nudge count for backward compatibility in client code)

## Reminder Rules

1. `referenceTime = last_viewed_at ?? created_at`
2. `needs_nudge = (status in [unread, learning]) AND elapsedDays >= 14`
3. Invalid/missing time:
   - relative label falls back to localized unknown string
   - nudge disabled
4. Negative elapsed days are clamped to `0`

## UI Changes

### FavoriteCard

1. Add a relative-time row below status
2. Add reminder badge when `needs_nudge = true`
3. Keep card action behavior unchanged

### ProfileClient

1. Consume precomputed fields from server data
2. Do not recalculate reminder logic in component
3. Keep existing modal/expand behavior
4. Continue using summary reminder box with `stats.stale`

### Typography

Adjust text scale and spacing in:

1. `app/profile/ProfileClient.tsx`
2. `components/FavoriteCard.tsx`
3. `components/FAQItem.tsx`

Guidelines:

1. Main title down one level (`text-3xl -> text-2xl`)
2. Card title/body/auxiliary text down one level where safe
3. Keep touch targets and action button usability unchanged

## Error Handling

1. Date parse failure: no crash, no nudge
2. Missing timestamps: fallback label + no nudge
3. Future timestamp: clamp to 0 day elapsed

## Testing Strategy

Add unit tests for `lib/favorite-reminder.ts` covering:

1. Reference-time precedence
2. 13/14/15-day threshold boundaries
3. Status gating (`unread`, `learning`, `mastered`)
4. Relative time output (days/weeks)
5. Invalid date behavior

Then run:

1. Targeted tests for reminder helper
2. Type-check/build verification

## Rollout And Risk

Low-to-medium risk. Main risk is behavior drift from previous 90-day logic and UI assumptions around `stats.stale`. Risk is controlled by central helper usage and threshold boundary tests.
