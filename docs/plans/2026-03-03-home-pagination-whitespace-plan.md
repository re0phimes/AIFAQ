# Home Pagination And Whitespace Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将主站默认每页改为 10，并在 pageSize 切换与短列表场景下消除明显底部大空白。

**Architecture:** 在 `FAQList` 内对 pageSize 读取做合法值约束（10/20/50）并把默认值降到 10；在切换 pageSize 时强制滚动到顶部，避免切小页后停留低位造成空白。为减少短页视觉空洞，在主内容容器加入轻量 `min-height` 双保险，且不改变 sticky、compare、筛选与排序既有逻辑。

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, ESLint, Node.js

---

### Task 1: 建立分页与空白回归检查（先失败）

**Files:**
- Modify: `scripts/check-compact-top-layout.mjs`
- Test: `scripts/check-compact-top-layout.mjs`

**Step 1: Write the failing test**

在 `scripts/check-compact-top-layout.mjs` 中新增 `home-pagination` scope，断言以下 token：

```js
"home-pagination": [
  { file: "components/FAQList.tsx", expected: "if (typeof window === \"undefined\") return 10;" },
  { file: "components/FAQList.tsx", expected: "const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;" },
  { file: "components/FAQList.tsx", expected: "window.scrollTo({ top: 0 });" },
  { file: "components/FAQList.tsx", expected: "min-h-[calc(100vh-18rem)]" }
]
```

> 注：`min-h` token 名称可按实现微调，但测试与实现必须一致。

**Step 2: Run test to verify it fails**

Run: `npm run check:compact-top -- --scope=home-pagination`

Expected: FAIL，提示缺失上述 token。

**Step 3: Write minimal implementation**

本任务不改生产代码，仅保留新断言。

**Step 4: Run test to verify it still fails**

Run: `npm run check:compact-top -- --scope=home-pagination`

Expected: FAIL（保持红灯，进入下一任务实现）。

**Step 5: Commit**

```bash
git add scripts/check-compact-top-layout.mjs
git commit -m "test: add home pagination whitespace regression checks"
```

### Task 2: 默认 pageSize 改为 10 并限制合法值

**Files:**
- Modify: `components/FAQList.tsx`
- Test: `components/FAQList.tsx`

**Step 1: Write the failing test**

Run: `npm run check:compact-top -- --scope=home-pagination`

Expected: FAIL（与 Task 1 相同）。

**Step 2: Write minimal implementation**

在 `components/FAQList.tsx` 中：

1. 新增常量：

```ts
const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
```

2. 调整 `loadPageSize()`：

```ts
function loadPageSize(): number {
  if (typeof window === "undefined") return 10;
  const raw = localStorage.getItem("aifaq-pageSize") ?? localStorage.getItem(LS_PAGESIZE);
  const parsed = raw ? Number(raw) : NaN;
  return PAGE_SIZE_OPTIONS.includes(parsed as (typeof PAGE_SIZE_OPTIONS)[number]) ? parsed : 10;
}
```

3. 其他逻辑保持不变，避免额外改动。

**Step 3: Run targeted lint**

Run: `npx eslint components/FAQList.tsx`

Expected: 无 error（warning 可接受）。

**Step 4: Re-run failing test**

Run: `npm run check:compact-top -- --scope=home-pagination`

Expected: 仍 FAIL（至少 `scrollTo` / `min-h` 尚未实现）。

**Step 5: Commit**

```bash
git add components/FAQList.tsx
git commit -m "feat: default home page size to 10 with strict allowed values"
```

### Task 3: pageSize 切换滚顶并加入布局双保险

**Files:**
- Modify: `components/FAQList.tsx`
- Test: `components/FAQList.tsx`

**Step 1: Write the failing test**

Run: `npm run check:compact-top -- --scope=home-pagination`

Expected: FAIL（缺少滚顶与 min-height token）。

**Step 2: Write minimal implementation**

在 `components/FAQList.tsx`：

1. 修改 `handlePageSizeChange`：

```ts
function handlePageSizeChange(size: number): void {
  setPageSize(size);
  setCurrentPage(1);
  window.scrollTo({ top: 0 });
}
```

2. 在主内容容器加入保守 `min-height`：

当前容器：

```tsx
<div className="min-w-0 flex-1 space-y-4">
```

改为（示例）：

```tsx
<div className="min-w-0 flex-1 space-y-4 min-h-[calc(100vh-18rem)] md:min-h-[calc(100vh-16rem)]">
```

> 保持 compare spacer 与现有布局结构不变。

**Step 3: Run test to verify it passes**

Run: `npm run check:compact-top -- --scope=home-pagination`

Expected: PASS。

**Step 4: Run behavior-adjacent checks**

Run:

```bash
npm run check:compact-top -- --scope=home-top
npm run check:compact-top -- --scope=outer-shell
```

Expected: PASS（确认不破坏既有紧凑化检查）。

**Step 5: Commit**

```bash
git add components/FAQList.tsx
git commit -m "fix: prevent bottom whitespace after page size switch"
```

### Task 4: 全量验证与交付

**Files:**
- Test: `components/FAQList.tsx`
- Test: `components/Pagination.tsx`
- Test: `scripts/check-compact-top-layout.mjs`

**Step 1: Run automated verification**

Run:

```bash
npm run check:compact-top -- --scope=home-pagination
npm run check:compact-top -- --scope=home-top
npm run check:compact-top -- --scope=outer-shell
npm run lint
npm run build
```

Expected:
1. 三个 `check:compact-top` scope 全部 PASS
2. `lint` 无 error（warning 可记录）
3. `build` 成功

**Step 2: Manual smoke verification**

Run: `npm run dev`

手动检查：
1. 首次进入 `/` 默认每页显示 10
2. 切换到 50 后再切回 10，自动回到顶部
3. 切回 10 后页面下方无明显大面积空白
4. 搜索/筛选/排序与 compare 模式行为正常

**Step 3: Commit verification summary**

```bash
git add -A
git commit -m "chore: verify home pagination whitespace fix"
```

---

## Notes For Execution

1. 按 @test-driven-development 节奏执行：先失败，再最小实现，再通过。
2. 完成前按 @verification-before-completion 复核命令输出后再宣告完成。
3. 若 `min-height` 体感偏大，仅微调该值，不扩展业务改动范围。
