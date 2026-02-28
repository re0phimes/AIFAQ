# FAQ 文件导入 + QA 生成 Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 admin 提交页支持文件导入（md/txt/pdf），通过 AI 自动生成 QA 对并评分筛选，通过的进入人工审批。同时提供 API 端点供程序化调用。

**Architecture:** 新增统一认证函数 `verifyAdmin` 支持 Cookie JWT + Bearer API Key。新增 `POST /api/admin/faq/import` 端点接收文件，后端解析后通过两阶段 AI Pipeline（faq-generator → faq-judge）生成并筛选 QA，通过的经 `analyzeFAQ` 增强后入库。前端在 submit 页增加文件导入 Tab，支持多文件独立处理和进度队列。

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, @vercel/postgres, Mistral OCR API, skill-creator

---

### Task 1: 统一认证函数 — verifyAdmin

**Files:**
- Modify: `lib/auth.ts`
- Modify: `app/api/admin/faq/route.ts`
- Modify: `app/api/admin/faq/[id]/route.ts`

**Step 1: 在 `lib/auth.ts` 添加 `verifyAdmin` 函数**

在文件末尾 `export { COOKIE_NAME };` 之前添加：

```typescript
import { NextRequest } from "next/server";

export async function verifyAdmin(request: NextRequest): Promise<boolean> {
  // Method 1: Bearer API Key
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const key = authHeader.slice(7);
    const expected = process.env.ADMIN_API_KEY;
    if (!expected) return false;
    return key === expected;
  }
  // Method 2: Cookie JWT (existing)
  return getAuthStatus();
}
```

注意：`NextRequest` 的 import 要加在文件顶部。

**Step 2: 更新 `app/api/admin/faq/route.ts` 使用 `verifyAdmin`**

将两处 `getAuthStatus()` 替换为 `verifyAdmin(request)`：

```typescript
import { verifyAdmin } from "@/lib/auth";
// ...
export async function GET(request: NextRequest): Promise<NextResponse> {
  const authed = await verifyAdmin(request);
  // ...
}
export async function POST(request: NextRequest): Promise<NextResponse> {
  const authed = await verifyAdmin(request);
  // ...
}
```

注意：GET 函数需要加 `request: NextRequest` 参数（目前没有）。

**Step 3: 更新 `app/api/admin/faq/[id]/route.ts` 同样使用 `verifyAdmin`**

```typescript
import { verifyAdmin } from "@/lib/auth";
// ...
const authed = await verifyAdmin(request);
```

**Step 4: 验证**

Run: `npx tsc --noEmit`

**Step 5: Commit**

```bash
git add lib/auth.ts app/api/admin/faq/route.ts app/api/admin/faq/\[id\]/route.ts
git commit -m "feat(auth): add verifyAdmin with Bearer API Key support for all admin endpoints"
```

---

### Task 2: DB — faq_imports 表

**Files:**
- Modify: `lib/db.ts`

**Step 1: 在 `initDB()` 末尾添加 faq_imports 表创建**

在 `lib/db.ts` 的 `initDB()` 函数末尾（`detail TEXT` 那行之后）添加：

```typescript
await sql`
  CREATE TABLE IF NOT EXISTS faq_imports (
    id          TEXT PRIMARY KEY,
    filename    TEXT NOT NULL,
    file_type   VARCHAR(10) NOT NULL,
    status      VARCHAR(20) DEFAULT 'pending',
    total_qa    INTEGER DEFAULT 0,
    passed_qa   INTEGER DEFAULT 0,
    error_msg   TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
  )
`;
```

**Step 2: 添加 DB 操作函数**

在 `lib/db.ts` 末尾添加：

```typescript
export interface DBImportRecord {
  id: string;
  filename: string;
  file_type: string;
  status: string;
  total_qa: number;
  passed_qa: number;
  error_msg: string | null;
  created_at: Date;
  updated_at: Date;
}

export async function createImportRecord(
  id: string,
  filename: string,
  fileType: string
): Promise<DBImportRecord> {
  await ensureSchema();
  const result = await sql`
    INSERT INTO faq_imports (id, filename, file_type)
    VALUES (${id}, ${filename}, ${fileType})
    RETURNING *
  `;
  return rowToImport(result.rows[0]);
}

export async function updateImportStatus(
  id: string,
  status: string,
  data?: { total_qa?: number; passed_qa?: number; error_msg?: string }
): Promise<void> {
  await sql`
    UPDATE faq_imports
    SET status = ${status},
        total_qa = COALESCE(${data?.total_qa ?? null}::int, total_qa),
        passed_qa = COALESCE(${data?.passed_qa ?? null}::int, passed_qa),
        error_msg = ${data?.error_msg ?? null},
        updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function getImportRecord(id: string): Promise<DBImportRecord | null> {
  await ensureSchema();
  const result = await sql`SELECT * FROM faq_imports WHERE id = ${id}`;
  if (result.rows.length === 0) return null;
  return rowToImport(result.rows[0]);
}

function rowToImport(row: Record<string, unknown>): DBImportRecord {
  return {
    id: row.id as string,
    filename: row.filename as string,
    file_type: row.file_type as string,
    status: row.status as string,
    total_qa: (row.total_qa as number) ?? 0,
    passed_qa: (row.passed_qa as number) ?? 0,
    error_msg: row.error_msg as string | null,
    created_at: new Date(row.created_at as string),
    updated_at: new Date(row.updated_at as string),
  };
}
```

**Step 3: 验证**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add lib/db.ts
git commit -m "feat(db): add faq_imports table and CRUD functions"
```

---

### Task 3: OCR Provider — Mistral OCR 集成

**Files:**
- Create: `lib/ocr.ts`

**Step 1: 创建 OCR provider 模块**

```typescript
export interface OCRProvider {
  name: string;
  parseToMarkdown(fileBuffer: Buffer, mimeType: string): Promise<string>;
}

class MistralOCRProvider implements OCRProvider {
  name = "mistral-ocr";

  async parseToMarkdown(fileBuffer: Buffer, mimeType: string): Promise<string> {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) throw new Error("MISTRAL_API_KEY is not set");

    const base64 = fileBuffer.toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const response = await fetch("https://api.mistral.ai/v1/ocr", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "mistral-ocr-latest",
        document: {
          type: "document_url",
          document_url: dataUrl,
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Mistral OCR error (${response.status}): ${text}`);
    }

    const data = await response.json();
    // Mistral OCR returns pages with markdown content
    const pages = data.pages ?? data.results ?? [];
    return pages.map((p: { markdown?: string; text?: string }) => p.markdown ?? p.text ?? "").join("\n\n---\n\n");
  }
}

// Default provider — swap this to change OCR backend
let currentProvider: OCRProvider = new MistralOCRProvider();

export function getOCRProvider(): OCRProvider {
  return currentProvider;
}

export function setOCRProvider(provider: OCRProvider): void {
  currentProvider = provider;
}

/**
 * Parse a file to Markdown text.
 * - .md/.txt: read as UTF-8 text directly
 * - .pdf: use OCR provider
 */
export async function parseFileToMarkdown(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  const ext = filename.split(".").pop()?.toLowerCase();

  if (ext === "md" || ext === "txt" || mimeType === "text/plain" || mimeType === "text/markdown") {
    return fileBuffer.toString("utf-8");
  }

  if (ext === "pdf" || mimeType === "application/pdf") {
    return getOCRProvider().parseToMarkdown(fileBuffer, mimeType);
  }

  throw new Error(`Unsupported file type: ${ext} (${mimeType})`);
}
```

**Step 2: 验证**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add lib/ocr.ts
git commit -m "feat: add OCR provider module with Mistral OCR and file parsing"
```

---

### Task 4: AI Pipeline — QA 生成 + Judge 评分

**Files:**
- Create: `lib/import-pipeline.ts`

这个模块封装了 faq-generator 和 faq-judge 的 AI 调用逻辑。后续用 skill-creator 创建对应的 Skill 时，会参考这里的 prompt 设计。

**Step 1: 创建 pipeline 模块**

```typescript
import type { Reference, FAQImage } from "@/src/types/faq";

export interface GeneratedQA {
  question: string;
  answer: string;
  tags: string[];
  categories: string[];
  confidence: number;
}

export interface JudgeScore {
  question_scores: {
    naturalness: number;
    context_relevance: number;
    knowledge_clarity: number;
    phrasing: number;
  };
  answer_scores: {
    accuracy: number;
    completeness: number;
    mastery: number;
    independence: number;
  };
  average: number;
  verdict: "pass" | "fail";
  question_suggestion: string;
  answer_suggestion: string;
}

export interface JudgeResult {
  results: JudgeScore[];
  summary: { total: number; passed: number; failed: number };
}

const JUDGE_THRESHOLD = 3.5;

export async function generateQAPairs(
  documentText: string,
  existingTags: string[]
): Promise<GeneratedQA[]> {
  const baseUrl = process.env.AI_API_BASE_URL;
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;
  if (!baseUrl || !apiKey || !model) throw new Error("AI API configuration is incomplete");

  const systemPrompt = `你是一个 AI/ML 领域的技术教育专家。你的任务是阅读一篇技术文档，提取核心知识点，生成高质量的问答对。

要求:
1. 每个问答对包含: question (中文), answer (中文 Markdown，支持 LaTeX 公式用 $ 或 $$ 包裹), tags (2-5个中文技术标签), categories (1-2个分类), confidence (0-1 的置信度)
2. 问题要像真实用户会问的，自然、有场景感，不要生硬拼凑
3. 答案要完整、准确，读者不需要看原文也能理解
4. 根据文档长度自适应生成数量（约每 1000 字 1-2 个 QA）
5. 尽量复用已有标签: ${existingTags.join(", ")}

只输出 JSON: { "qa_pairs": [...] }`;

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
        { role: "user", content: `文档内容:\n\n${documentText}` },
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

  const parsed = JSON.parse(content);
  return parsed.qa_pairs ?? [];
}

export async function judgeQAPairs(
  qaPairs: GeneratedQA[],
  documentSummary: string
): Promise<JudgeResult> {
  const baseUrl = process.env.AI_API_BASE_URL;
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;
  if (!baseUrl || !apiKey || !model) throw new Error("AI API configuration is incomplete");

  const systemPrompt = `你是一个 QA 质量评审专家。评估每个问答对的质量。

评分维度 (每项 1-5 分):

问题评分:
- naturalness: 是否像真实用户会问的，不是生硬拼凑
- context_relevance: 脱离原文后问题是否还有意义
- knowledge_clarity: 是否清楚在考什么知识
- phrasing: 结合场景的问法是否恰当

答案评分:
- accuracy: 答案是否正确
- completeness: 是否充分回答了问题
- mastery: 读者看完能否真正理解这个知识点
- independence: 不依赖原文上下文也能理解

对每个 QA:
1. 给出各维度分数
2. 计算平均分
3. 平均分 >= ${JUDGE_THRESHOLD} 为 pass，否则 fail
4. 给出 question_suggestion (问题改进建议，包括更好的问法)
5. 给出 answer_suggestion (答案改进建议)

只输出 JSON: { "results": [...], "summary": { "total": N, "passed": N, "failed": N } }`;

  const userPrompt = `原文摘要: ${documentSummary}

待评估的 QA 对:
${qaPairs.map((qa, i) => `--- QA ${i + 1} ---\n问题: ${qa.question}\n答案: ${qa.answer}`).join("\n\n")}`;

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
      temperature: 0.2,
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

  return JSON.parse(content);
}
```

**Step 2: 验证**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add lib/import-pipeline.ts
git commit -m "feat: add QA generation and judge scoring AI pipeline"
```

---

### Task 5: Import API 端点

**Files:**
- Create: `app/api/admin/faq/import/route.ts`
- Create: `app/api/admin/faq/import/[id]/route.ts`

**Step 1: 创建 POST /api/admin/faq/import**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth";
import {
  createImportRecord,
  updateImportStatus,
  createFaqItem,
  updateFaqStatus,
  getPublishedFaqItems,
} from "@/lib/db";
import { parseFileToMarkdown } from "@/lib/ocr";
import { generateQAPairs, judgeQAPairs } from "@/lib/import-pipeline";
import { analyzeFAQ } from "@/lib/ai";
import { waitUntil } from "@vercel/functions";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authed = await verifyAdmin(request);
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Validate file size (4MB)
  if (file.size > 4 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 4MB)" }, { status: 400 });
  }

  // Detect file type
  const filename = file.name;
  const ext = filename.split(".").pop()?.toLowerCase();
  const formatHint = formData.get("format") as string | null;
  const fileType = formatHint || ext || "txt";

  if (!["md", "txt", "pdf"].includes(fileType)) {
    return NextResponse.json({ error: `Unsupported file type: ${fileType}` }, { status: 400 });
  }

  // Generate import ID
  const importId = `imp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Create import record
  await createImportRecord(importId, filename, fileType);

  // Read file buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Process in background
  waitUntil(processImport(importId, buffer, filename, file.type || `text/${fileType}`, fileType));

  return NextResponse.json({
    importId,
    status: "processing",
    fileType,
    message: "文件已接收，正在处理...",
  }, { status: 202 });
}

async function processImport(
  importId: string,
  buffer: Buffer,
  filename: string,
  mimeType: string,
  fileType: string
): Promise<void> {
  try {
    // Step 1: Parse file to markdown
    await updateImportStatus(importId, "parsing");
    const markdownText = await parseFileToMarkdown(buffer, filename, mimeType);

    if (!markdownText.trim()) {
      await updateImportStatus(importId, "failed", { error_msg: "文件内容为空" });
      return;
    }

    // Step 2: Generate QA pairs
    await updateImportStatus(importId, "generating");
    const existingTags = [...new Set(
      (await getPublishedFaqItems()).flatMap((item) => item.tags)
    )];
    const qaPairs = await generateQAPairs(markdownText, existingTags);

    if (qaPairs.length === 0) {
      await updateImportStatus(importId, "completed", { total_qa: 0, passed_qa: 0 });
      return;
    }

    await updateImportStatus(importId, "judging", { total_qa: qaPairs.length });

    // Step 3: Judge QA pairs
    const documentSummary = markdownText.slice(0, 2000);
    const judgeResult = await judgeQAPairs(qaPairs, documentSummary);

    const passedPairs = qaPairs.filter((_, i) =>
      judgeResult.results[i]?.verdict === "pass"
    );

    await updateImportStatus(importId, "enriching", {
      total_qa: qaPairs.length,
      passed_qa: passedPairs.length,
    });

    // Step 4: Enrich passed QA pairs with analyzeFAQ and insert into DB
    for (const qa of passedPairs) {
      try {
        const item = await createFaqItem(qa.question, qa.answer);
        await updateFaqStatus(item.id, "processing");

        const result = await analyzeFAQ(qa.question, qa.answer, existingTags);
        await updateFaqStatus(item.id, "review", {
          answer: result.answer,
          answer_brief: result.answer_brief,
          answer_en: result.answer_en,
          answer_brief_en: result.answer_brief_en,
          question_en: result.question_en,
          tags: result.tags,
          categories: result.categories,
          references: result.references,
          images: result.images,
        });
      } catch (err) {
        // Individual QA failure doesn't stop the batch
        console.error(`Failed to process QA: ${qa.question}`, err);
      }
    }

    await updateImportStatus(importId, "completed", {
      total_qa: qaPairs.length,
      passed_qa: passedPairs.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await updateImportStatus(importId, "failed", { error_msg: message });
  }
}
```

**Step 2: 创建 GET /api/admin/faq/import/[id]**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth";
import { getImportRecord } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const authed = await verifyAdmin(request);
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const record = await getImportRecord(id);
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(record);
}
```

**Step 3: 验证**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add app/api/admin/faq/import/route.ts app/api/admin/faq/import/\[id\]/route.ts
git commit -m "feat(api): add file import endpoint with background processing pipeline"
```

---

### Task 6: Web UI — Submit 页面扩展

**Files:**
- Modify: `app/admin/submit/page.tsx`

**Step 1: 重写 submit 页面，添加 Tab 切换和文件导入**

完整替换 `app/admin/submit/page.tsx`。页面包含：
- Tab 切换：手动输入 / 文件导入
- 手动输入：保持现有表单
- 文件导入：拖拽上传区 + 多文件处理队列 + 进度显示 + API 说明

关键实现要点：
- 使用 `<input type="file" multiple accept=".md,.txt,.pdf" />` 支持多文件
- 拖拽区域用 `onDragOver` / `onDrop` 事件
- 每个文件独立 POST 到 `/api/admin/faq/import`
- 轮询 `GET /api/admin/faq/import/[id]` 获取进度（每 3 秒）
- 5 分钟超时前端控制
- 状态映射：pending→等待中, parsing→解析中, generating→生成QA中, judging→评分中, enriching→增强中, completed→完成, failed→失败, timeout→超时

进度条用 status 映射到百分比：
- parsing: 20%
- generating: 50%
- judging: 70%
- enriching: 85%
- completed: 100%

API 说明区域显示 curl 示例：
```
curl -X POST https://your-domain/api/admin/faq/import \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "file=@document.pdf"
```

**Step 2: 验证**

Run: `npx tsc --noEmit`

**Step 3: 手动测试**

1. `/admin/submit` → Tab 切换正常
2. 手动输入 Tab → 原有表单功能不变
3. 文件导入 Tab → 拖拽/选择文件 → 显示处理队列
4. 多文件 → 每个独立处理，互不阻塞
5. 超时 → 显示超时状态和重试按钮
6. API 说明 → curl 示例正确显示

**Step 4: Commit**

```bash
git add app/admin/submit/page.tsx
git commit -m "feat(admin): add file import tab with multi-file queue and progress tracking"
```

---

### Task 7: 创建 Skill — faq-generator

**使用 `/skill-creator` 创建此 Skill。**

Skill 规格：
- 名称: `faq-generator`
- 描述: 从技术文档中提取核心知识点并生成高质量 QA 对
- 输入: 文档 Markdown 文本 + 已有标签列表
- 输出: QA 对列表（question, answer, tags, categories, confidence）
- 生成规则: 每 1000 字约 1-2 个 QA，问题要自然，答案要独立可理解
- 参考: `lib/import-pipeline.ts` 中 `generateQAPairs` 的 prompt 设计

**Step 1: 调用 `/skill-creator` 创建 faq-generator skill**

**Step 2: 验证 skill 文件已创建**

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: create faq-generator skill via skill-creator"
```

---

### Task 8: 创建 Skill — faq-judge

**使用 `/skill-creator` 创建此 Skill。**

Skill 规格：
- 名称: `faq-judge`
- 描述: 评估 QA 对质量，从问题和答案两个维度打分
- 输入: QA 对列表 + 原文摘要
- 问题评分维度: naturalness, context_relevance, knowledge_clarity, phrasing
- 答案评分维度: accuracy, completeness, mastery, independence
- 输出: 每个 QA 的分数 + verdict (pass/fail) + question_suggestion + answer_suggestion
- 阈值: 平均分 >= 3.5 为 pass
- 参考: `lib/import-pipeline.ts` 中 `judgeQAPairs` 的 prompt 设计

**Step 1: 调用 `/skill-creator` 创建 faq-judge skill**

**Step 2: 验证 skill 文件已创建**

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: create faq-judge skill via skill-creator"
```

---

### Task 9: 构建验证 + 最终测试

**Step 1: 完整构建**

Run: `npx next build`
Expected: 构建成功

**Step 2: 功能测试清单**

- [ ] `/admin/submit` → 两个 Tab 正常切换
- [ ] 手动输入 → 原有功能不变
- [ ] 文件导入 → 选择 .md 文件 → 处理成功
- [ ] 文件导入 → 选择 .txt 文件 → 处理成功
- [ ] 文件导入 → 选择 .pdf 文件 → OCR 解析 → 处理成功
- [ ] 多文件 → 独立处理，进度独立显示
- [ ] 超时 → 5 分钟后显示超时
- [ ] API 调用 → curl 带 Bearer token → 返回 importId
- [ ] API 状态查询 → GET /api/admin/faq/import/[id] → 返回进度
- [ ] 生成的 QA → 出现在 /admin/review 审批页
- [ ] Cookie 认证 → Web 端正常工作
- [ ] API Key 认证 → 程序调用正常工作

**Step 3: Final commit if needed**

```bash
git add -A
git commit -m "feat: complete FAQ file import pipeline with multi-file support"
```
