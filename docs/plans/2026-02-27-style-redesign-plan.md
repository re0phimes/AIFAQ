# AIFAQ 样式重设计 — alphaxiv 风格 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 AIFAQ 中间内容区的视觉风格全面向 alphaxiv.org 靠拢 — 纯白底、深红强调色、极细边框、rounded-full 按钮、Rubik 品牌字体。

**Architecture:** 纯样式层变更，不涉及任何功能逻辑。替换 globals.css 中的设计 token，然后逐文件将旧 Tailwind class 替换为新 token。所有组件的 props/state/逻辑保持不变。

**Tech Stack:** Next.js + Tailwind CSS v4 (@theme inline) + Google Fonts

---

## Token 映射速查表

在所有 Task 中，按此表做 class 替换：

| 旧 token (class 中使用) | 新 token |
|------------------------|----------|
| `warm-white` | `bg` (即 #FFFFFF) |
| `deep-ink` | `text` (即 #171717) |
| `copper` | `primary` (即 #9a2036) |
| `copper-light` | `primary-hover` (即 #6b1626) |
| `slate-secondary` | `subtext` (即 #737373) |
| `code-bg` | `surface` (即 #F5F5F5) |
| `border-gray-200` | `border-border` |
| `border-gray-300` | `border-border` |
| `bg-white/60` | `bg-panel` |
| `bg-white` | `bg-panel` |
| `hover:bg-gray-100` | `hover:bg-surface` |
| `hover:bg-gray-200` | `hover:bg-surface` |
| `bg-gray-100` | `bg-surface` |
| `font-serif` | `font-brand` |
| `rounded-lg` (卡片) | `rounded-xl` |
| `rounded-md` (按钮) | `rounded-full` |
| `border` (卡片) | `border-[0.5px]` |

---

### Task 1: 替换设计 token 和字体加载

**Files:**
- Modify: `app/globals.css:1-14` — 替换 @theme inline 中的所有 token
- Modify: `app/globals.css:16-20` — 更新 body 样式引用
- Modify: `app/globals.css:71` — 更新 scrollbar thumb 颜色引用
- Modify: `app/globals.css:112` — 更新 prose strong 颜色引用
- Modify: `app/layout.tsx:23-26` — Google Fonts link 加入 Rubik，去掉 Noto Serif SC

**Step 1: 替换 globals.css 的 @theme inline 块**

将整个 `@theme inline { ... }` 替换为：

```css
@theme inline {
  --color-bg: #FFFFFF;
  --color-text: #171717;
  --color-primary: #9a2036;
  --color-primary-hover: #6b1626;
  --color-subtext: #737373;
  --color-surface: #F5F5F5;
  --color-border: #E5E5E5;
  --color-panel: #FFFFFF;
  --font-brand: "Rubik", sans-serif;
  --font-sans: "Noto Sans SC", sans-serif;
  --font-mono: "JetBrains Mono", monospace;
}
```

**Step 2: 更新 body 样式**

```css
body {
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-sans);
}
```

**Step 3: 更新 scrollbar thumb 引用**

`var(--color-slate-secondary)` → `var(--color-subtext)`

**Step 4: 更新 prose strong 引用**

`var(--color-deep-ink)` → `var(--color-text)`

**Step 5: 更新 layout.tsx 的 Google Fonts link**

将 font link 改为：
```
https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400&family=Noto+Sans+SC:wght@400;500;700&family=Rubik:wght@400;500;700&display=swap
```

去掉 `Noto+Serif+SC`，加入 `Rubik`。

**Step 6: 验证**

Run: `npx next build 2>&1 | tail -5`
Expected: 编译成功，无错误

**Step 7: Commit**

```bash
git add app/globals.css app/layout.tsx
git commit -m "style: replace design tokens with alphaxiv color scheme"
```

---

### Task 2: 更新 FAQList.tsx — header + toolbar 样式

**Files:**
- Modify: `components/FAQList.tsx`

**Step 1: 更新 sticky header 背景**

Line 401: `bg-warm-white/95` → `bg-bg/95`

**Step 2: 更新 header 标题**

Line 407: `font-serif text-3xl font-bold text-deep-ink` → `font-brand text-3xl font-bold text-text`

**Step 3: 更新副标题**

Line 408: `text-slate-secondary` → `text-subtext`

**Step 4: 更新工具栏按钮 — 比较按钮**

Lines 444-449:
- 激活态: `bg-copper text-white` → `bg-primary text-white`
- 默认态: `rounded-md ... border border-gray-200 text-slate-secondary hover:bg-code-bg` → `rounded-full ... border-[0.5px] border-border text-subtext hover:bg-surface`

**Step 5: 更新展开/折叠按钮**

Lines 455-456, 462-463:
`rounded-md border border-gray-200 px-3 py-1 text-xs text-slate-secondary hover:bg-code-bg`
→ `rounded-full border-[0.5px] border-border px-3 py-1.5 text-xs text-subtext hover:bg-surface`

**Step 6: 更新排序区域**

Line 467: `border-gray-200` → `border-border`
Line 468: `text-slate-secondary` → `text-subtext`
Lines 473-477:
- 激活态: `bg-copper text-white` → `bg-primary text-white`
- 默认态: `text-slate-secondary hover:bg-code-bg` → `text-subtext hover:bg-surface`

**Step 7: 更新统计文字和空状态**

Line 484: `text-slate-secondary` → `text-subtext`
Line 504: `text-slate-secondary` → `text-subtext`

**Step 8: 更新卡片列表间距**

Line 508: `space-y-2` → `space-y-3`

**Step 9: 验证**

Run: `npx next build 2>&1 | tail -5`
Expected: 编译成功

**Step 10: Commit**

```bash
git add components/FAQList.tsx
git commit -m "style: update FAQList header and toolbar to alphaxiv style"
```

---

### Task 3: 更新 FAQItem.tsx — 卡片样式

**Files:**
- Modify: `components/FAQItem.tsx`

**Step 1: 更新 DownvotePanel 样式**

Line 39: `rounded-lg border border-gray-200 bg-code-bg/50` → `rounded-xl border-[0.5px] border-border bg-surface/50`
Line 41: `text-slate-secondary` → `text-subtext`
Lines 49-53:
- 激活态: `bg-copper text-white` → `bg-primary text-white`
- 默认态: `bg-white border border-gray-200 text-deep-ink hover:bg-gray-100` → `bg-panel border-[0.5px] border-border text-text hover:bg-surface`

Line 63-65: `border-gray-200 bg-white ... text-deep-ink placeholder:text-slate-secondary/50 focus:border-copper` → `border-border bg-panel ... text-text placeholder:text-subtext/50 focus:border-primary`

Lines 72-73: `bg-copper ... hover:bg-copper-light` → `bg-primary ... hover:bg-primary-hover`
Lines 79-80: `border-gray-200 ... text-slate-secondary hover:bg-gray-100` → `border-border ... text-subtext hover:bg-surface`

**Step 2: 更新 article 卡片容器**

Lines 105-111:
```
rounded-lg border transition-colors duration-200
→ rounded-xl border-[0.5px] transition-all duration-200
```
- 展开: `border-copper/40 bg-white shadow-sm` → `border-primary/30 bg-panel shadow-sm`
- 选中: `border-copper/20 bg-copper/5` → `border-primary/20 bg-primary/5`
- 默认: `border-gray-200 bg-white/60` → `border-border bg-panel`

**Step 3: 更新 checkbox**

Line 125-126: `border-gray-300 accent-copper` → `border-border accent-primary`

**Step 4: 更新 question button hover**

Line 135: `hover:bg-code-bg/30` → `hover:bg-surface/30`

**Step 5: 更新 ID 编号**

Line 139-140: `font-serif ... text-copper` → `font-brand ... text-primary`

**Step 6: 更新问题标题**

Line 145: `text-deep-ink` → `text-text`

**Step 7: 更新日期和标签**

Line 156: `text-slate-secondary` → `text-subtext`
Lines 162-164: `bg-code-bg px-2 py-0.5 font-mono text-[10px] text-slate-secondary` → `border-[0.5px] border-border bg-panel px-1.5 py-0.5 text-xs font-medium text-primary`

**Step 8: 更新展开箭头**

Line 172: `text-slate-secondary` → `text-subtext`

**Step 9: 更新 prose 区域**

Lines 195-198: `text-deep-ink ... bg-code-bg ... bg-code-bg` → `text-text ... bg-surface ... bg-surface`

**Step 10: 更新投票按钮**

Line 212: `border-gray-100` → `border-border/50`
Lines 224-226:
- 激活: `bg-green-100 text-green-700` → `bg-green-50 text-green-700`
- 默认: `text-slate-secondary hover:bg-code-bg` → `text-subtext hover:bg-surface`

Lines 252-254:
- 激活: `bg-red-100 text-red-600` → `bg-red-50 text-red-600`
- 默认: `text-slate-secondary hover:bg-code-bg` → `text-subtext hover:bg-surface`

**Step 11: 验证**

Run: `npx next build 2>&1 | tail -5`
Expected: 编译成功

**Step 12: Commit**

```bash
git add components/FAQItem.tsx
git commit -m "style: update FAQItem card to alphaxiv style"
```

---

### Task 4: 更新 SearchBar.tsx

**Files:**
- Modify: `components/SearchBar.tsx`

**Step 1: 更新搜索图标**

Line 28: `text-slate-secondary` → `text-subtext`

**Step 2: 更新 input**

Lines 51-54:
`rounded-lg border border-gray-200 bg-warm-white ... text-deep-ink placeholder-slate-secondary ... focus:border-copper focus:ring-2 focus:ring-copper/30`
→ `rounded-full border-[0.5px] border-border bg-bg ... text-text placeholder-subtext ... focus:border-primary focus:ring-2 focus:ring-primary/30`

**Step 3: 更新快捷键提示**

Lines 57-59:
`border-gray-300 bg-code-bg ... text-slate-secondary`
→ `border-border bg-surface ... text-subtext`

**Step 4: 更新搜索模式按钮**

Lines 69-73:
- 激活态: `bg-copper/10 font-medium text-copper` → `bg-primary/10 font-medium text-primary`
- 默认态: `text-slate-secondary hover:bg-code-bg` → `text-subtext hover:bg-surface`

**Step 5: 验证 + Commit**

```bash
git add components/SearchBar.tsx
git commit -m "style: update SearchBar to alphaxiv style"
```

---

### Task 5: 更新 TagFilter.tsx

**Files:**
- Modify: `components/TagFilter.tsx`

**Step 1: 更新容器**

Line 59: `rounded-lg border border-gray-200 bg-white/60 p-3`
→ `rounded-xl border-[0.5px] border-border bg-panel p-3`

**Step 2: 更新标题**

Line 61: `text-slate-secondary` → `text-subtext`

**Step 3: 更新清除按钮**

Lines 67-68: `border-copper ... text-copper ... hover:bg-copper hover:text-white`
→ `border-primary ... text-primary ... hover:bg-primary hover:text-white`

**Step 4: 更新分类按钮**

Lines 90-93:
- 激活态: `bg-copper text-white` → `bg-primary text-white`
- 默认态: `bg-code-bg text-deep-ink hover:bg-gray-200` → `bg-surface text-text hover:bg-surface`

Line 98: `text-slate-secondary` → `text-subtext`

**Step 5: 更新标签按钮**

Line 112: `border-gray-100` → `border-border/50`
Lines 124-127:
- 激活态: `bg-copper/80 text-white` → `bg-primary/80 text-white`
- 默认态: `bg-gray-100 text-deep-ink hover:bg-gray-200` → `bg-surface text-text hover:bg-surface`

Line 132: `text-slate-secondary` → `text-subtext`

**Step 6: 验证 + Commit**

```bash
git add components/TagFilter.tsx
git commit -m "style: update TagFilter to alphaxiv style"
```

---

### Task 6: 更新 ReferenceList.tsx

**Files:**
- Modify: `components/ReferenceList.tsx`

**Step 1: 更新容器**

Line 17: `border border-gray-200 bg-code-bg/50`
→ `border-[0.5px] border-border bg-surface/50`

**Step 2: 更新文字颜色**

Lines 21, 33, 37, 52: `text-slate-secondary` → `text-subtext`

**Step 3: 更新链接颜色**

Line 88: `text-copper` → `text-primary`

**Step 4: 验证 + Commit**

```bash
git add components/ReferenceList.tsx
git commit -m "style: update ReferenceList to alphaxiv style"
```

---

### Task 7: 更新 Pagination.tsx

**Files:**
- Modify: `components/Pagination.tsx`

**Step 1: 更新文字颜色**

Line 40: `text-slate-secondary` → `text-subtext`

**Step 2: 更新 select**

Line 47: `border-gray-200 bg-white ... text-deep-ink` → `border-border bg-panel ... text-text`

**Step 3: 更新翻页按钮**

Lines 63-64, 90-91: `text-slate-secondary hover:bg-code-bg` → `text-subtext hover:bg-surface`

**Step 4: 更新页码按钮**

Lines 77-81:
- 激活态: `bg-copper font-medium text-white` → `bg-primary font-medium text-white`
- 默认态: `text-deep-ink hover:bg-code-bg` → `text-text hover:bg-surface`

Line 70: `text-slate-secondary` → `text-subtext`

**Step 5: 验证 + Commit**

```bash
git add components/Pagination.tsx
git commit -m "style: update Pagination to alphaxiv style"
```

---

### Task 8: 更新 BackToTop.tsx + SelectionSidebar.tsx + ReadingView.tsx

**Files:**
- Modify: `components/BackToTop.tsx`
- Modify: `components/SelectionSidebar.tsx`
- Modify: `components/ReadingView.tsx`

**Step 1: BackToTop — 更新按钮**

Line 20: `bg-copper ... hover:bg-copper-light` → `bg-primary ... hover:bg-primary-hover`

**Step 2: SelectionSidebar — 桌面侧边栏**

Line 31: `rounded-lg border border-gray-200 bg-white` → `rounded-xl border-[0.5px] border-border bg-panel`
Line 34: `text-deep-ink` → `text-text`
Line 39: `text-slate-secondary hover:text-copper` → `text-subtext hover:text-primary`
Line 49: `hover:bg-code-bg` → `hover:bg-surface`
Line 51: `text-copper` → `text-primary`
Line 54: `text-deep-ink` → `text-text`
Line 59: `text-slate-secondary hover:text-copper` → `text-subtext hover:text-primary`
Lines 68-69: `rounded-md bg-copper ... hover:bg-copper-light` → `rounded-full bg-primary ... hover:bg-primary-hover`

**Step 3: SelectionSidebar — 移动端底栏**

Line 78: `border-gray-200 bg-white/95` → `border-border bg-panel/95`
Line 82: `text-deep-ink` → `text-text`
Lines 88-89: `border-gray-300 ... text-slate-secondary` → `border-border ... text-subtext`
Lines 95-96: `rounded-md bg-copper ... text-white` → `rounded-full bg-primary ... text-white`

**Step 4: ReadingView — 工具栏**

Line 50: `text-slate-secondary hover:text-copper` → `text-subtext hover:text-primary`
Line 69: `text-slate-secondary` → `text-subtext`
Lines 74-75: `rounded-md border border-gray-200 ... text-slate-secondary hover:bg-code-bg` → `rounded-full border-[0.5px] border-border ... text-subtext hover:bg-surface`
Lines 81-82: 同上
Lines 88-90: `rounded-md bg-copper ... hover:bg-copper-light` → `rounded-full bg-primary ... hover:bg-primary-hover`

**Step 5: ReadingView — 文章卡片**

Line 117: `rounded-lg border border-gray-200 bg-white` → `rounded-xl border-[0.5px] border-border bg-panel`
Lines 125-126: `font-serif ... text-copper` → `font-brand ... text-primary`
Line 130: `text-deep-ink` → `text-text`
Line 135: `text-slate-secondary` → `text-subtext`
Lines 141-142: `bg-code-bg ... text-slate-secondary` → `border-[0.5px] border-border bg-panel ... text-primary`
Line 152: `text-slate-secondary` → `text-subtext`
Line 171: `text-slate-secondary hover:bg-code-bg hover:text-copper` → `text-subtext hover:bg-surface hover:text-primary`
Lines 193-196: `text-deep-ink ... bg-code-bg ... bg-code-bg` → `text-text ... bg-surface ... bg-surface`

**Step 6: 验证**

Run: `npx next build 2>&1 | tail -5`
Expected: 编译成功

**Step 7: Commit**

```bash
git add components/BackToTop.tsx components/SelectionSidebar.tsx components/ReadingView.tsx
git commit -m "style: update BackToTop, SelectionSidebar, ReadingView to alphaxiv style"
```

---

### Task 9: 最终验证 + 清理

**Step 1: 全局搜索残留旧 token**

```bash
grep -rn "warm-white\|deep-ink\|copper\|slate-secondary\|code-bg\|font-serif" components/ app/ --include="*.tsx" --include="*.css"
```

Expected: 无匹配 (admin 页面除外)

**Step 2: 构建验证**

Run: `npx next build`
Expected: 编译成功，无错误

**Step 3: 最终 Commit (如有遗漏修复)**

```bash
git add -A
git commit -m "style: clean up remaining old token references"
```
