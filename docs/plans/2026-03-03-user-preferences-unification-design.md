# User Preferences Unification Design

Date: 2026-03-03

## Context

Current state has split preference storage:

- `users` table only stores account basics (`id`, `login`, `tier`, timestamps).
- Language/page size/default view are stored in browser `localStorage`.
- Favorites and learning status are DB-only (login required).
- Votes are dual-path (anonymous fingerprint + authenticated user).
- Home has `My Favorites` filter, while product direction is moving to `My Focus` (category-based).

This causes confusion about source-of-truth and cross-device behavior.

## Goals

1. Unify preference logic with clear source-of-truth.
2. Keep `users` focused on account identity/tier; avoid turning it into a misc settings table.
3. Add `My Focus` (big category focus) with account persistence.
4. Support login-time import flow from local settings to account settings.
5. Keep current vote behavior unchanged.

## Non-goals

1. Do not change vote product policy (anonymous voting remains supported).
2. Do not make favorites/learning available to unauthenticated users.
3. Do not migrate all historical local keys in one destructive step.

## Architecture Decision

Use a dedicated `user_preferences` table (recommended option).

### Table: `user_preferences`

- `user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE`
- `language VARCHAR(5) NULL` (`zh` / `en`)
- `page_size INTEGER NULL`
- `default_detailed BOOLEAN NULL`
- `focus_categories TEXT[] NOT NULL DEFAULT '{}'` (big categories only)
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- `updated_at TIMESTAMPTZ DEFAULT NOW()`

Rationale:

- Keeps account (`users`) and preferences decoupled.
- Simple query/update shape for current use cases.
- Easier to extend than adding columns into `users` directly.

## Source-of-Truth Rules

1. Unauthenticated user:
- Preferences live in `localStorage` only.

2. Authenticated user:
- Preferences live in DB (`user_preferences`) and are considered authoritative.
- Frontend may cache but must reconcile against DB.

3. Restricted features:
- Favorites/learning remain DB-only and require login.

4. Votes:
- Keep current dual behavior (`fingerprint` for anonymous, `user_id` for authenticated).

## Product Behavior

### Home: `My Focus`

1. Rename `My Favorites` filter button to `My Focus`.
2. Filter logic:
- When enabled, result must satisfy:
  - FAQ in user `focus_categories`, and
  - existing manual category/tag filters.
- This is an intersection behavior.
3. If `focus_categories` is empty:
- Do not enable focus filter.
- Show CTA/notice that focus is not set.
- Provide direct jump to `/profile` settings.

### Profile: Focus Settings

1. Add focus category picker in settings tab.
2. Picker only uses taxonomy categories (big tags), not leaf tags.
3. Save immediately (or explicit save action) to `user_preferences`.

## Sync + Import Strategy

To prevent repeated prompts and accidental overwrite:

### Local keys

- `aifaq-prefs-v2`: preference payload
- `aifaq-prefs-sync-v2`: sync metadata

### `aifaq-prefs-v2` shape

```json
{
  "language": "zh",
  "pageSize": 20,
  "defaultDetailed": false,
  "focusCategories": [],
  "updatedAt": "2026-03-03T00:00:00.000Z"
}
```

### `aifaq-prefs-sync-v2` shape

```json
{
  "lastSyncedServerUpdatedAt": "2026-03-03T00:00:00.000Z",
  "lastSyncedHash": "sha256...",
  "dismissedConflictKey": "userId:localHash:serverHash"
}
```

### Login reconciliation

1. Fetch server preferences.
2. Compare local hash and server hash.
3. Prompt import only when:
- local preferences exist,
- local differs from server,
- local has unsynced edits.
4. If user dismisses import, store `dismissedConflictKey` to suppress repeated prompts for same conflict.
5. Re-prompt only when local or server changes (new conflict key).

### Import behavior

1. `focus_categories`: union + dedupe.
2. Scalar preferences (`language`, `page_size`, `default_detailed`):
- choose by latest update timestamp.
3. Return merged record and update sync metadata.

## API Design

1. `GET /api/user/preferences`
- Auth required.
- Returns normalized preferences + `updated_at`.

2. `PATCH /api/user/preferences`
- Auth required.
- Partial update of preferences.
- Validate allowed page sizes and category whitelist.

3. `POST /api/user/preferences/import`
- Auth required.
- Accept local snapshot.
- Perform merge strategy.
- Return merged preferences + `updated_at`.

## Validation and Safety

1. `focus_categories` must be validated against `data/tag-taxonomy.json`.
2. Invalid categories are dropped server-side.
3. Null/legacy values are normalized in response.
4. API failure fallback:
- Keep current UI and local state.
- Show sync failure notice without destructive reset.

## Test Plan

1. Unit tests:
- merge rules (union + timestamp winner)
- conflict detection and dismissal logic
- intersection filter behavior for `My Focus`

2. API tests:
- unauthorized access handling
- validation of invalid categories/page size
- import idempotency for same payload

3. Manual scenarios:
- logged out edit -> login import once -> no repeated prompt
- login, logout, local edit, login again -> prompt only on new conflict
- empty focus click -> navigate CTA to `/profile`
- `My Focus` + manual filters => intersection result

## Rollout Notes

1. Keep backward compatibility reads for old local keys (`aifaq-pageSize`, `aifaq-pagesize`, `aifaq-defaultDetailed`, `aifaq-global-detailed`) during transition.
2. Migrate to `aifaq-prefs-v2` lazily on client read.
3. Do not alter vote tables/routes in this change set.
