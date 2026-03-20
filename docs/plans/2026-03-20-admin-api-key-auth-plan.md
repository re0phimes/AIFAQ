# Admin API Key Unified Auth Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add unified admin API authentication so the approved admin routes accept either GitHub admin session or `Authorization: Bearer <ADMIN_API_KEY>`, with explicit wrong-header rejection and no session fallback.

**Architecture:** Centralize auth resolution in `lib/auth.ts`, then update each approved admin route to pass `NextRequest` into the shared verifier. Lock the behavior with a small contract test and document the required environment variable in `.env.example`.

**Tech Stack:** Next.js App Router, TypeScript, NextAuth v5, Node `test` via `tsx`, PowerShell, ESLint

---

### Task 1: Add Contract Coverage for Unified Admin Auth Rules

**Files:**
- Create: `scripts/admin-api-key-auth-contract.test.ts`
- Modify if needed: `package.json`

**Step 1: Write the failing contract test**

Add a contract test that checks the source code for these behaviors:

- `lib/auth.ts` exports `verifyAdmin` with a `request` parameter
- `lib/auth.ts` reads `Authorization`
- Bearer parsing exists
- wrong `Authorization` does not fall back to session
- `.env.example` contains `ADMIN_API_KEY=`
- each target admin route calls `verifyAdmin(request)`

Target routes:

- `app/api/admin/faq/route.ts`
- `app/api/admin/faq/[id]/route.ts`
- `app/api/admin/faq/import/route.ts`
- `app/api/admin/faq/import/[id]/route.ts`
- `app/api/admin/users/[id]/route.ts`

**Step 2: Run the test to confirm failure**

Run:

```powershell
npx tsx --test scripts/admin-api-key-auth-contract.test.ts
```

Expected: FAIL because the current implementation still uses session-only auth and `.env.example` does not include `ADMIN_API_KEY=`.

**Step 3: Commit**

```bash
git add scripts/admin-api-key-auth-contract.test.ts
git commit -m "test(auth): add admin api key auth contract"
```

### Task 2: Centralize Bearer + Session Admin Verification

**Files:**
- Modify: `lib/auth.ts`

**Step 1: Implement the shared auth helper**

Update `verifyAdmin` so it supports:

- optional `request?: NextRequest`
- session-only fallback when no request or no `Authorization`
- Bearer auth when `Authorization` is present
- reject malformed or incorrect `Authorization` without session fallback
- fixed-time key comparison

Implementation requirements:

- use `crypto.timingSafeEqual`
- avoid leaking whether env is missing vs key is wrong
- return `false` for any invalid header path

**Step 2: Run the contract test**

Run:

```powershell
npx tsx --test scripts/admin-api-key-auth-contract.test.ts
```

Expected: still FAIL because route files and `.env.example` are not updated yet.

**Step 3: Run lint on the auth helper**

Run:

```powershell
npx eslint lib/auth.ts
```

Expected: PASS

**Step 4: Commit**

```bash
git add lib/auth.ts
git commit -m "feat(auth): add bearer support to admin verifier"
```

### Task 3: Update Approved Admin Routes to Use the Shared Verifier

**Files:**
- Modify: `app/api/admin/faq/route.ts`
- Modify: `app/api/admin/faq/[id]/route.ts`
- Modify: `app/api/admin/faq/import/route.ts`
- Modify: `app/api/admin/faq/import/[id]/route.ts`
- Modify: `app/api/admin/users/[id]/route.ts`

**Step 1: Switch each route to `verifyAdmin(request)`**

Make the minimal route changes:

- pass `request` into `verifyAdmin`
- remove direct session inspection from `app/api/admin/users/[id]/route.ts`
- preserve current response shape and route semantics

Do not add new route behavior beyond auth unification.

**Step 2: Run the contract test**

Run:

```powershell
npx tsx --test scripts/admin-api-key-auth-contract.test.ts
```

Expected: still FAIL only because `.env.example` has not yet been updated.

**Step 3: Run targeted lint**

Run:

```powershell
npx eslint app/api/admin/faq/route.ts app/api/admin/faq/[id]/route.ts app/api/admin/faq/import/route.ts app/api/admin/faq/import/[id]/route.ts app/api/admin/users/[id]/route.ts
```

Expected: PASS

**Step 4: Commit**

```bash
git add app/api/admin/faq/route.ts app/api/admin/faq/[id]/route.ts app/api/admin/faq/import/route.ts app/api/admin/faq/import/[id]/route.ts app/api/admin/users/[id]/route.ts
git commit -m "refactor(api): unify admin route auth entry"
```

### Task 4: Document the Required Environment Variable

**Files:**
- Modify: `.env.example`

**Step 1: Add the new env key**

Add:

```env
ADMIN_API_KEY=
```

Place it near other auth-related configuration.

**Step 2: Run the contract test**

Run:

```powershell
npx tsx --test scripts/admin-api-key-auth-contract.test.ts
```

Expected: PASS

**Step 3: Commit**

```bash
git add .env.example
git commit -m "docs(env): add admin api key example"
```

### Task 5: Final Verification

**Files:**
- No new files required unless fixes are found

**Step 1: Run the targeted contract test**

Run:

```powershell
npx tsx --test scripts/admin-api-key-auth-contract.test.ts
```

Expected: PASS

**Step 2: Run lint on all touched implementation files**

Run:

```powershell
npx eslint lib/auth.ts app/api/admin/faq/route.ts app/api/admin/faq/[id]/route.ts app/api/admin/faq/import/route.ts app/api/admin/faq/import/[id]/route.ts app/api/admin/users/[id]/route.ts scripts/admin-api-key-auth-contract.test.ts
```

Expected: PASS

**Step 3: Inspect the final diff**

Run:

```powershell
git diff -- lib/auth.ts app/api/admin/faq/route.ts app/api/admin/faq/[id]/route.ts app/api/admin/faq/import/route.ts app/api/admin/faq/import/[id]/route.ts app/api/admin/users/[id]/route.ts .env.example scripts/admin-api-key-auth-contract.test.ts
```

Expected: only unified auth changes, env doc update, and contract coverage appear.

**Step 4: Final delivery**

Report:

- unified verifier added
- 5 admin routes switched to shared auth
- `.env.example` updated
- contract test and lint status
