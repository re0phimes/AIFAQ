# Admin 页面重设计 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将单页 admin 拆分为共享 layout + 独立提交/审批子路由，审批页采用 Master-Detail 分栏布局，新增审批日期字段。

**Architecture:** 新建 `app/admin/layout.tsx` 统一导航和 auth，`/admin/submit` 独立提交表单，`/admin/review` 为 Master-Detail 分栏审批页。DB 层加 `reviewed_at` / `reviewed_by` 字段，API 层在审批操作时自动记录。

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4, @vercel/postgres, jose JWT

---

### Task 1: DB Migration — 添加 reviewed_at / reviewed_by 字段

**Files:**
- Modify: `lib/db.ts:59-63` (在 images 列之后添加新的 ALTER 语句)
- Modify: `lib/db.ts:13-34` (DBFaqItem 接口添加新字段)
- Modify: `lib/db.ts:204-231` (rowToFaqItem 添加新字段映射)

**Step 1: 在 `lib/db.ts` 的 `initDB()` 函数中添加 migration**

在 `images` 列的 ALTER 之后（第 63 行后）添加：

```typescript
// Review tracking columns
await sql`ALTER TABLE faq_items ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ`;
await sql`ALTER TABLE faq_items ADD COLUMN IF NOT EXISTS reviewed_by TEXT`;
```

**Step 2: 更新 `DBFaqItem` 接口**

在 `updated_at: Date;` 之后添加：

```typescript
reviewed_at: Date | null;
reviewed_by: string | null;
```

**Step 3: 更新 `rowToFaqItem` 函数**

在 `updated_at` 映射之后添加：

```typescript
reviewed_at: row.reviewed_at ? new Date(row.reviewed_at as string) : null,
reviewed_by: (row.reviewed_by as string | null) ?? null,
```

**Step 4: 验证**

Run: `npx tsc --noEmit`
Expected: 无类型错误

**Step 5: Commit**

```bash
git add lib/db.ts
git commit -m "feat(db): add reviewed_at and reviewed_by columns to faq_items"
```

---

### Task 2: API — 审批操作时记录 reviewed_at / reviewed_by

**Files:**
- Modify: `lib/db.ts:133-177` (updateFaqStatus 函数)
- Modify: `app/api/admin/faq/[id]/route.ts:30-41` (publish/reject/unpublish 操作)

**Step 1: 给 `updateFaqStatus` 添加 review 参数**

修改 `updateFaqStatus` 的 `data` 参数类型，添加：

```typescript
reviewed_at?: Date;
reviewed_by?: string;
```

在 else 分支（第 168-176 行，简单状态更新）中，当有 `reviewed_at` 时更新：

```typescript
} else if (data?.reviewed_at) {
  await sql`
    UPDATE faq_items
    SET status = ${status},
        reviewed_at = ${data.reviewed_at.toISOString()},
        reviewed_by = ${data.reviewed_by ?? null},
        error_message = ${data?.error_message ?? null},
        updated_at = NOW()
    WHERE id = ${id}
  `;
} else {
```

**Step 2: 修改 API route 的 publish/reject/unpublish 操作**

```typescript
if (body.action === "publish") {
  await updateFaqStatus(numId, "published", {
    reviewed_at: new Date(),
    reviewed_by: "admin",
  });
  return NextResponse.json({ ok: true });
}
if (body.action === "reject") {
  await updateFaqStatus(numId, "rejected", {
    reviewed_at: new Date(),
    reviewed_by: "admin",
  });
  return NextResponse.json({ ok: true });
}
if (body.action === "unpublish") {
  await updateFaqStatus(numId, "review", {
    reviewed_at: new Date(),
    reviewed_by: "admin",
  });
  return NextResponse.json({ ok: true });
}
```

**Step 3: 验证**

Run: `npx tsc --noEmit`
Expected: 无类型错误

**Step 4: Commit**

```bash
git add lib/db.ts app/api/admin/faq/\[id\]/route.ts
git commit -m "feat(api): record reviewed_at/reviewed_by on approval actions"
```

---

### Task 3: Admin Layout — 共享导航 + Auth 检查

**Files:**
- Create: `app/admin/layout.tsx`
- Modify: `app/admin/page.tsx` (替换为重定向)

**Step 1: 创建 `app/admin/layout.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

const NAV_ITEMS = [
  { href: "/admin/review", label: "审批管理" },
  { href: "/admin/submit", label: "提交新 FAQ" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Skip auth check on login page
    if (pathname === "/admin/login") {
      setAuthed(true);
      return;
    }
    fetch("/api/auth/login", { method: "GET" })
      .then(() => {
        // Check cookie existence via a lightweight endpoint
        // Actually, we'll check by trying to fetch admin data
        return fetch("/api/admin/faq", { method: "HEAD" });
      })
      .then((res) => {
        if (res.ok || res.status === 200) setAuthed(true);
        else throw new Error("Unauthorized");
      })
      .catch(() => {
        setAuthed(false);
        router.replace("/admin/login");
      });
  }, [pathname, router]);

  // Login page renders without nav
  if (pathname === "/admin/login") return <>{children}</>;

  // Loading state
  if (authed === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-slate-secondary">验证中...</p>
      </div>
    );
  }

  if (!authed) return null;

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/admin/login");
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      {/* Top nav bar */}
      <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-panel)] backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="font-serif text-lg font-bold text-[var(--color-text)]">
              FAQ Admin
            </Link>
            <nav className="flex gap-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    pathname === item.href
                      ? "bg-[var(--color-text)] text-white"
                      : "text-[var(--color-subtext)] hover:bg-[var(--color-surface)]"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-subtext)] transition-colors hover:bg-[var(--color-surface)]"
          >
            登出
          </button>
        </div>
      </header>
      {/* Page content */}
      <main className="mx-auto max-w-7xl px-4 py-6">
        {children}
      </main>
    </div>
  );
}
```

**Step 2: 替换 `app/admin/page.tsx` 为重定向**

```tsx
import { redirect } from "next/navigation";

export default function AdminPage() {
  redirect("/admin/review");
}
```

**Step 3: 验证**

Run: `npx tsc --noEmit`
Expected: 无类型错误

**Step 4: Commit**

```bash
git add app/admin/layout.tsx app/admin/page.tsx
git commit -m "feat(admin): add shared layout with nav bar and auth check"
```

---

### Task 4: Submit Page — 提交新 FAQ

**Files:**
- Create: `app/admin/submit/page.tsx`

**Step 1: 创建提交页**

从现有 `app/admin/page.tsx` 提取提交表单逻辑，独立为新页面：

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SubmitPage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return;
    setSubmitting(true);
    setSuccess(false);

    const res = await fetch("/api/admin/faq", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: question.trim(), answer: answer.trim() }),
    });

    if (res.ok) {
      setQuestion("");
      setAnswer("");
      setSuccess(true);
    }
    setSubmitting(false);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 font-serif text-2xl font-bold text-[var(--color-text)]">
        提交新 FAQ
      </h1>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">问题</label>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="输入问题..."
            className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">答案 (Markdown)</label>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="输入答案，支持 Markdown..."
            rows={12}
            className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 font-mono text-sm focus:border-[var(--color-primary)] focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting || !question.trim() || !answer.trim()}
            className="rounded-lg bg-[var(--color-text)] px-5 py-2 text-sm text-white transition-colors hover:bg-[var(--color-text)]/90 disabled:opacity-50"
          >
            {submitting ? "提交中..." : "提交并分析"}
          </button>
          {success && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <span>提交成功！</span>
              <button
                type="button"
                onClick={() => router.push("/admin/review")}
                className="text-[var(--color-primary)] underline"
              >
                去审批页查看
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
```

**Step 2: 验证**

Run: `npx tsc --noEmit`
Expected: 无类型错误

**Step 3: Commit**

```bash
git add app/admin/submit/page.tsx
git commit -m "feat(admin): add standalone submit page at /admin/submit"
```

---

### Task 5: Review Page — Master-Detail 审批管理

**Files:**
- Create: `app/admin/review/page.tsx`

这是最核心的部分。页面分为三个区域：统计栏、左侧列表、右侧详情。

**Step 1: 创建审批页**

```tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import SyncMarkdownContent from "@/components/SyncMarkdownContent";

type FaqStatus = "pending" | "processing" | "review" | "published" | "rejected" | "ready" | "failed";

interface FaqItem {
  id: number;
  question: string;
  question_en: string | null;
  answer_raw: string;
  answer: string | null;
  answer_brief: string | null;
  answer_en: string | null;
  answer_brief_en: string | null;
  tags: string[];
  categories: string[];
  references: { type: string; title: string; url?: string }[];
  images: Array<{ url: string; caption: string; source: string }>;
  upvote_count: number;
  downvote_count: number;
  status: FaqStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

const STATUS_LABELS: Record<FaqStatus, string> = {
  pending: "等待中",
  processing: "分析中",
  review: "待审核",
  published: "已发布",
  ready: "已发布",
  rejected: "已退回",
  failed: "失败",
};

const STATUS_COLORS: Record<FaqStatus, string> = {
  pending: "bg-gray-400",
  processing: "bg-blue-400 animate-pulse",
  review: "bg-amber-400",
  published: "bg-green-500",
  ready: "bg-green-500",
  rejected: "bg-red-400",
  failed: "bg-red-500",
};

const FILTER_TABS = [
  { key: "all", label: "全部" },
  { key: "review", label: "待审核" },
  { key: "published", label: "已发布" },
  { key: "rejected", label: "已退回" },
  { key: "failed", label: "失败" },
] as const;

export default function ReviewPage() {
  const [items, setItems] = useState<FaqItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewTab, setPreviewTab] = useState<"raw" | "brief" | "detailed" | "en">("detailed");

  const fetchItems = useCallback(async () => {
    const res = await fetch("/api/admin/faq");
    if (res.ok) {
      const data = await res.json();
      setItems(data);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Polling for pending/processing items
  useEffect(() => {
    const hasPending = items.some((i) => i.status === "pending" || i.status === "processing");
    if (!hasPending) return;
    const timer = setInterval(fetchItems, 5000);
    return () => clearInterval(timer);
  }, [items, fetchItems]);

  const stats = useMemo(() => {
    const counts: Record<string, number> = { all: items.length };
    for (const item of items) {
      const key = item.status === "ready" ? "published" : item.status;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [items]);

  const filteredItems = useMemo(() => {
    let result = items;
    if (statusFilter !== "all") {
      result = result.filter((i) =>
        statusFilter === "published"
          ? i.status === "published" || i.status === "ready"
          : i.status === statusFilter
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (i) => i.question.toLowerCase().includes(q) || i.question_en?.toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [items, statusFilter, searchQuery]);

  const selectedItem = useMemo(
    () => items.find((i) => i.id === selectedId) ?? null,
    [items, selectedId]
  );

  async function handleAction(id: number, action: "publish" | "reject" | "unpublish" | "retry") {
    await fetch(`/api/admin/faq/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    fetchItems();
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  return (
    <div className="flex h-[calc(100vh-theme(spacing.14)-theme(spacing.12))] flex-col">
      {/* Stats bar */}
      <div className="mb-4 flex gap-2">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
              statusFilter === tab.key
                ? "bg-[var(--color-text)] text-white"
                : "bg-[var(--color-panel)] text-[var(--color-subtext)] hover:bg-[var(--color-border)]"
            }`}
          >
            {tab.label} ({stats[tab.key] ?? 0})
          </button>
        ))}
      </div>

      {/* Master-Detail split */}
      <div className="flex min-h-0 flex-1 gap-4">
        {/* Left: List panel */}
        <div className="flex w-[35%] flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]">
          <div className="border-b border-[var(--color-border)] p-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索问题..."
              className="w-full rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm focus:border-[var(--color-primary)] focus:outline-none"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredItems.length === 0 && (
              <p className="p-4 text-center text-sm text-[var(--color-subtext)]">暂无匹配项</p>
            )}
            {filteredItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => { setSelectedId(item.id); setPreviewTab("detailed"); }}
                className={`flex w-full items-start gap-2.5 border-b border-[var(--color-border)] px-3 py-3 text-left transition-colors ${
                  selectedId === item.id
                    ? "bg-[var(--color-surface)]"
                    : "hover:bg-[var(--color-surface)]/50"
                }`}
              >
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${STATUS_COLORS[item.status]}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--color-text)]">
                    {item.question}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-[var(--color-subtext)]">
                    <span>{formatDate(item.created_at)}</span>
                    {item.tags.length > 0 && <span>{item.tags.length} tags</span>}
                    {item.reviewed_at && <span>审批: {formatDate(item.reviewed_at)}</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Detail panel */}
        <div className="flex w-[65%] flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]">
          {!selectedItem ? (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-[var(--color-subtext)]">选择一个 FAQ 查看详情</p>
            </div>
          ) : (
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* Header + actions */}
              <div className="border-b border-[var(--color-border)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-[var(--color-text)]">
                      {selectedItem.question}
                    </h2>
                    {selectedItem.question_en && (
                      <p className="mt-0.5 text-sm text-[var(--color-subtext)]">
                        {selectedItem.question_en}
                      </p>
                    )}
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    selectedItem.status === "published" || selectedItem.status === "ready"
                      ? "bg-green-100 text-green-700"
                      : selectedItem.status === "review"
                      ? "bg-amber-100 text-amber-700"
                      : selectedItem.status === "rejected"
                      ? "bg-red-50 text-red-500"
                      : selectedItem.status === "failed"
                      ? "bg-red-100 text-red-600"
                      : selectedItem.status === "processing"
                      ? "bg-blue-100 text-blue-600 animate-pulse"
                      : "bg-gray-100 text-gray-600"
                  }`}>
                    {STATUS_LABELS[selectedItem.status]}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedItem.status === "review" && (
                    <>
                      <button onClick={() => handleAction(selectedItem.id, "publish")}
                        className="rounded-lg bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700">
                        发布
                      </button>
                      <button onClick={() => handleAction(selectedItem.id, "reject")}
                        className="rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-600 hover:bg-red-100">
                        退回
                      </button>
                    </>
                  )}
                  {(selectedItem.status === "published" || selectedItem.status === "ready") && (
                    <button onClick={() => handleAction(selectedItem.id, "unpublish")}
                      className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-100">
                      下架
                    </button>
                  )}
                  {(selectedItem.status === "failed" || selectedItem.status === "rejected") && (
                    <button onClick={() => handleAction(selectedItem.id, "retry")}
                      className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-100">
                      重新分析
                    </button>
                  )}
                </div>
                {selectedItem.status === "failed" && selectedItem.error_message && (
                  <p className="mt-2 text-sm text-red-500">{selectedItem.error_message}</p>
                )}
              </div>

              {/* Content tabs */}
              <div className="border-b border-[var(--color-border)] px-4 py-2">
                <div className="flex gap-1">
                  {(["raw", "detailed", "brief", "en"] as const).map((tab) => (
                    <button key={tab} onClick={() => setPreviewTab(tab)}
                      className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                        previewTab === tab
                          ? "bg-[var(--color-text)] text-white"
                          : "bg-[var(--color-surface)] text-[var(--color-subtext)] hover:bg-[var(--color-border)]"
                      }`}>
                      {tab === "raw" ? "原始" : tab === "detailed" ? "AI 详细" : tab === "brief" ? "精简" : "English"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="prose prose-sm max-w-none">
                  {previewTab === "raw" ? (
                    <pre className="whitespace-pre-wrap rounded-lg bg-[var(--color-surface)] p-3 text-xs">
                      {selectedItem.answer_raw}
                    </pre>
                  ) : (
                    <SyncMarkdownContent
                      content={
                        previewTab === "detailed" ? selectedItem.answer ?? "暂无 AI 增强版"
                          : previewTab === "brief" ? selectedItem.answer_brief ?? "暂无精简版"
                          : selectedItem.answer_en ?? "暂无英文版"
                      }
                      className="markdown-body"
                    />
                  )}
                </div>

                {/* Metadata */}
                <div className="mt-6 space-y-3 border-t border-[var(--color-border)] pt-4">
                  {selectedItem.tags.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-medium text-[var(--color-subtext)]">标签</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedItem.tags.map((tag) => (
                          <span key={tag} className="rounded-full bg-[var(--color-surface)] px-2 py-0.5 text-xs text-[var(--color-subtext)]">{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedItem.categories.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-medium text-[var(--color-subtext)]">分类</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedItem.categories.map((cat) => (
                          <span key={cat} className="rounded-full bg-[var(--color-surface)] px-2 py-0.5 text-xs text-[var(--color-subtext)]">{cat}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedItem.references.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-medium text-[var(--color-subtext)]">参考文献</p>
                      <ul className="space-y-1">
                        {selectedItem.references.map((ref, i) => (
                          <li key={i} className="text-xs">
                            <span className="text-[var(--color-subtext)]">[{ref.type}]</span>{" "}
                            {ref.url ? (
                              <a href={ref.url} target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] hover:underline">{ref.title}</a>
                            ) : ref.title}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {selectedItem.images && selectedItem.images.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-medium text-[var(--color-subtext)]">图片 ({selectedItem.images.length})</p>
                      <div className="grid grid-cols-2 gap-2">
                        {selectedItem.images.map((img, i) => (
                          <div key={i} className="overflow-hidden rounded-lg border border-[var(--color-border)] p-1">
                            <img src={img.url} alt={img.caption} className="w-full rounded" loading="lazy" />
                            <p className="mt-1 text-xs text-[var(--color-subtext)]">{img.caption}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedItem.reviewed_at && (
                    <div className="text-xs text-[var(--color-subtext)]">
                      审批时间: {new Date(selectedItem.reviewed_at).toLocaleString("zh-CN")}
                      {selectedItem.reviewed_by && ` · ${selectedItem.reviewed_by}`}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: 验证**

Run: `npx tsc --noEmit`
Expected: 无类型错误

**Step 3: 手动测试**

1. `/admin` → 重定向到 `/admin/review`
2. 左侧列表显示所有 FAQ，点击某项右侧显示详情
3. 统计栏点击切换筛选
4. 搜索框按问题标题过滤
5. 操作按钮正常工作

**Step 4: Commit**

```bash
git add app/admin/review/page.tsx
git commit -m "feat(admin): add master-detail review page at /admin/review"
```

---

### Task 6: Cleanup — 确认旧代码已清理

**Files:**
- Verify: `app/admin/page.tsx` (应只有重定向)

**Step 1: 验证整体构建**

Run: `npx next build`
Expected: 构建成功

**Step 2: Commit (if any cleanup needed)**

```bash
git add -A
git commit -m "chore: clean up old admin page code"
```

---

### Task 7: Final Verification

**Step 1: 功能测试清单**

- [ ] `/admin` → 重定向到 `/admin/review`
- [ ] `/admin/login` → 登录正常
- [ ] `/admin/submit` → 提交表单正常
- [ ] `/admin/review` → Master-Detail 布局正常
- [ ] 统计栏数字正确，点击切换筛选
- [ ] 左侧搜索正常
- [ ] 右侧 Tab 切换正常
- [ ] 操作按钮正常
- [ ] reviewed_at 字段有值
- [ ] 导航栏高亮当前页
- [ ] 登出正常

**Step 2: 构建验证**

Run: `npx next build`
Expected: 构建成功
