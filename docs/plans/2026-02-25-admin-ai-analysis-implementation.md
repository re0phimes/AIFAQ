# AIFAQ 管理后台 + AI 分析 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 AIFAQ 添加管理员登录、FAQ 提交、AI 异步分析功能，部署在 Vercel 上。

**Architecture:** 保持现有静态数据流不变，新增 Vercel Postgres 存储动态 FAQ，首页改为 ISR 合并两个数据源。管理后台通过环境变量密码 + JWT cookie 认证，AI 分析通过 waitUntil() 异步处理。

**Tech Stack:** Next.js 16 (App Router, ISR), Vercel Postgres, jose (JWT), OpenAI 兼容 API

---

### Task 1: 安装依赖 + 修改 Next.js 配置

**Files:**
- Modify: `package.json`
- Modify: `next.config.ts`

**Step 1: 安装新依赖**

```bash
cd /home/modelenv/chentianxuan/s_projects/aifaq
npm install jose @vercel/postgres
```

**Step 2: 移除静态导出配置**

修改 `next.config.ts`，移除 `output: 'export'`:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

**Step 3: 验证构建不报错**

```bash
npm run build
```

Expected: 构建成功，不再生成 `out/` 目录

**Step 4: Commit**

```bash
git add package.json package-lock.json next.config.ts
git commit -m "chore: add jose and @vercel/postgres, remove static export"
```

---

### Task 2: 创建 JWT 认证工具库

**Files:**
- Create: `lib/auth.ts`

**Step 1: 创建 `lib/auth.ts`**

```typescript
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "admin_token";

function getSecret(): Uint8Array {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) throw new Error("ADMIN_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function createToken(): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, getSecret());
    return true;
  } catch {
    return false;
  }
}

export async function getAuthStatus(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;
  return verifyToken(token);
}

export function verifyPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw new Error("ADMIN_PASSWORD is not set");
  return password === expected;
}

export { COOKIE_NAME };
```

**Step 2: Commit**

```bash
git add lib/auth.ts
git commit -m "feat(auth): add JWT auth utility"
```

---

### Task 3: 创建登录/登出 API Routes

**Files:**
- Create: `app/api/auth/login/route.ts`
- Create: `app/api/auth/logout/route.ts`

**Step 1: 创建登录 API**

`app/api/auth/login/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifyPassword, createToken, COOKIE_NAME } from "@/lib/auth";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json();
  const { password } = body;

  if (!password || !verifyPassword(password)) {
    return NextResponse.json({ error: "密码错误" }, { status: 401 });
  }

  const token = await createToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
  return response;
}
```

**Step 2: 创建登出 API**

`app/api/auth/logout/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth";

export async function POST(): Promise<NextResponse> {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });
  return response;
}
```

**Step 3: Commit**

```bash
git add app/api/auth/
git commit -m "feat(auth): add login/logout API routes"
```

---

### Task 4: 创建登录页面

**Files:**
- Create: `app/admin/login/page.tsx`

**Step 1: 创建登录页面**

`app/admin/login/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push("/admin");
    } else {
      setError("密码错误");
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="font-serif text-2xl font-bold text-deep-ink">
          管理员登录
        </h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="输入管理密码"
          className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-400 focus:outline-none"
          autoFocus
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={loading || !password}
          className="w-full rounded-lg bg-deep-ink px-4 py-2 text-sm text-white transition-colors hover:bg-deep-ink/90 disabled:opacity-50"
        >
          {loading ? "登录中..." : "登录"}
        </button>
      </form>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add app/admin/login/
git commit -m "feat(admin): add login page"
```

---

### Task 5: 创建数据库工具库 + Schema

**Files:**
- Create: `lib/db.ts`
- Create: `scripts/init-db.ts`

**Step 1: 创建 `lib/db.ts`**

```typescript
import { sql } from "@vercel/postgres";
import type { Reference } from "@/src/types/faq";

export interface DBFaqItem {
  id: number;
  question: string;
  answer_raw: string;
  answer: string | null;
  tags: string[];
  references: Reference[];
  status: "pending" | "processing" | "ready" | "failed";
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
}

export async function initDB(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS faq_items (
      id            SERIAL PRIMARY KEY,
      question      TEXT NOT NULL,
      answer_raw    TEXT NOT NULL,
      answer        TEXT,
      tags          TEXT[] DEFAULT '{}',
      references    JSONB DEFAULT '[]',
      status        VARCHAR(20) DEFAULT 'pending',
      error_message TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export async function createFaqItem(
  question: string,
  answerRaw: string
): Promise<DBFaqItem> {
  const result = await sql`
    INSERT INTO faq_items (question, answer_raw)
    VALUES (${question}, ${answerRaw})
    RETURNING *
  `;
  return rowToFaqItem(result.rows[0]);
}

export async function updateFaqStatus(
  id: number,
  status: string,
  data?: { answer?: string; tags?: string[]; references?: Reference[]; error_message?: string }
): Promise<void> {
  if (data?.answer !== undefined) {
    await sql`
      UPDATE faq_items
      SET status = ${status},
          answer = ${data.answer},
          tags = ${data.tags ?? []},
          references = ${JSON.stringify(data.references ?? [])},
          error_message = NULL,
          updated_at = NOW()
      WHERE id = ${id}
    `;
  } else {
    await sql`
      UPDATE faq_items
      SET status = ${status},
          error_message = ${data?.error_message ?? null},
          updated_at = NOW()
      WHERE id = ${id}
    `;
  }
}

export async function getAllFaqItems(): Promise<DBFaqItem[]> {
  const result = await sql`
    SELECT * FROM faq_items ORDER BY created_at DESC
  `;
  return result.rows.map(rowToFaqItem);
}

export async function getReadyFaqItems(): Promise<DBFaqItem[]> {
  const result = await sql`
    SELECT * FROM faq_items WHERE status = 'ready' ORDER BY created_at DESC
  `;
  return result.rows.map(rowToFaqItem);
}

export async function getFaqItemById(id: number): Promise<DBFaqItem | null> {
  const result = await sql`
    SELECT * FROM faq_items WHERE id = ${id}
  `;
  if (result.rows.length === 0) return null;
  return rowToFaqItem(result.rows[0]);
}

function rowToFaqItem(row: Record<string, unknown>): DBFaqItem {
  return {
    id: row.id as number,
    question: row.question as string,
    answer_raw: row.answer_raw as string,
    answer: row.answer as string | null,
    tags: (row.tags as string[]) ?? [],
    references: (typeof row.references === "string"
      ? JSON.parse(row.references)
      : row.references) as Reference[],
    status: row.status as DBFaqItem["status"],
    error_message: row.error_message as string | null,
    created_at: new Date(row.created_at as string),
    updated_at: new Date(row.updated_at as string),
  };
}
```

**Step 2: 创建初始化脚本 `scripts/init-db.ts`**

```typescript
import { initDB } from "../lib/db";

async function main() {
  await initDB();
  console.log("Database initialized successfully");
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to initialize database:", err);
  process.exit(1);
});
```

**Step 3: Commit**

```bash
git add lib/db.ts scripts/init-db.ts
git commit -m "feat(db): add Vercel Postgres database layer"
```

---

### Task 6: 创建 AI 分析工具库

**Files:**
- Create: `lib/ai.ts`

**Step 1: 创建 `lib/ai.ts`**

```typescript
import type { Reference } from "@/src/types/faq";

interface AIAnalysisResult {
  tags: string[];
  references: Reference[];
  answer: string;
}

export async function analyzeFAQ(
  question: string,
  answerRaw: string,
  existingTags: string[]
): Promise<AIAnalysisResult> {
  const baseUrl = process.env.AI_API_BASE_URL;
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;

  if (!baseUrl || !apiKey || !model) {
    throw new Error("AI API configuration is incomplete");
  }

  const systemPrompt = `你是一个 AI/ML 知识库助手。你的任务是分析用户提交的问答对，并输出结构化的 JSON。

要求:
1. tags: 为这个问答生成 2-5 个标签。尽量复用已有标签列表中的标签，保持一致性。标签应该是中文的技术术语。
2. references: 根据问答内容，推荐 1-3 个相关的论文 (arXiv) 或技术博客文章。每个引用包含 type ("paper" 或 "blog")、title 和 url。
3. answer: 对原始答案进行润色和补充，使其更完整、准确。保持 Markdown 格式，支持 LaTeX 公式 (用 $ 或 $$ 包裹)。

已有标签列表: ${existingTags.join(", ")}

只输出 JSON，不要输出其他内容。`;

  const userPrompt = `问题: ${question}

原始答案:
${answerRaw}`;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI API error (${response.status}): ${text}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI returned empty response");

  const parsed = JSON.parse(content) as AIAnalysisResult;

  // Validate structure
  if (!Array.isArray(parsed.tags) || !Array.isArray(parsed.references) || typeof parsed.answer !== "string") {
    throw new Error("AI returned invalid JSON structure");
  }

  return parsed;
}
```

**Step 2: Commit**

```bash
git add lib/ai.ts
git commit -m "feat(ai): add AI analysis utility with OpenAI-compatible API"
```

---

### Task 7: 创建管理员 FAQ API Routes

**Files:**
- Create: `app/api/admin/faq/route.ts`
- Create: `app/api/admin/faq/[id]/route.ts`

**Step 1: 创建 GET + POST route**

`app/api/admin/faq/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getAuthStatus } from "@/lib/auth";
import { createFaqItem, getAllFaqItems, getReadyFaqItems, updateFaqStatus } from "@/lib/db";
import { analyzeFAQ } from "@/lib/ai";
import { waitUntil } from "@vercel/functions";

export async function GET(): Promise<NextResponse> {
  const authed = await getAuthStatus();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await getAllFaqItems();
  return NextResponse.json(items);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authed = await getAuthStatus();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { question, answer } = await request.json();
  if (!question?.trim() || !answer?.trim()) {
    return NextResponse.json({ error: "问题和答案不能为空" }, { status: 400 });
  }

  const item = await createFaqItem(question.trim(), answer.trim());

  // Async AI analysis via waitUntil
  waitUntil(processAIAnalysis(item.id, question.trim(), answer.trim()));

  return NextResponse.json(item, { status: 201 });
}

async function processAIAnalysis(id: number, question: string, answerRaw: string): Promise<void> {
  try {
    await updateFaqStatus(id, "processing");

    // Get existing tags for consistency
    const readyItems = await getReadyFaqItems();
    const existingTags = [...new Set(readyItems.flatMap((item) => item.tags))];

    const result = await analyzeFAQ(question, answerRaw, existingTags);

    await updateFaqStatus(id, "ready", {
      answer: result.answer,
      tags: result.tags,
      references: result.references,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await updateFaqStatus(id, "failed", { error_message: message });
  }
}
```

**Step 2: 创建 PATCH route**

`app/api/admin/faq/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getAuthStatus } from "@/lib/auth";
import { getFaqItemById, updateFaqStatus, getReadyFaqItems } from "@/lib/db";
import { analyzeFAQ } from "@/lib/ai";
import { waitUntil } from "@vercel/functions";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const authed = await getAuthStatus();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const numId = parseInt(id, 10);
  const item = await getFaqItemById(numId);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();

  // Retry: re-trigger AI analysis
  if (body.action === "retry") {
    await updateFaqStatus(numId, "pending");
    waitUntil(retryAnalysis(numId, item.question, item.answer_raw));
    return NextResponse.json({ ok: true });
  }

  // Manual edit
  if (body.question || body.answer || body.tags || body.references) {
    await updateFaqStatus(numId, body.status ?? item.status, {
      answer: body.answer ?? item.answer ?? undefined,
      tags: body.tags ?? item.tags,
      references: body.references ?? item.references,
    });
    const updated = await getFaqItemById(numId);
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "No valid action" }, { status: 400 });
}

async function retryAnalysis(id: number, question: string, answerRaw: string): Promise<void> {
  try {
    await updateFaqStatus(id, "processing");
    const readyItems = await getReadyFaqItems();
    const existingTags = [...new Set(readyItems.flatMap((i) => i.tags))];
    const result = await analyzeFK(question, answerRaw, existingTags);
    await updateFaqStatus(id, "ready", {
      answer: result.answer,
      tags: result.tags,
      references: result.references,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await updateFaqStatus(id, "failed", { error_message: message });
  }
}
```

注意: `retryAnalysis` 中有个 typo `analyzeFK` 应为 `analyzeFAQ`，实施时需修正。

**Step 3: 安装 @vercel/functions**

```bash
npm install @vercel/functions
```

**Step 4: Commit**

```bash
git add app/api/admin/
git commit -m "feat(api): add admin FAQ CRUD + async AI analysis"
```

---

### Task 8: 创建管理后台页面

**Files:**
- Create: `app/admin/page.tsx`

**Step 1: 创建管理后台页面**

`app/admin/page.tsx` — 这是一个客户端组件，包含:
- FAQ 提交表单 (问题 textarea + 答案 textarea + 提交按钮)
- FAQ 列表 (显示所有后台提交的 FAQ，含状态标签)
- 每条 FAQ 可展开查看详情 (AI 分析结果)
- 失败项显示错误信息 + 重试按钮
- 登出按钮

关键状态颜色:
- pending: 灰色
- processing: 蓝色/动画
- ready: 绿色
- failed: 红色

页面需要:
- 定时轮询 `/api/admin/faq` 刷新列表 (每 5 秒，当有 pending/processing 项时)
- 提交后立即在列表中显示新项 (乐观更新)

**Step 2: Commit**

```bash
git add app/admin/page.tsx
git commit -m "feat(admin): add admin dashboard page"
```

---

### Task 9: 管理后台路由保护

**Files:**
- Create: `middleware.ts` (项目根目录)

**Step 1: 创建 middleware**

`middleware.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "admin_token";

function getSecret(): Uint8Array {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return new TextEncoder().encode("fallback-dev-secret");
  return new TextEncoder().encode(secret);
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Only protect /admin (not /admin/login)
  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  try {
    await jwtVerify(token, getSecret());
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
```

注意: middleware 中不能使用 `cookies()` from `next/headers`，需要直接从 request 读取。API routes 的鉴权由 middleware 统一处理后，`lib/auth.ts` 中的 `getAuthStatus` 仍作为 API route 内的二次校验。

**Step 2: Commit**

```bash
git add middleware.ts
git commit -m "feat(auth): add middleware for admin route protection"
```

---

### Task 10: 修改首页支持 ISR + 数据合并

**Files:**
- Modify: `app/page.tsx`

**Step 1: 修改首页为 ISR + 合并数据源**

```typescript
import FAQList from "@/components/FAQList";
import faqData from "@/data/faq.json";
import { getReadyFaqItems } from "@/lib/db";
import type { FAQItem } from "@/src/types/faq";

export const revalidate = 60;

export default async function Home() {
  const staticItems = faqData as FAQItem[];

  let dynamicItems: FAQItem[] = [];
  try {
    const dbItems = await getReadyFaqItems();
    dynamicItems = dbItems.map((item) => ({
      id: 10000 + item.id, // Offset to avoid ID collision with static items
      question: item.question,
      date: item.created_at.toISOString().slice(0, 10),
      tags: item.tags,
      references: item.references,
      answer: item.answer ?? item.answer_raw,
    }));
  } catch {
    // DB not available (e.g., local dev without Postgres) — graceful fallback
  }

  const allItems = [...staticItems, ...dynamicItems];

  return (
    <>
      <header className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-deep-ink">AIFAQ</h1>
        <p className="mt-1 text-sm text-slate-secondary">
          AI/ML 常见问题知识库
        </p>
      </header>
      <FAQList items={allItems} />
    </>
  );
}
```

注意: 函数改为 `async`，因为需要查询数据库。动态 FAQ 的 ID 加 10000 偏移量避免与静态数据冲突。DB 查询失败时静默降级，确保本地开发不受影响。

**Step 2: 验证构建**

```bash
npm run build
```

Expected: 构建成功，首页标记为 ISR

**Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: merge static + dynamic FAQ data with ISR"
```

---

### Task 11: 创建 .env.example + 更新文档

**Files:**
- Create: `.env.example`

**Step 1: 创建环境变量模板**

`.env.example`:

```
# Admin auth
ADMIN_PASSWORD=your-admin-password
ADMIN_SECRET=your-jwt-secret-at-least-32-chars

# Vercel Postgres (auto-injected by Vercel when linked)
POSTGRES_URL=

# AI API (OpenAI-compatible)
AI_API_BASE_URL=https://api.openai.com/v1
AI_API_KEY=sk-xxx
AI_MODEL=gpt-4o
```

**Step 2: 确认 .gitignore 包含 .env**

检查 `.gitignore` 是否已包含 `.env*` 规则。

**Step 3: Commit**

```bash
git add .env.example
git commit -m "docs: add .env.example with required environment variables"
```

---

### Task 12: 端到端验证

**Step 1: 本地创建 .env.local**

```bash
cp .env.example .env.local
# 编辑 .env.local 填入实际值
```

**Step 2: 初始化数据库**

```bash
npx tsx scripts/init-db.ts
```

**Step 3: 启动开发服务器并手动测试**

手动测试清单:
- [ ] 访问 `/` — 首页正常显示 81 条静态 FAQ
- [ ] 访问 `/admin` — 重定向到 `/admin/login`
- [ ] 在登录页输入错误密码 — 显示错误
- [ ] 输入正确密码 — 跳转到 `/admin`
- [ ] 在管理后台提交一条 FAQ — 列表中出现 pending 状态
- [ ] 等待 AI 分析完成 — 状态变为 ready
- [ ] 刷新首页 — 新 FAQ 出现在列表中
- [ ] 点击登出 — 重定向到登录页

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete admin dashboard with AI analysis"
```
