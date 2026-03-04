# Unified Action Dialog and Prompt Dedupe Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 统一所有阻断型提示为页面内一致弹框，并修复登录后本地偏好导入提示重复弹出的问题。

**Architecture:** 新增可复用的 `ActionDialog` + `useActionDialog` 作为统一阻断交互层，替换首页/列表项/后台审核中的原生 `alert/confirm`。登录偏好同步流程通过“单次 sync meta 写入 + 防重入 guard”修复同冲突重复提示。优先提取可测试的纯逻辑到 `lib/preferences-sync.ts`，其余走契约测试 + 手工验收。

**Tech Stack:** Next.js 16, React 19, TypeScript, node:test + tsx, ESLint

---

### Task 1: 修复可测试的 sync-meta 覆写根因（先红后绿）

**Files:**
- Modify: `lib/preferences-sync.ts`
- Modify: `lib/preferences-sync.test.ts`
- Modify: `app/FAQPage.tsx`

**Step 1: Write the failing test**

在 `lib/preferences-sync.test.ts` 新增测试，覆盖“dismissedConflictKey 不应被后续写入覆盖”的纯函数行为。

```ts
test("finalizeSyncMeta keeps newly dismissed conflict key", () => {
  const next = finalizeSyncMeta({
    previous: {
      lastSyncedServerUpdatedAt: "2026-03-03T00:00:00.000Z",
      lastSyncedHash: "old",
      dismissedConflictKey: null,
    },
    serverUpdatedAt: "2026-03-04T00:00:00.000Z",
    serverHash: "server-new",
    dismissedConflictKey: "u1:localA:server-new",
  });

  assert.equal(next.dismissedConflictKey, "u1:localA:server-new");
  assert.equal(next.lastSyncedHash, "server-new");
});
```

**Step 2: Run test to verify it fails**

Run: `npx tsx --test lib/preferences-sync.test.ts`

Expected: FAIL（`finalizeSyncMeta` 未定义）。

**Step 3: Write minimal implementation**

在 `lib/preferences-sync.ts` 增加最小可复用函数：

```ts
export interface PreferenceSyncMeta {
  lastSyncedServerUpdatedAt: string | null;
  lastSyncedHash: string | null;
  dismissedConflictKey: string | null;
}

export function finalizeSyncMeta(input: {
  previous: PreferenceSyncMeta;
  serverUpdatedAt: string | null;
  serverHash: string | null;
  dismissedConflictKey?: string | null;
}): PreferenceSyncMeta {
  return {
    lastSyncedServerUpdatedAt: input.serverUpdatedAt,
    lastSyncedHash: input.serverHash,
    dismissedConflictKey:
      input.dismissedConflictKey !== undefined
        ? input.dismissedConflictKey
        : input.previous.dismissedConflictKey,
  };
}
```

并在 `app/FAQPage.tsx` 中改为统一使用该函数构造最终 meta，再 `savePreferenceSyncMeta` 一次。

**Step 4: Run tests to verify pass**

Run: `npx tsx --test lib/preferences-sync.test.ts`

Expected: PASS。

**Step 5: Commit**

```bash
git add lib/preferences-sync.ts lib/preferences-sync.test.ts app/FAQPage.tsx
git commit -m "fix: prevent dismissed conflict key overwrite in preference sync"
```

### Task 2: 建立“禁止原生阻断提示”契约测试（先红）

**Files:**
- Create: `scripts/native-prompt-contract.test.ts`

**Step 1: Write the failing test**

新建契约测试，扫描以下文件中是否仍存在原生调用：

- `app/FAQPage.tsx`
- `components/FAQItem.tsx`
- `app/admin/review/page.tsx`

测试断言禁止：`window.alert(`、`alert(`、`window.confirm(`、`confirm(`。

```ts
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const files = [
  "app/FAQPage.tsx",
  "components/FAQItem.tsx",
  "app/admin/review/page.tsx",
];

test("no native blocking prompt APIs in app code", () => {
  const bad: string[] = [];
  for (const file of files) {
    const src = fs.readFileSync(file, "utf8");
    const hit = src.match(/\b(window\.)?(alert|confirm)\s*\(/g);
    if (hit) bad.push(`${file}: ${hit.join(", ")}`);
  }
  assert.equal(bad.length, 0, bad.join("\n"));
});
```

**Step 2: Run test to verify it fails**

Run: `npx tsx --test scripts/native-prompt-contract.test.ts`

Expected: FAIL（当前仍有多处原生调用）。

**Step 3: Commit the red test (optional but recommended)**

```bash
git add scripts/native-prompt-contract.test.ts
git commit -m "test: add contract to ban native alert/confirm"
```

### Task 3: 新增统一弹框组件与 hook（替换 FAQPage confirm）

**Files:**
- Create: `components/ActionDialog.tsx`
- Create: `components/useActionDialog.tsx`
- Modify: `app/FAQPage.tsx`
- Modify: `lib/i18n.ts`

**Step 1: Write minimal UI implementation**

在 `components/ActionDialog.tsx` 实现：

- `kind: "alert" | "confirm"`
- title/message
- confirm/cancel 文案
- backdrop click -> cancel
- ESC -> cancel
- token 风格（`bg-panel`, `border-border`, `text-text`, `bg-primary`）

在 `components/useActionDialog.tsx` 实现 Promise API：

- `showAlert(...)`
- `showConfirm(...)`
- `dialogNode`

**Step 2: Replace FAQPage confirm flows**

把 `app/FAQPage.tsx` 中两处 `window.confirm` 替换为：

```ts
const accepted = await showConfirm({ ... });
```

并在 JSX 根部渲染 `dialogNode`。

同时加入防重入：

- `syncInFlightRef`
- `lastHandledConflictKeyRef`

**Step 3: Add/adjust i18n keys**

在 `lib/i18n.ts` 增加弹框按钮与标题文案（如 `ok`, `confirm`, `notice`, `syncPromptTitle`），避免硬编码重复。

**Step 4: Run targeted checks**

Run:

```bash
npx eslint app/FAQPage.tsx components/ActionDialog.tsx components/useActionDialog.tsx lib/i18n.ts
npx tsx --test lib/preferences-sync.test.ts
```

Expected: PASS。

**Step 5: Commit**

```bash
git add app/FAQPage.tsx components/ActionDialog.tsx components/useActionDialog.tsx lib/i18n.ts lib/preferences-sync.ts
git commit -m "feat: add unified action dialog and replace home confirm flows"
```

### Task 4: 替换 FAQItem 与 Admin Review 的原生 alert

**Files:**
- Modify: `components/FAQItem.tsx`
- Modify: `app/admin/review/page.tsx`
- Modify: `app/FAQPage.tsx` (if dialog API needs prop threading)

**Step 1: FAQItem alert migration**

未登录收藏改为 `showAlert`：

- 行为保持“只提示，不跳转”
- 保留轻触震动逻辑（如果存在）

**Step 2: Admin Review alert migration**

将失败分支统一改为 `showAlert({ title, message })`。

**Step 3: Ensure no native APIs remain**

Run: `npx tsx --test scripts/native-prompt-contract.test.ts`

Expected: PASS。

**Step 4: Run targeted lint**

Run: `npx eslint components/FAQItem.tsx app/admin/review/page.tsx`

Expected: PASS。

**Step 5: Commit**

```bash
git add components/FAQItem.tsx app/admin/review/page.tsx app/FAQPage.tsx
git commit -m "refactor: replace native alerts with unified action dialog"
```

### Task 5: 最终验证与回归检查

**Files:**
- Verify only (no required file edits)

**Step 1: Static checks**

Run:

```bash
npx tsx --test lib/preferences-sync.test.ts scripts/native-prompt-contract.test.ts
npm run lint
```

Expected: PASS。

**Step 2: Manual verification (required)**

Run: `npm run dev`

Manual checklist:

1. 登录冲突提示：取消后同冲突不重复弹。
2. 本地或服务端偏好变更后：新冲突会再次弹。
3. 点击遮罩/ESC：都走默认取消。
4. 未登录点收藏：仅出现提示弹框，不跳转。
5. 后台审核失败：出现统一样式弹框。

**Step 3: Build smoke (optional but recommended)**

Run: `npm run build`

Expected: PASS。

**Step 4: Commit verification artifacts (if any)**

```bash
git add -A
git commit -m "chore: finalize verification for unified blocking dialogs"
```

---

## Notes For Execution

1. 全流程按 `@test-driven-development`：先失败测试，再最小实现，再通过。
2. 若出现预期外行为，先执行 `@systematic-debugging`，避免猜测式修改。
3. 宣告完成前执行 `@verification-before-completion`，用命令输出证明结果。
4. 执行本计划时，优先在隔离 worktree 中进行，避免主分支上下文污染。
