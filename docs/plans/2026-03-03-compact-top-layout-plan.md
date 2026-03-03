# Compact Top Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在不改变交互逻辑与字号层级的前提下，统一压缩主站与 Profile 顶部占高，提升首屏可见内容。

**Architecture:** 采用“局部收紧”策略，仅调整页面外层留白、顶部容器 spacing、按钮垂直内边距和卡片 padding，不改 sticky 逻辑与信息结构。为防止回归，引入一个轻量静态断言脚本，按 scope 校验关键 class token。每个小任务先让断言失败，再最小改动使其通过。

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, Node.js (内置 `node:test` / `fs`), ESLint

---

### Task 1: 建立紧凑布局回归检查脚本

**Files:**
- Create: `scripts/check-compact-top-layout.mjs`
- Modify: `package.json`
- Test: `scripts/check-compact-top-layout.mjs`

**Step 1: Write the failing test**

创建 `scripts/check-compact-top-layout.mjs`（初版包含一个必然失败的占位检查，确认测试链路可用）：

```js
import { readFileSync } from "node:fs";

const scopeArg = process.argv.find((arg) => arg.startsWith("--scope="));
const scope = scopeArg ? scopeArg.split("=")[1] : "all";

const checks = {
  smoke: [
    {
      file: "app/page.tsx",
      expected: "__PLACEHOLDER_COMPACT_CLASS__",
    },
  ],
};

const selected = scope === "all" ? Object.values(checks).flat() : checks[scope] ?? [];
if (selected.length === 0) {
  console.error(`[check-compact-top] unknown scope: ${scope}`);
  process.exit(2);
}

const failures = [];
for (const c of selected) {
  const content = readFileSync(c.file, "utf8");
  if (!content.includes(c.expected)) {
    failures.push(`${c.file} missing: ${c.expected}`);
  }
}

if (failures.length > 0) {
  console.error("[check-compact-top] FAIL");
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}

console.log("[check-compact-top] PASS");
```

**Step 2: Run test to verify it fails**

Run: `node scripts/check-compact-top-layout.mjs --scope=smoke`

Expected: FAIL with `missing: __PLACEHOLDER_COMPACT_CLASS__`

**Step 3: Write minimal implementation**

在 `package.json` 添加脚本：

```json
{
  "scripts": {
    "check:compact-top": "node scripts/check-compact-top-layout.mjs"
  }
}
```

**Step 4: Run test to verify command wiring**

Run: `npm run check:compact-top -- --scope=smoke`

Expected: 仍为 FAIL（说明命令接线成功，后续任务将让其转为 PASS）

**Step 5: Commit**

```bash
git add scripts/check-compact-top-layout.mjs package.json
git commit -m "test: add compact top layout regression checker scaffold"
```

### Task 2: 收紧页面外层留白（Home/Profile）

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/profile/page.tsx`
- Modify: `scripts/check-compact-top-layout.mjs`
- Test: `scripts/check-compact-top-layout.mjs`

**Step 1: Write the failing test**

将检查脚本替换为可按 scope 校验（保留 `smoke`，新增 `outer-shell`）：

```js
import { readFileSync } from "node:fs";

const scopeArg = process.argv.find((arg) => arg.startsWith("--scope="));
const scope = scopeArg ? scopeArg.split("=")[1] : "all";

const checks = {
  outer-shell: [
    { file: "app/page.tsx", expected: "py-4 md:py-6" },
    { file: "app/profile/page.tsx", expected: "py-4 md:py-6" },
  ],
};

const selected = scope === "all" ? Object.values(checks).flat() : checks[scope] ?? [];
if (selected.length === 0) {
  console.error(`[check-compact-top] unknown scope: ${scope}`);
  process.exit(2);
}

const failures = [];
for (const c of selected) {
  const content = readFileSync(c.file, "utf8");
  if (!content.includes(c.expected)) failures.push(`${c.file} missing: ${c.expected}`);
}

if (failures.length > 0) {
  console.error("[check-compact-top] FAIL");
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}

console.log("[check-compact-top] PASS");
```

**Step 2: Run test to verify it fails**

Run: `npm run check:compact-top -- --scope=outer-shell`

Expected: FAIL，提示两个页面仍缺少 `py-4 md:py-6`

**Step 3: Write minimal implementation**

- `app/page.tsx`：`py-6 md:py-8` -> `py-4 md:py-6`
- `app/profile/page.tsx`：`py-6 md:py-8` -> `py-4 md:py-6`

**Step 4: Run test to verify it passes**

Run: `npm run check:compact-top -- --scope=outer-shell`

Expected: PASS

**Step 5: Commit**

```bash
git add app/page.tsx app/profile/page.tsx scripts/check-compact-top-layout.mjs
git commit -m "style: tighten outer shell vertical spacing"
```

### Task 3: 收紧主站顶部区域（FAQList + SearchBar + TagFilter）

**Files:**
- Modify: `components/FAQList.tsx`
- Modify: `components/SearchBar.tsx`
- Modify: `components/TagFilter.tsx`
- Modify: `scripts/check-compact-top-layout.mjs`
- Test: `scripts/check-compact-top-layout.mjs`

**Step 1: Write the failing test**

在 `checks` 中新增 `home-top`：

```js
"home-top": [
  { file: "components/FAQList.tsx", expected: "pb-2" },
  { file: "components/FAQList.tsx", expected: "mb-2 flex items-center justify-between pt-1" },
  { file: "components/FAQList.tsx", expected: "flex items-center gap-2" },
  { file: "components/FAQList.tsx", expected: "mt-0.5 text-sm text-subtext" },
  { file: "components/FAQList.tsx", expected: "mt-2" },
  { file: "components/SearchBar.tsx", expected: "py-2.5 pl-12 pr-16" },
  { file: "components/TagFilter.tsx", expected: "rounded-xl border-[0.5px] border-border bg-panel p-2.5" }
]
```

**Step 2: Run test to verify it fails**

Run: `npm run check:compact-top -- --scope=home-top`

Expected: FAIL，提示缺失多个 token

**Step 3: Write minimal implementation**

- `components/FAQList.tsx`
  - sticky: `pb-3` -> `pb-2`
  - header: `mb-4 pt-2` -> `mb-2 pt-1`
  - 标题行 `gap-3` -> `gap-2`
  - 副标题 `mt-1` -> `mt-0.5`
  - 用户区 `gap-3` -> `gap-2`
  - 登录与用户菜单按钮 `py-1.5` -> `py-1.25`
  - 搜索到筛选间距 `mt-3` -> `mt-2`
- `components/SearchBar.tsx`
  - 输入框 `py-3` -> `py-2.5`
- `components/TagFilter.tsx`
  - 容器 `p-3` -> `p-2.5`

**Step 4: Run test to verify it passes**

Run: `npm run check:compact-top -- --scope=home-top`

Expected: PASS

**Step 5: Commit**

```bash
git add components/FAQList.tsx components/SearchBar.tsx components/TagFilter.tsx scripts/check-compact-top-layout.mjs
git commit -m "style: compact home sticky top section"
```

### Task 4: 收紧 Profile 顶部与统计区

**Files:**
- Modify: `app/profile/ProfileClient.tsx`
- Modify: `scripts/check-compact-top-layout.mjs`
- Test: `scripts/check-compact-top-layout.mjs`

**Step 1: Write the failing test**

在 `checks` 中新增 `profile-top`：

```js
"profile-top": [
  { file: "app/profile/ProfileClient.tsx", expected: "space-y-4" },
  { file: "app/profile/ProfileClient.tsx", expected: "flex items-center gap-2" },
  { file: "app/profile/ProfileClient.tsx", expected: "mt-0.5 text-xs text-subtext" },
  { file: "app/profile/ProfileClient.tsx", expected: "rounded-full px-3 py-1.5 text-xs font-medium" },
  { file: "app/profile/ProfileClient.tsx", expected: "grid grid-cols-3 gap-3" },
  { file: "app/profile/ProfileClient.tsx", expected: "rounded-xl border-[0.5px] border-border bg-panel p-3" },
  { file: "app/profile/ProfileClient.tsx", expected: "rounded-lg border border-amber-300 bg-amber-50 p-3" }
]
```

**Step 2: Run test to verify it fails**

Run: `npm run check:compact-top -- --scope=profile-top`

Expected: FAIL

**Step 3: Write minimal implementation**

`app/profile/ProfileClient.tsx`：
- 顶层：`space-y-6` -> `space-y-4`
- 标题行：`gap-3` -> `gap-2`
- 描述：`mt-1` -> `mt-0.5`
- 顶部两个 tab：`px-4 py-2` -> `px-3 py-1.5`
- 统计卡容器：`gap-4` -> `gap-3`
- 统计卡：`p-4` -> `p-3`
- stale 提示框：`p-4` -> `p-3`

**Step 4: Run test to verify it passes**

Run: `npm run check:compact-top -- --scope=profile-top`

Expected: PASS

**Step 5: Commit**

```bash
git add app/profile/ProfileClient.tsx scripts/check-compact-top-layout.mjs
git commit -m "style: compact profile top and stats section"
```

### Task 5: 全量验证与交付

**Files:**
- Test: `scripts/check-compact-top-layout.mjs`
- Test: `components/FAQList.tsx`
- Test: `components/SearchBar.tsx`
- Test: `components/TagFilter.tsx`
- Test: `app/profile/ProfileClient.tsx`
- Test: `app/page.tsx`
- Test: `app/profile/page.tsx`

**Step 1: Run full automated checks**

Run:

```bash
npm run check:compact-top -- --scope=outer-shell
npm run check:compact-top -- --scope=home-top
npm run check:compact-top -- --scope=profile-top
npm run lint
npm run build
```

Expected:
1. 三个 compact scope 均 PASS
2. lint 无新增错误
3. build 成功

**Step 2: Run manual smoke verification**

Run: `npm run dev`

检查项：
1. 主站 sticky 显隐行为与改动前一致
2. 主站首屏可见 FAQ 内容增加
3. Profile 首屏可见卡片内容增加
4. 关键按钮点击命中无明显下降（移动端与桌面端）

**Step 3: Document verification summary**

在本地记录执行结果（命令与结论），并在 PR 描述中附上：
1. 三个 scope 的检查结果
2. lint/build 结果
3. 手动 smoke 结论

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: verify compact top layout rollout"
```

---

## Notes For Execution

1. 按 @test-driven-development 的节奏执行：先失败、再最小实现、再通过。
2. 完成全部任务后，按 @verification-before-completion 复核命令输出，再宣告完成。
3. 若中途出现布局副作用，优先回调 padding/gap，不降低字号。
