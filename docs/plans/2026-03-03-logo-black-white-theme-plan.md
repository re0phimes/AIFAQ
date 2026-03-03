# Logo + Black/White Theme Toggle Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 AIFAQ 首页接入左上角品牌 logo（图标 + 字标）、全站黑白主题切换、以及深浅主题 favicon，并保持现有 FAQ 交互不回退。

**Architecture:** 采用 `html[data-theme]` + CSS 变量双主题方案，不引入新依赖。主题状态优先读取 `localStorage`，无显式用户选择时跟随系统主题，布局层使用内联初始化脚本避免首屏闪烁。Header 中新增 `BrandLogo` 与 `ThemeToggle` 组件，favicon 使用 `metadata.icons` + `media` 声明深浅版本。

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4 tokens, node:test + tsx, ESLint

---

### Task 1: 建立主题判定核心函数与单测

**Skill refs:** `@test-driven-development`

**Files:**
- Create: `lib/theme-preference.ts`
- Create: `lib/theme-preference.test.ts`
- Test: `lib/theme-preference.test.ts`

**Step 1: Write the failing test**

在 `lib/theme-preference.test.ts` 写入：

```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeStoredTheme,
  resolveInitialTheme,
  shouldFollowSystem,
  type ThemeMode,
} from "./theme-preference";

test("normalizeStoredTheme handles unknown values as system", () => {
  assert.equal(normalizeStoredTheme("dark"), "dark");
  assert.equal(normalizeStoredTheme("light"), "light");
  assert.equal(normalizeStoredTheme("system"), "system");
  assert.equal(normalizeStoredTheme("foo"), "system");
  assert.equal(normalizeStoredTheme(null), "system");
});

test("resolveInitialTheme prefers user explicit theme", () => {
  assert.equal(resolveInitialTheme("dark", false), "dark");
  assert.equal(resolveInitialTheme("light", true), "light");
});

test("resolveInitialTheme falls back to system when stored=system", () => {
  assert.equal(resolveInitialTheme("system", true), "dark");
  assert.equal(resolveInitialTheme("system", false), "light");
});

test("shouldFollowSystem only true when stored=system", () => {
  assert.equal(shouldFollowSystem("system"), true);
  assert.equal(shouldFollowSystem("dark"), false);
  assert.equal(shouldFollowSystem("light"), false);
});
```

**Step 2: Run test to verify it fails**

Run: `npx tsx --test lib/theme-preference.test.ts`  
Expected: FAIL（`Cannot find module './theme-preference'`）。

**Step 3: Write minimal implementation**

在 `lib/theme-preference.ts` 写入：

```ts
export type ThemeMode = "light" | "dark";
export type StoredTheme = ThemeMode | "system";

export function normalizeStoredTheme(raw: string | null): StoredTheme {
  return raw === "light" || raw === "dark" || raw === "system" ? raw : "system";
}

export function resolveInitialTheme(stored: StoredTheme, systemPrefersDark: boolean): ThemeMode {
  if (stored === "dark" || stored === "light") return stored;
  return systemPrefersDark ? "dark" : "light";
}

export function shouldFollowSystem(stored: StoredTheme): boolean {
  return stored === "system";
}
```

**Step 4: Run test to verify it passes**

Run: `npx tsx --test lib/theme-preference.test.ts`  
Expected: PASS。

**Step 5: Commit**

```bash
git add lib/theme-preference.ts lib/theme-preference.test.ts
git commit -m "test: add theme preference decision rules"
```

### Task 2: 建立首屏主题初始化脚本生成器与单测

**Skill refs:** `@test-driven-development`

**Files:**
- Create: `lib/theme-init-script.ts`
- Create: `lib/theme-init-script.test.ts`
- Test: `lib/theme-init-script.test.ts`

**Step 1: Write the failing test**

在 `lib/theme-init-script.test.ts` 写入：

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { buildThemeInitScript } from "./theme-init-script";

test("buildThemeInitScript includes storage key and data-theme write", () => {
  const script = buildThemeInitScript("aifaq-theme");
  assert.match(script, /aifaq-theme/);
  assert.match(script, /document\.documentElement\.dataset\.theme/);
  assert.match(script, /matchMedia/);
});

test("buildThemeInitScript guards runtime errors", () => {
  const script = buildThemeInitScript("aifaq-theme");
  assert.match(script, /try/);
  assert.match(script, /catch/);
});
```

**Step 2: Run test to verify it fails**

Run: `npx tsx --test lib/theme-init-script.test.ts`  
Expected: FAIL（模块不存在）。

**Step 3: Write minimal implementation**

在 `lib/theme-init-script.ts` 写入：

```ts
export function buildThemeInitScript(storageKey: string): string {
  return `(() => {
    try {
      const raw = localStorage.getItem(${JSON.stringify(storageKey)});
      const stored = raw === "light" || raw === "dark" || raw === "system" ? raw : "system";
      const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      const next = stored === "dark" || stored === "light" ? stored : (prefersDark ? "dark" : "light");
      document.documentElement.dataset.theme = next;
    } catch (_) {}
  })();`;
}
```

**Step 4: Run test to verify it passes**

Run: `npx tsx --test lib/theme-init-script.test.ts`  
Expected: PASS。

**Step 5: Commit**

```bash
git add lib/theme-init-script.ts lib/theme-init-script.test.ts
git commit -m "test: add theme bootstrap script generator"
```

### Task 3: 布局层接入主题启动 + 主题化 favicon

**Skill refs:** `@verification-before-completion`

**Files:**
- Modify: `app/layout.tsx`
- Create: `public/favicon-light.svg`
- Create: `public/favicon-dark.svg`
- Create: `scripts/theme-contract.test.ts`
- Test: `scripts/theme-contract.test.ts`

**Step 1: Write the failing test**

在 `scripts/theme-contract.test.ts` 加入布局契约测试（先断言将要新增的内容）：

```ts
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const layout = fs.readFileSync("app/layout.tsx", "utf8");

test("layout defines media-based favicon icons", () => {
  assert.match(layout, /prefers-color-scheme: light/);
  assert.match(layout, /prefers-color-scheme: dark/);
  assert.match(layout, /favicon-light\.svg/);
  assert.match(layout, /favicon-dark\.svg/);
});

test("layout injects early theme init script", () => {
  assert.match(layout, /buildThemeInitScript/);
  assert.match(layout, /dangerouslySetInnerHTML/);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test --import tsx scripts/theme-contract.test.ts`  
Expected: FAIL（当前 layout 尚未包含相关实现）。

**Step 3: Write minimal implementation**

- `app/layout.tsx`：
  - 新增 `metadata.icons`，配置 light/dark `media`。
  - 引入 `buildThemeInitScript`，在 `<head>` 注入初始化 `<script>`。
- 新增 `public/favicon-light.svg`、`public/favicon-dark.svg`（基于同一 logo 轮廓，分别针对浅/深背景优化）。

示例：

```tsx
export const metadata: Metadata = {
  title: "AIFAQ",
  description: "AI/ML 常见问题知识库",
  icons: {
    icon: [
      { url: "/favicon-light.svg", media: "(prefers-color-scheme: light)", type: "image/svg+xml" },
      { url: "/favicon-dark.svg", media: "(prefers-color-scheme: dark)", type: "image/svg+xml" },
      { url: "/favicon.ico" },
    ],
  },
};
```

**Step 4: Run test to verify it passes**

Run: `node --test --import tsx scripts/theme-contract.test.ts`  
Expected: PASS。

**Step 5: Commit**

```bash
git add app/layout.tsx public/favicon-light.svg public/favicon-dark.svg scripts/theme-contract.test.ts
git commit -m "feat: wire themed favicon and early theme bootstrap"
```

### Task 4: 新增 BrandLogo/ThemeToggle 并接入 Header

**Skill refs:** `@test-driven-development`

**Files:**
- Create: `components/BrandLogo.tsx`
- Create: `components/ThemeToggle.tsx`
- Modify: `components/FAQList.tsx`
- Modify: `scripts/theme-contract.test.ts`
- Test: `scripts/theme-contract.test.ts`

**Step 1: Write the failing test**

扩展 `scripts/theme-contract.test.ts`，加入组件接入契约：

```ts
const faqList = fs.readFileSync("components/FAQList.tsx", "utf8");

test("FAQList uses BrandLogo and ThemeToggle", () => {
  assert.match(faqList, /BrandLogo/);
  assert.match(faqList, /ThemeToggle/);
});

test("FAQList keeps language switch controls", () => {
  assert.match(faqList, /onLangChange\\(\"zh\"\\)/);
  assert.match(faqList, /onLangChange\\(\"en\"\\)/);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test --import tsx scripts/theme-contract.test.ts`  
Expected: FAIL（FAQList 还未接入新组件）。

**Step 3: Write minimal implementation**

- `components/BrandLogo.tsx`：实现图标 + `AIFAQ` 字标，颜色仅依赖 token。
- `components/ThemeToggle.tsx`：客户端组件，读写 `localStorage`，切换 `document.documentElement.dataset.theme`。
- `components/FAQList.tsx`：
  - 标题区域替换为 `<BrandLogo />`
  - 在右侧控制区加入 `<ThemeToggle />`
  - 保留登录/语言切换原有行为

`ThemeToggle` 最小接口：

```ts
interface ThemeToggleProps {
  storageKey?: string; // default: "aifaq-theme"
}
```

**Step 4: Run test to verify it passes**

Run: `node --test --import tsx scripts/theme-contract.test.ts`  
Expected: PASS。

**Step 5: Commit**

```bash
git add components/BrandLogo.tsx components/ThemeToggle.tsx components/FAQList.tsx scripts/theme-contract.test.ts
git commit -m "feat: add header brand logo and theme toggle"
```

### Task 5: 全站黑白主题 token 落地与最终验证

**Skill refs:** `@verification-before-completion`

**Files:**
- Modify: `app/globals.css`
- Modify: `scripts/theme-contract.test.ts`
- Test: `scripts/theme-contract.test.ts`

**Step 1: Write the failing test**

在 `scripts/theme-contract.test.ts` 增加 token 契约：

```ts
const globalsCss = fs.readFileSync("app/globals.css", "utf8");

test("globals.css defines dark theme token scope", () => {
  assert.match(globalsCss, /:root\\[data-theme=\"dark\"\\]/);
  assert.match(globalsCss, /--color-bg:/);
  assert.match(globalsCss, /--color-text:/);
  assert.match(globalsCss, /--color-border:/);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test --import tsx scripts/theme-contract.test.ts`  
Expected: FAIL（尚未声明 dark token scope）。

**Step 3: Write minimal implementation**

在 `app/globals.css` 中保留现有 token 名称并补齐 dark 覆盖：

```css
:root {
  --color-bg: #ffffff;
  --color-text: #111111;
  --color-subtext: #525252;
  --color-surface: #f7f7f7;
  --color-border: #e5e5e5;
  --color-panel: #ffffff;
}

:root[data-theme="dark"] {
  --color-bg: #0b0b0b;
  --color-text: #f5f5f5;
  --color-subtext: #a3a3a3;
  --color-surface: #171717;
  --color-border: #2a2a2a;
  --color-panel: #121212;
}
```

并检查需要高对比度的按钮/边框（如 `bg-primary text-white`）在深色模式下仍可读。

**Step 4: Run test to verify it passes**

Run:

```bash
node --test --import tsx scripts/theme-contract.test.ts
npx tsx --test lib/theme-preference.test.ts lib/theme-init-script.test.ts
npm run lint
```

Expected:
- 全部测试 PASS
- `npm run lint` 无 error

**Step 5: Commit**

```bash
git add app/globals.css scripts/theme-contract.test.ts
git commit -m "feat: add full-site black-white theme tokens"
```

### Task 6: 手动验收与发布前检查

**Skill refs:** `@verification-before-completion`

**Files:**
- Modify: `docs/plans/2026-03-03-logo-black-white-theme-plan.md`（仅补执行记录，可选）

**Step 1: Run local app**

Run: `npm run dev`  
Expected: app 在本地正常启动。

**Step 2: Validate acceptance checklist manually**

按以下顺序检查：

1. 首次访问在无 `aifaq-theme` 时跟随系统主题。
2. 点击主题按钮后全站立即切换黑/白。
3. 刷新后仍保持手动选择。
4. 清除 `aifaq-theme` 后再次跟随系统变化。
5. Header 左上角 logo 在两主题均清晰。
6. favicon 在深浅主题场景至少刷新后正确切换。
7. 搜索、过滤、分页、登录菜单、详情弹窗行为正常。

**Step 3: Final verification commands**

Run:

```bash
node --test --import tsx scripts/theme-contract.test.ts
npx tsx --test lib/theme-preference.test.ts lib/theme-init-script.test.ts
npm run lint
npm run build
```

Expected: 全部通过。

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: finalize logo and black-white theme rollout"
```

