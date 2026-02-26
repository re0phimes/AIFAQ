# FAQ 五项改进实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现五项 FAQ 显示增强：静态数据迁入数据库、标签合并、返回顶部按钮、排序功能、Reference 格式改进。

**Architecture:** 数据层从 JSON+DB 双源统一为纯数据库；前端新增排序/返回顶部交互；解析脚本增强 Reference 元数据。

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Tailwind CSS 4, @vercel/postgres, @fingerprintjs/fingerprintjs

---

## Task 1: 数据库 Schema 扩展

**Files:**
- Modify: `lib/db.ts:4-18` (DBFaqItem interface)
- Modify: `lib/db.ts:20-90` (initDB migration)

**Step 1: 修改 DBFaqItem 接口，新增 date 和 difficulty 字段**

```typescript
// lib/db.ts — DBFaqItem interface
export interface DBFaqItem {
  id: number;
  question: string;
  answer_raw: string;
  answer: string | null;
  tags: string[];
  categories: string[];
  references: Reference[];
  upvote_count: number;
  downvote_count: number;
  date: string;
  difficulty: "beginner" | "intermediate" | "advanced" | null;
  status: "pending" | "processing" | "ready" | "failed";
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
}
```

**Step 2: 在 initDB 中添加 ALTER TABLE 迁移**

在现有 `ALTER TABLE` 语句后追加：

```typescript
await sql`ALTER TABLE faq_items ADD COLUMN IF NOT EXISTS date VARCHAR(10) DEFAULT ''`;
await sql`ALTER TABLE faq_items ADD COLUMN IF NOT EXISTS difficulty VARCHAR(20)`;
```

**Step 3: 更新 rowToFaqItem 映射**

```typescript
// 在 rowToFaqItem 中新增：
date: (row.date as string) ?? "",
difficulty: (row.difficulty as DBFaqItem["difficulty"]) ?? null,
```

**Step 4: 验证构建通过**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add lib/db.ts
git commit -m "feat(db): add date and difficulty columns to faq_items"
```

---

## Task 2: 创建 seed-faq.ts 种子脚本

**Files:**
- Create: `scripts/seed-faq.ts`
- Modify: `package.json` (添加 seed 脚本命令)

**Step 1: 创建种子脚本**

```typescript
// scripts/seed-faq.ts
// 读取 data/faq.json，按 question 去重，幂等插入 faq_items 表
// 字段映射：id(忽略，用DB自增), question, answer→answer+answer_raw,
//   date, tags, categories, references, status='ready'
// 使用 ON CONFLICT (question) DO NOTHING 实现幂等
```

关键逻辑：
- 读取 `data/faq.json`
- 调用 `initDB()` 确保表结构就绪
- 遍历每条 FAQ，执行 INSERT ... ON CONFLICT DO NOTHING
- 需要先给 faq_items 表的 question 列加 UNIQUE 约束（在脚本中执行）
- 输出插入/跳过统计

**Step 2: 在 package.json 添加脚本**

```json
"seed": "npx tsx scripts/seed-faq.ts"
```

**Step 3: 本地测试脚本（需要数据库连接）**

Run: `npm run seed`
Expected: "Seeded X items, skipped Y duplicates"

**Step 4: Commit**

```bash
git add scripts/seed-faq.ts package.json
git commit -m "feat: add seed-faq.ts script for static FAQ migration"
```

---

## Task 3: 修改 page.tsx 为纯数据库读取

**Files:**
- Modify: `app/page.tsx`

**Step 1: 重写 page.tsx，移除静态 JSON 导入**

```typescript
// app/page.tsx
import FAQList from "@/components/FAQList";
import { getReadyFaqItems } from "@/lib/db";
import type { FAQItem } from "@/src/types/faq";

export const revalidate = 60;

export default async function Home() {
  let items: FAQItem[] = [];
  try {
    const dbItems = await getReadyFaqItems();
    items = dbItems.map((item) => ({
      id: item.id,
      question: item.question,
      date: item.date || item.created_at.toISOString().slice(0, 10),
      tags: item.tags,
      categories: item.categories,
      references: item.references,
      answer: item.answer ?? item.answer_raw,
      upvoteCount: item.upvote_count,
      downvoteCount: item.downvote_count,
      difficulty: item.difficulty,
    }));
  } catch {
    // DB not available — empty list fallback
  }

  return <FAQList items={items} />;
}
```

注意：不再有 `import faqData from "@/data/faq.json"`，不再有 staticItems/dynamicItems 合并，不再有 10000 偏移。

**Step 2: 更新 FAQItem 类型，新增 difficulty 字段**

```typescript
// src/types/faq.ts — FAQItem interface 新增：
difficulty?: "beginner" | "intermediate" | "advanced" | null;
```

**Step 3: 验证构建通过**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add app/page.tsx src/types/faq.ts
git commit -m "feat: switch page.tsx to database-only FAQ source"
```

---

## Task 4: 标签合并 — 上下文管理 + 上下文长度 → Context Engineering

**Files:**
- Modify: `AI-FAQ.md` (2 处标签)
- Modify: `data/tag-taxonomy.json` (生成式 AI / LLM 分类下的 tags)
- Modify: `scripts/parse-faq.ts` (无需改动，重新运行即可)

**Step 1: 修改 AI-FAQ.md 中的标签**

搜索 `#上下文管理` 替换为 `#Context Engineering`
搜索 `#上下文长度` 替换为 `#Context Engineering`

涉及 FAQ #56 和 #58。

**Step 2: 修改 tag-taxonomy.json**

在 "生成式 AI / LLM" 分类的 tags 数组中：
- 删除 `"上下文管理"` 和 `"上下文长度"`
- 添加 `"Context Engineering"`

**Step 3: 重新运行解析脚本生成 faq.json**

Run: `npx tsx scripts/parse-faq.ts`
Expected: faq.json 中 #56 和 #58 的 tags 包含 "Context Engineering"

**Step 4: 验证**

Run: `grep "Context Engineering" data/faq.json | wc -l`
Expected: 2 (两条 FAQ 各出现一次)

**Step 5: Commit**

```bash
git add AI-FAQ.md data/tag-taxonomy.json data/faq.json
git commit -m "feat: merge context tags into Context Engineering"
```

---

## Task 5: 返回顶部按钮

**Files:**
- Create: `components/BackToTop.tsx`
- Modify: `components/FAQList.tsx` (引入 BackToTop)

**Step 1: 创建 BackToTop 组件**

```typescript
// components/BackToTop.tsx
"use client";
import { useState, useEffect } from "react";

export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setVisible(window.scrollY > window.innerHeight);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-6 right-6 z-30 rounded-full bg-copper p-2.5
        text-white shadow-lg transition-opacity hover:bg-copper-light
        md:bottom-8 md:right-8"
      aria-label="返回顶部"
    >
      <svg className="h-5 w-5" fill="none" stroke="currentColor"
        viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M5 15l7-7 7 7" />
      </svg>
    </button>
  );
}
```

**Step 2: 在 FAQList.tsx 中引入**

在 `return (<>` 的最后、`</>` 之前添加 `<BackToTop />`。

```typescript
import BackToTop from "./BackToTop";
// ...
return (
  <>
    {/* ... existing content ... */}
    <BackToTop />
  </>
);
```

**Step 3: 验证构建通过**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add components/BackToTop.tsx components/FAQList.tsx
git commit -m "feat(ui): add back-to-top button"
```

---

## Task 6: 排序功能 — 前端排序 UI

**Files:**
- Modify: `components/FAQList.tsx` (新增排序状态和 UI)

**Step 1: 新增排序状态**

在 FAQList 组件中添加：

```typescript
type SortMode = "default" | "date" | "difficulty";
const [sortMode, setSortMode] = useState<SortMode>("default");
```

**Step 2: 在 filtered 之后添加排序逻辑**

```typescript
const DIFFICULTY_ORDER: Record<string, number> = {
  beginner: 0, intermediate: 1, advanced: 2,
};

const sorted = useMemo(() => {
  if (sortMode === "default") return filtered;
  const arr = [...filtered];
  if (sortMode === "date") {
    arr.sort((a, b) => b.date.localeCompare(a.date)); // 新→旧
  } else if (sortMode === "difficulty") {
    arr.sort((a, b) =>
      (DIFFICULTY_ORDER[a.difficulty ?? ""] ?? 99)
      - (DIFFICULTY_ORDER[b.difficulty ?? ""] ?? 99)
    );
  }
  return arr;
}, [filtered, sortMode]);
```

将后续分页逻辑中的 `filtered` 替换为 `sorted`。

**Step 3: 在工具栏添加排序按钮**

在 "全部折叠" 按钮后面添加排序切换：

```tsx
<div className="flex items-center gap-1 ml-2 border-l border-gray-200 pl-2">
  <span className="text-[11px] text-slate-secondary">排序:</span>
  {(["default", "date", "difficulty"] as const).map((mode) => (
    <button
      key={mode}
      onClick={() => setSortMode(mode)}
      className={`rounded-md px-2 py-1 text-xs transition-colors ${
        sortMode === mode
          ? "bg-copper text-white"
          : "text-slate-secondary hover:bg-code-bg"
      }`}
    >
      {mode === "default" ? "默认" : mode === "date" ? "时间" : "难度"}
    </button>
  ))}
</div>
```

**Step 4: 验证构建通过**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add components/FAQList.tsx
git commit -m "feat(ui): add sort by date/difficulty"
```

---

## Task 7: 难度分析脚本

**Files:**
- Create: `scripts/analyze-difficulty.ts`

**Step 1: 创建 AI 难度分析脚本**

```typescript
// scripts/analyze-difficulty.ts
// 1. 从数据库读取所有 difficulty IS NULL 的 FAQ
// 2. 对每条 FAQ，调用 AI API 分析难度
//    Prompt: 根据问题和答案内容，判断难度为 beginner/intermediate/advanced
// 3. 更新数据库 difficulty 字段
// 4. 输出统计
```

使用 OpenAI 兼容 API（环境变量 `AI_API_KEY` + `AI_API_BASE`），
或者简单的基于关键词/答案长度的启发式规则作为 fallback。

**Step 2: 在 package.json 添加脚本**

```json
"analyze-difficulty": "npx tsx scripts/analyze-difficulty.ts"
```

**Step 3: Commit**

```bash
git add scripts/analyze-difficulty.ts package.json
git commit -m "feat: add AI difficulty analysis script"
```

---

## Task 8: Reference 类型扩展 + 解析脚本改进

**Files:**
- Modify: `src/types/faq.ts` (Reference 新增 author, platform)
- Modify: `scripts/parse-faq.ts` (blog ref 添加 author="Phimes"，去掉 .md)

**Step 1: 扩展 Reference 类型**

```typescript
// src/types/faq.ts
export interface Reference {
  type: "blog" | "paper" | "other";
  title: string;
  url?: string;
  author?: string;
  platform?: string;
}
```

**Step 2: 修改 parse-faq.ts 的 parseReferences**

在 blog 类型分支中：
- `title` 去掉 `.md` 后缀：`blogTitle.replace(/\.md$/i, "")`
- 添加 `author: "Phimes"`（因为当前所有 blog 都是自己的）

```typescript
} else if (trimmed.startsWith("来源文章:") || trimmed.startsWith("来源文章：")) {
  const blogTitle = trimmed.replace(/^来源文章[:：]\s*/, "").replace(/\.md$/i, "");
  const url = matchBlogUrl(blogTitle, blogIndex);
  refs.push({
    type: "blog",
    title: blogTitle,
    author: "Phimes",
    ...(url ? { url } : {}),
  });
}
```

**Step 3: 重新运行解析脚本**

Run: `npx tsx scripts/parse-faq.ts`
Expected: faq.json 中 blog 类型 reference 都有 author 字段，title 无 .md 后缀

**Step 4: 验证**

Run: `grep '"author"' data/faq.json | head -5`
Expected: 每条 blog ref 都有 `"author": "Phimes"`

**Step 5: Commit**

```bash
git add src/types/faq.ts scripts/parse-faq.ts data/faq.json
git commit -m "feat: add author/platform to Reference, strip .md suffix"
```

---

## Task 9: ReferenceList 展示格式改进

**Files:**
- Modify: `components/ReferenceList.tsx`

**Step 1: 修改 RefItems 组件，显示 "author · title" 格式**

```tsx
function RefItems({ references }: { references: Reference[] }) {
  return (
    <ul className="space-y-1">
      {references.map((ref, i) => {
        const isPhimes = ref.author === "Phimes";
        const displayTitle = ref.author
          ? `${ref.author} · ${ref.title}`
          : ref.title;

        return (
          <li key={i} className="flex items-start gap-2 text-xs md:text-sm">
            <span className="shrink-0 text-slate-secondary">
              {ref.type === "paper" ? "📄" : ref.type === "blog" ? "📖" : "📌"}
            </span>
            {ref.url ? (
              <a
                href={ref.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`break-all underline-offset-2 hover:underline ${
                  isPhimes
                    ? "font-medium text-red-600"
                    : "text-copper"
                }`}
              >
                {displayTitle}
              </a>
            ) : (
              <span className={isPhimes ? "font-medium text-red-600" : "text-slate-secondary"}>
                {displayTitle}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
```

**Step 2: 验证构建通过**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add components/ReferenceList.tsx
git commit -m "feat(ui): show author·title format with red highlight for Phimes"
```

---

## Task 10: 全局验证与收尾

**Files:**
- All modified files

**Step 1: 完整构建验证**

Run: `npx next build 2>&1 | tail -30`
Expected: Build succeeds, no type errors

**Step 2: 检查 TypeScript 类型**

Run: `npx tsc --noEmit 2>&1 | tail -20`
Expected: No errors

**Step 3: 检查所有改动文件**

Run: `git diff --stat main`
Expected: 列出所有改动文件，确认范围正确

**Step 4: 最终 Commit（如有遗漏）**

```bash
git add -A
git commit -m "chore: final cleanup for five improvements"
```
