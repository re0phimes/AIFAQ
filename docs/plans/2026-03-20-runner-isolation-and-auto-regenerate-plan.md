# Runner Isolation and Auto-Regenerate Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the minimum end-to-end isolated execution flow for admin reject-driven regenerate: reject records structured reasons, creates a task, dispatches work to a self-hosted runner, receives a runner callback, and writes the FAQ back into `review`.

**Architecture:** Implement the shared persistence and state machine first, then split execution into two parallel-safe slices: dispatch and callback. After those are stable, reconnect the admin reject flow to create and trigger regenerate tasks, then verify the full closed loop. Admin auth continues to use `verifyAdmin(request)`, while runner callback auth uses a separate shared secret.

**Tech Stack:** Next.js App Router, TypeScript, `@vercel/postgres`, Node `test` via `tsx`, ESLint

---

### Task 1: Add Contract Coverage for the Minimum Closed Loop

**Files:**
- Create: `scripts/admin-runner-regenerate-contract.test.ts`

**Step 1: Write the failing contract test**

Add source-level contract coverage for:

- `app/api/admin/faq/[id]/route.ts` reject path reads `reasons` and `note`
- `lib/db.ts` contains `faq_reject_events`
- `lib/db.ts` contains `admin_tasks`
- `app/api/admin/tasks/[id]/dispatch/route.ts` exists
- `app/api/admin/tasks/[id]/callback/route.ts` exists
- callback path references `sanitize`
- callback path references `RUNNER_SHARED_SECRET`

**Step 2: Run the test to confirm failure**

Run:

```powershell
npx tsx --test scripts/admin-runner-regenerate-contract.test.ts
```

Expected: FAIL because the task persistence layer and runner APIs do not exist yet.

**Step 3: Commit**

```bash
git add scripts/admin-runner-regenerate-contract.test.ts
git commit -m "test(admin): add runner regenerate contract"
```

### Task 2: Add Shared Persistence and Task Primitives

**Files:**
- Modify: `lib/db.ts`
- Create: `lib/admin-task-types.ts`

**Step 1: Implement the minimum schema**

Add `initDB()` support for:

- `faq_reject_events`
- `admin_tasks`

Add helpers for:

- `createRejectEvent(...)`
- `createAdminTask(...)`
- `getAdminTaskById(...)`
- `updateAdminTaskStatus(...)`

Keep the schema minimal and aligned with the approved state machine:

- `pending`
- `running`
- `succeeded`
- `failed`

**Step 2: Run the contract test**

Run:

```powershell
npx tsx --test scripts/admin-runner-regenerate-contract.test.ts
```

Expected: still FAIL because dispatch/callback routes and reject flow wiring are not implemented yet.

**Step 3: Run targeted lint**

Run:

```powershell
npx eslint lib/db.ts lib/admin-task-types.ts
```

Expected: PASS

**Step 4: Commit**

```bash
git add lib/db.ts lib/admin-task-types.ts
git commit -m "feat(admin): add reject event and task persistence primitives"
```

### Task 3: Parallel Slice A - Implement Dispatch API

**Files:**
- Create: `app/api/admin/tasks/[id]/dispatch/route.ts`
- Create: `lib/admin-task-dispatch.ts`

**Step 1: Implement dispatch behavior**

Requirements:

- admin-only route via `verifyAdmin(request)`
- load task by id
- reject if task is not `pending`
- build runner request payload from stored task data
- send to runner webhook
- move task to `running` on success

Keep this slice focused on dispatch only. Do not implement callback logic here.

**Step 2: Run targeted lint**

Run:

```powershell
npx eslint app/api/admin/tasks/[id]/dispatch/route.ts lib/admin-task-dispatch.ts
```

Expected: PASS

**Step 3: Commit**

```bash
git add app/api/admin/tasks/[id]/dispatch/route.ts lib/admin-task-dispatch.ts
git commit -m "feat(admin): add runner task dispatch api"
```

### Task 4: Parallel Slice B - Implement Callback API and Sanitization

**Files:**
- Create: `app/api/admin/tasks/[id]/callback/route.ts`
- Create: `lib/sanitize.ts`

**Step 1: Implement callback behavior**

Requirements:

- accept runner-only auth via `Authorization: Bearer <RUNNER_SHARED_SECRET>`
- reject invalid auth with `401`
- load task by id
- reject if task is not `running`
- sanitize callback payload before persistence
- mark task as `succeeded` or `failed`

Do not wire this into reject flow yet. Keep this slice focused on callback correctness.

**Step 2: Run targeted lint**

Run:

```powershell
npx eslint app/api/admin/tasks/[id]/callback/route.ts lib/sanitize.ts
```

Expected: PASS

**Step 3: Commit**

```bash
git add app/api/admin/tasks/[id]/callback/route.ts lib/sanitize.ts
git commit -m "feat(admin): add runner callback api and sanitize layer"
```

### Task 5: Integrate Reject -> Task -> Dispatch

**Files:**
- Modify: `app/api/admin/faq/[id]/route.ts`
- Modify if needed: `lib/admin-task-dispatch.ts`

**Step 1: Extend reject action input**

Add support for:

- `reasons: string[]`
- `note?: string`

Validate against the approved reject reason enum.

**Step 2: Create reject event and task**

On `action === "reject"`:

- update FAQ to `rejected`
- create `faq_reject_events` row
- create `admin_tasks` row with:
  - `task_type = regenerate`
  - `source = reject_auto`
- return `taskId`

**Step 3: Trigger dispatch**

After task creation, dispatch the task through the shared dispatch helper so the full flow begins immediately.

**Step 4: Run the contract test**

Run:

```powershell
npx tsx --test scripts/admin-runner-regenerate-contract.test.ts
```

Expected: may still fail if callback persistence-to-FAQ writeback is not yet connected.

**Step 5: Run targeted lint**

Run:

```powershell
npx eslint app/api/admin/faq/[id]/route.ts lib/admin-task-dispatch.ts
```

Expected: PASS

**Step 6: Commit**

```bash
git add app/api/admin/faq/[id]/route.ts lib/admin-task-dispatch.ts
git commit -m "feat(admin): create and dispatch regenerate task on reject"
```

### Task 6: Integrate Callback -> FAQ Writeback

**Files:**
- Modify: `app/api/admin/tasks/[id]/callback/route.ts`
- Modify if needed: `lib/db.ts`

**Step 1: Write successful callback result back into FAQ**

On successful callback:

- load the FAQ target from task payload
- update FAQ status back to `review`
- write answer/content fields from sanitized callback payload
- record source marker such as `reject_auto:<taskId>` via existing version/change metadata path

On failed callback:

- mark task `failed`
- do not auto-publish or auto-transition FAQ into published

**Step 2: Run the contract test**

Run:

```powershell
npx tsx --test scripts/admin-runner-regenerate-contract.test.ts
```

Expected: PASS

**Step 3: Run targeted lint**

Run:

```powershell
npx eslint app/api/admin/tasks/[id]/callback/route.ts lib/db.ts
```

Expected: PASS

**Step 4: Commit**

```bash
git add app/api/admin/tasks/[id]/callback/route.ts lib/db.ts
git commit -m "feat(admin): write runner callback results back into faq review"
```

### Task 7: Final Verification

**Files:**
- Modify only if fixes are found

**Step 1: Run the closed-loop contract test**

Run:

```powershell
npx tsx --test scripts/admin-runner-regenerate-contract.test.ts
```

Expected: PASS

**Step 2: Run lint on all touched files**

Run:

```powershell
npx eslint lib/db.ts lib/admin-task-types.ts lib/admin-task-dispatch.ts lib/sanitize.ts app/api/admin/faq/[id]/route.ts app/api/admin/tasks/[id]/dispatch/route.ts app/api/admin/tasks/[id]/callback/route.ts scripts/admin-runner-regenerate-contract.test.ts
```

Expected: PASS

**Step 3: Inspect final diff**

Run:

```powershell
git diff -- lib/db.ts lib/admin-task-types.ts lib/admin-task-dispatch.ts lib/sanitize.ts app/api/admin/faq/[id]/route.ts app/api/admin/tasks/[id]/dispatch/route.ts app/api/admin/tasks/[id]/callback/route.ts scripts/admin-runner-regenerate-contract.test.ts
```

Expected: only the minimum isolated-runner closed-loop implementation appears.

**Step 4: Final delivery**

Report:

- shared task persistence added
- dispatch and callback APIs added
- reject now creates and dispatches regenerate tasks
- callback writes successful results back into FAQ review
- contract test and lint status
