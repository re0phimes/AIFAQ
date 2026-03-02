# 图片面试题提取与 FAQ 生成实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现从面试经验贴图片提取问题并自动生成 FAQ 答案的完整功能，使用 faq-generator 和 faq-judge Skill 的精确规则。

**Architecture:** 复用现有 `app/api/admin/faq/import` 接口，新增 `lib/question-extractor.ts` 和 `lib/answer-generator.ts` 模块。图片上传后经过 OCR → 问题提取 → 答案生成 → 质量评估 → AI 增强 → 入库的完整流程。

**Tech Stack:** Next.js API Routes, Vercel AI SDK (OpenAI compatible), Sharp (图片处理), 现有 OCR 模块, PostgreSQL

---

## Task 1: 创建 lib/question-extractor.ts

**Files:**
- Create: `lib/question-extractor.ts`
- Test: `lib/__tests__/question-extractor.test.ts`

**Step 1: Write the failing test**

```typescript
// lib/__tests__/question-extractor.test.ts
import { describe, it, expect } from "vitest";
import { extractQuestionsFromText } from "../question-extractor";

describe("extractQuestionsFromText", () => {
  it("should extract numbered questions", async () => {
    const text = `50道LLM面试题
1. 什么是Transformer？
2. 解释注意力机制
3. KV Cache是什么？`;

    const result = await extractQuestionsFromText(text);

    expect(result).toHaveLength(3);
    expect(result[0].question).toBe("什么是Transformer？");
    expect(result[1].question).toBe("解释注意力机制");
    expect(result[2].question).toBe("KV Cache是什么？");
  });

  it("should filter out social media text", async () => {
    const text = `点赞收藏关注
1. 什么是BERT？
点击主页看更多`;

    const result = await extractQuestionsFromText(text);

    expect(result).toHaveLength(1);
    expect(result[0].question).toBe("什么是BERT？");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test lib/__tests__/question-extractor.test.ts`
Expected: FAIL with "Cannot find module '../question-extractor'"

**Step 3: Write minimal implementation**

```typescript
// lib/question-extractor.ts
// Prompt based on faq-generator skill for question extraction

const QUESTION_EXTRACTION_PROMPT = `你是一个面试题提取专家。从 OCR 提取的文本中识别并提取面试问题列表。

提取规则:
1. 识别以数字编号开头的问题（如 "1.", "2.", "①", "Q1", "(1)"）
2. 识别以问号结尾的句子
3. 过滤描述性文字（如"总结了50道题"、"面试经验分享"）
4. 过滤社交媒体元素（如"点赞收藏"、"关注看更多"、"主页有惊喜"）
5. 保留问题的技术上下文（如"在Transformer中"）
6. 问题应该完整、有技术含义

输出 JSON 格式:
{
  "questions": [
    {
      "question": "提取的完整问题文本",
      "context": "可选的周围上下文"
    }
  ]
}

只输出 JSON，不要输出其他内容。`;

export interface ExtractedQuestion {
  question: string;
  context?: string;
  order: number;
}

export async function extractQuestionsFromText(
  ocrText: string
): Promise<ExtractedQuestion[]> {
  // Minimal implementation - parse simple numbered list
  const lines = ocrText.split("\n");
  const questions: ExtractedQuestion[] = [];
  let order = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    // Match numbered items like "1.", "2.", "(1)", "①"
    const match = trimmed.match(/^(?:\d+[.．]|\(\d+\)|[①②③④⑤⑥⑦⑧⑨⑩])[\s.]*(.*?)[?？]?$/);
    if (match) {
      const questionText = match[1].trim();
      if (questionText && questionText.length > 5) {
        order++;
        questions.push({
          question: questionText + (trimmed.endsWith("?") || trimmed.endsWith("？") ? "" : ""),
          order,
        });
      }
    }
  }

  return questions;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test lib/__tests__/question-extractor.test.ts`
Expected: PASS (basic regex implementation)

**Step 5: Commit**

```bash
git add lib/question-extractor.ts lib/__tests__/question-extractor.test.ts
git commit -m "feat: add question extractor with basic regex parsing"
```

---

## Task 2: 升级 question-extractor 使用 AI

**Files:**
- Modify: `lib/question-extractor.ts`

**Step 1: Add AI-based extraction**

```typescript
// lib/question-extractor.ts
// Update to use AI API for robust extraction

import { waitUntil } from "@vercel/functions";

const baseUrl = process.env.AI_API_BASE_URL;
const apiKey = process.env.AI_API_KEY;
const model = process.env.AI_MODEL;

// ... existing interface ...

async function callAIForExtraction(ocrText: string): Promise<ExtractedQuestion[]> {
  if (!baseUrl || !apiKey || !model) {
    throw new Error("AI API configuration is incomplete");
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: QUESTION_EXTRACTION_PROMPT },
        { role: "user", content: `OCR 文本:\n\n${ocrText}` },
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
  return (parsed.questions || []).map((q: any, i: number) => ({
    question: q.question,
    context: q.context,
    order: i + 1,
  }));
}

export async function extractQuestionsFromText(
  ocrText: string
): Promise<ExtractedQuestion[]> {
  // Use AI for robust extraction
  return callAIForExtraction(ocrText);
}
```

**Step 2: Add fallback to regex on AI failure**

```typescript
export async function extractQuestionsFromText(
  ocrText: string
): Promise<ExtractedQuestion[]> {
  try {
    return await callAIForExtraction(ocrText);
  } catch (err) {
    console.warn("AI extraction failed, falling back to regex:", err);
    // Fallback to regex implementation
    const lines = ocrText.split("\n");
    const questions: ExtractedQuestion[] = [];
    let order = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      const match = trimmed.match(/^(?:\d+[.．]|\(\d+\)|[①②③④⑤⑥⑦⑧⑨⑩])[\s.]*(.*?)$/);
      if (match) {
        const questionText = match[1].trim();
        if (questionText && questionText.length > 5) {
          order++;
          questions.push({
            question: questionText,
            order,
          });
        }
      }
    }

    return questions;
  }
}
```

**Step 3: Run tests**

Run: `npm test lib/__tests__/question-extractor.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add lib/question-extractor.ts
git commit -m "feat: upgrade question extractor to use AI with regex fallback"
```

---

## Task 3: 创建 lib/answer-generator.ts（基于 faq-generator Skill）

**Files:**
- Create: `lib/answer-generator.ts`
- Test: `lib/__tests__/answer-generator.test.ts`

**Step 1: Write the failing test**

```typescript
// lib/__tests__/answer-generator.test.ts
import { describe, it, expect } from "vitest";
import { generateAnswer } from "../answer-generator";

describe("generateAnswer", () => {
  it("should generate answer for interview question", async () => {
    const question = "什么是Transformer？";
    const existingTags = ["Transformer", "深度学习"];

    const result = await generateAnswer(question, existingTags);

    expect(result.question).toBe(question);
    expect(result.answer).toBeTruthy();
    expect(result.answer.length).toBeGreaterThan(50);
    expect(result.tags).toBeInstanceOf(Array);
    expect(result.tags.length).toBeGreaterThanOrEqual(2);
    expect(result.tags.length).toBeLessThanOrEqual(5);
    expect(result.categories).toBeInstanceOf(Array);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test lib/__tests__/answer-generator.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write implementation based on faq-generator Skill**

```typescript
// lib/answer-generator.ts
// Based on .claude/skills/faq-generator/SKILL.md - exact prompt rules

import type { Reference } from "@/src/types/faq";
import taxonomy from "@/data/tag-taxonomy.json";

const CATEGORY_NAMES = (taxonomy as { categories: { name: string }[] }).categories.map(c => c.name);

const baseUrl = process.env.AI_API_BASE_URL;
const apiKey = process.env.AI_API_KEY;
const model = process.env.AI_MODEL;

// Source: .claude/skills/faq-generator/SKILL.md - exact prompt rules
const ANSWER_GENERATION_PROMPT = (existingTags: string[]) => `你是一个 AI/ML 领域的技术教育专家。你的任务是为面试问题生成完整、准确的答案。

生成要求（基于 faq-generator skill 规则）:

1. **问题要求**:
   - 如果问题不够完整，补充必要的场景约束（模型名、参数量、硬件等）
   - 问题要像真实面试场景

2. **答案要求**:
   - 答案要完整、准确，读者不需要参考其他文档也能理解
   - 支持 Markdown 格式和 LaTeX 公式（行内用 $...$，行间用 $$...$$）
   - **公式必须包含**:
     - 来源说明（公式出处或推导依据）
     - 参数定义（每个符号的含义和单位）
     - 场景代入（用问题中的实际值代入计算）

3. **LaTeX 公式格式（硬性要求）**:
   - 确保 $ 配对闭合，不出现孤立的 $
   - 下标 _ 后多字符必须用 {} 包裹，如 $d_{model}$
   - 常见符号：\\times（乘号）、\\cdot（点乘）、\\frac{}{}（分数）

4. **标签与分类**:
   - tags: 2-5 个中文技术标签，尽量从已有标签中选择: ${existingTags.join(", ")}
   - categories: 1-2 个分类，从: ${CATEGORY_NAMES.join(", ")}

5. **参考资料**:
   - 推荐 1-3 个相关论文 (arXiv) 或技术博客
   - 包含 type ("paper" 或 "blog")、title、url

6. **双语输出**:
   - answer: 中文完整答案（Markdown + LaTeX）
   - answer_brief: 中文简要版（不超过 500 字符）
   - answer_en: 英文完整答案
   - answer_brief_en: 英文简要版
   - question_en: 英文问题翻译

输出 JSON 格式:
{
  "question": "完整问题文本（如有补充场景）",
  "answer": "中文完整答案",
  "answer_brief": "中文简要版",
  "answer_en": "英文完整答案",
  "answer_brief_en": "英文简要版",
  "question_en": "英文问题",
  "tags": ["标签1", "标签2"],
  "categories": ["分类1"],
  "confidence": 0.9,
  "references": [
    { "type": "paper", "title": "...", "url": "..." }
  ]
}

只输出 JSON，不要输出其他内容。`;

export interface GeneratedAnswer {
  question: string;
  answer: string;
  answerBrief: string;
  answerEn: string;
  answerBriefEn: string;
  questionEn: string;
  tags: string[];
  categories: string[];
  confidence: number;
  references: Reference[];
}

export async function generateAnswer(
  question: string,
  existingTags: string[]
): Promise<GeneratedAnswer> {
  if (!baseUrl || !apiKey || !model) {
    throw new Error("AI API configuration is incomplete");
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: ANSWER_GENERATION_PROMPT(existingTags) },
        { role: "user", content: `面试问题: ${question}` },
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

  // Validate and provide defaults
  return {
    question: parsed.question || question,
    answer: parsed.answer || "",
    answerBrief: parsed.answer_brief || parsed.answerBrief || "",
    answerEn: parsed.answer_en || parsed.answerEn || "",
    answerBriefEn: parsed.answer_brief_en || parsed.answerBriefEn || "",
    questionEn: parsed.question_en || parsed.questionEn || "",
    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    categories: Array.isArray(parsed.categories) ? parsed.categories : [],
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
    references: Array.isArray(parsed.references) ? parsed.references : [],
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test lib/__tests__/answer-generator.test.ts`
Expected: PASS (requires AI API configured)

**Step 5: Commit**

```bash
git add lib/answer-generator.ts lib/__tests__/answer-generator.test.ts
git commit -m "feat: add answer generator based on faq-generator skill rules"
```

---

## Task 4: 修改 API 路由支持图片

**Files:**
- Modify: `app/api/admin/faq/import/route.ts`
- Modify: `lib/import-pipeline.ts` (add judge export if needed)

**Step 1: Update file type validation**

```typescript
// app/api/admin/faq/import/route.ts:34
// Change from:
// if (!["md", "txt", "pdf"].includes(fileType))
// To:
if (!["md", "txt", "pdf", "png", "jpg", "jpeg", "webp"].includes(fileType)) {
  return NextResponse.json({ error: `Unsupported file type: ${fileType}` }, { status: 400 });
}
```

**Step 2: Add process routing**

```typescript
// app/api/admin/faq/import/route.ts - add after line 44
// Route to different processors based on file type
if (["png", "jpg", "jpeg", "webp"].includes(fileType)) {
  waitUntil(processImageExtract(importId, buffer, filename, mimeType));
} else {
  waitUntil(processDocumentImport(importId, buffer, filename, mimeType));
}
```

**Step 3: Add processImageExtract function**

```typescript
// app/api/admin/faq/import/route.ts - add imports
import { extractQuestionsFromText } from "@/lib/question-extractor";
import { generateAnswer } from "@/lib/answer-generator";
import { parseFileToMarkdown } from "@/lib/ocr";

// Add new function after processImport
async function processImageExtract(
  importId: string,
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<void> {
  try {
    await updateImportStatus(importId, "ocr_processing");
    const ocrText = await parseFileToMarkdown(buffer, filename, mimeType);

    if (!ocrText.trim()) {
      await updateImportStatus(importId, "failed", { error_msg: "图片文字识别失败" });
      return;
    }

    await updateImportStatus(importId, "question_extracting");
    const extractedQuestions = await extractQuestionsFromText(ocrText);

    if (extractedQuestions.length === 0) {
      await updateImportStatus(importId, "failed", { error_msg: "未识别到任何问题" });
      return;
    }

    await updateImportStatus(importId, "answer_generating", {
      extracted_questions: extractedQuestions.length,
    });

    const existingTags = [...new Set(
      (await getPublishedFaqItems()).flatMap((item) => item.tags)
    )];

    // Generate answers for each question
    const generatedQAs: Array<{
      question: string;
      answer: string;
      tags: string[];
      categories: string[];
      confidence: number;
    }> = [];

    for (const q of extractedQuestions) {
      try {
        const result = await generateAnswer(q.question, existingTags);
        generatedQAs.push({
          question: result.question,
          answer: result.answer,
          tags: result.tags,
          categories: result.categories,
          confidence: result.confidence,
        });
      } catch (err) {
        console.error(`Failed to generate answer for: ${q.question}`, err);
      }
    }

    if (generatedQAs.length === 0) {
      await updateImportStatus(importId, "failed", { error_msg: "答案生成失败" });
      return;
    }

    await updateImportStatus(importId, "judging", {
      generated_answers: generatedQAs.length,
    });

    // Judge quality
    const documentSummary = ocrText.slice(0, 2000);
    const judgeResult = await judgeQAPairs(generatedQAs, documentSummary);

    const passedQAs = generatedQAs.filter((_, i) =>
      judgeResult.results[i]?.verdict === "pass"
    );

    await updateImportStatus(importId, "enriching", {
      generated_answers: generatedQAs.length,
      passed_qa: passedQAs.length,
    });

    // Create FAQ items and enhance with AI
    for (const qa of passedQAs) {
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
        console.error(`Failed to process QA: ${qa.question}`, err);
      }
    }

    await updateImportStatus(importId, "completed", {
      extracted_questions: extractedQuestions.length,
      generated_answers: generatedQAs.length,
      passed_qa: passedQAs.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await updateImportStatus(importId, "failed", { error_msg: message });
  }
}
```

**Step 4: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add app/api/admin/faq/import/route.ts
git commit -m "feat: add image FAQ extraction support to import API"
```

---

## Task 5: 更新 lib/import-pipeline.ts 的 judgeQAPairs（基于 faq-judge Skill）

**Files:**
- Modify: `lib/import-pipeline.ts`

**Step 1: Update judge prompt to 10-dimension scoring**

```typescript
// lib/import-pipeline.ts - update judgeQAPairs system prompt
// Based on .claude/skills/faq-judge/SKILL.md - exact 10-dimension rules

const JUDGE_THRESHOLD = 3.5;
const AUTO_FAIL_THRESHOLD = 2;

const JUDGE_SYSTEM_PROMPT = `你是一个 QA 质量评审专家。评估给定问答对的质量。

评分维度 (每项 1-5 分):

**问题评分**:
- naturalness: 是否像真实用户会问的，不是生硬拼凑
- context_relevance: 脱离原文后问题是否还有意义
- knowledge_clarity: 是否清楚在考什么知识
- phrasing: 结合场景的问法是否恰当
- scenario_completeness: 问题是否包含足够的场景约束（模型名、参数量、硬件等）

**答案评分**:
- accuracy: 答案是否正确
- completeness: 是否充分回答了问题
- mastery: 读者看完能否真正理解这个知识点
- independence: 不依赖原文上下文也能理解
- formula_rigor: 公式是否有来源说明、参数定义、代入实际值的示例

**LaTeX 公式格式检查（硬性要求）**:
- 检查 question 和 answer 中所有 LaTeX 公式格式
- 行内公式必须用 $...$ 包裹，且能正确渲染
- 如果存在无法正确渲染的公式，必须在 answer_suggestion 中明确指出

对这个 QA:
1. 给出各维度分数 (整数 1-5)
2. 给出 question_suggestion (问题改进建议)
3. 给出 answer_suggestion (答案改进建议)

只输出 JSON:
{
  "question_scores": { "naturalness": N, "context_relevance": N, "knowledge_clarity": N, "phrasing": N, "scenario_completeness": N },
  "answer_scores": { "accuracy": N, "completeness": N, "mastery": N, "independence": N, "formula_rigor": N },
  "question_suggestion": "...",
  "answer_suggestion": "..."
}`;

// Update JudgeScore interface
export interface JudgeScore {
  question_scores: {
    naturalness: number;
    context_relevance: number;
    knowledge_clarity: number;
    phrasing: number;
    scenario_completeness: number;
  };
  answer_scores: {
    accuracy: number;
    completeness: number;
    mastery: number;
    independence: number;
    formula_rigor: number;
  };
  average: number;
  verdict: "pass" | "fail";
  fail_reason?: string;
  question_suggestion: string;
  answer_suggestion: string;
}
```

**Step 2: Update compute verdict logic**

```typescript
// Add helper function for verdict computation
function computeVerdict(
  qs: JudgeScore["question_scores"],
  as_: JudgeScore["answer_scores"]
): { average: number; verdict: "pass" | "fail"; fail_reason?: string } {
  const allScores = [
    qs.naturalness, qs.context_relevance, qs.knowledge_clarity, qs.phrasing, qs.scenario_completeness,
    as_.accuracy, as_.completeness, as_.mastery, as_.independence, as_.formula_rigor,
  ];
  const average = Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 100) / 100;

  // Auto-fail checks (from faq-judge skill)
  if (qs.scenario_completeness <= AUTO_FAIL_THRESHOLD) {
    return { average, verdict: "fail", fail_reason: `scenario_completeness=${qs.scenario_completeness} (<=2 auto-fail)` };
  }
  if (as_.formula_rigor <= AUTO_FAIL_THRESHOLD) {
    return { average, verdict: "fail", fail_reason: `formula_rigor=${as_.formula_rigor} (<=2 auto-fail)` };
  }

  if (average >= JUDGE_THRESHOLD) {
    return { average, verdict: "pass" };
  }
  return { average, verdict: "fail", fail_reason: `average=${average} (<${JUDGE_THRESHOLD})` };
}
```

**Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add lib/import-pipeline.ts
git commit -m "feat: update judge to 10-dimension scoring per faq-judge skill"
```

---

## Task 6: 添加端到端测试

**Files:**
- Create: `tests/integration/image-faq-extract.test.ts`

**Step 1: Create integration test**

```typescript
// tests/integration/image-faq-extract.test.ts
import { describe, it, expect } from "vitest";
import { extractQuestionsFromText } from "@/lib/question-extractor";
import { generateAnswer } from "@/lib/answer-generator";
import { judgeQAPairs } from "@/lib/import-pipeline";

describe("Image FAQ Extraction Integration", () => {
  it("should extract questions and generate answers", async () => {
    // Simulate OCR text from a typical interview post
    const ocrText = `50道LLM面试题总结

1. 什么是Transformer的注意力机制？
2. 解释一下KV Cache的作用和原理？
3. 为什么LayerNorm在NLP中比BatchNorm更常用？

记得点赞收藏关注！`;

    // Step 1: Extract questions
    const questions = await extractQuestionsFromText(ocrText);
    expect(questions.length).toBeGreaterThanOrEqual(2);

    // Step 2: Generate answers
    const existingTags = ["Transformer", "注意力机制", "KV Cache", "LayerNorm"];
    const qaPairs = [];
    for (const q of questions.slice(0, 2)) {
      const answer = await generateAnswer(q.question, existingTags);
      qaPairs.push({
        question: answer.question,
        answer: answer.answer,
        tags: answer.tags,
        categories: answer.categories,
        confidence: answer.confidence,
      });
    }

    expect(qaPairs.length).toBe(2);
    expect(qaPairs[0].answer).toBeTruthy();

    // Step 3: Judge quality
    const judgeResult = await judgeQAPairs(qaPairs, ocrText.slice(0, 2000));
    expect(judgeResult.results.length).toBe(2);
    expect(judgeResult.summary.total).toBe(2);
  }, 60000); // 60s timeout for AI calls
});
```

**Step 2: Run integration test**

Run: `npm test tests/integration/image-faq-extract.test.ts`
Expected: PASS (requires AI API configured)

**Step 3: Commit**

```bash
git add tests/integration/image-faq-extract.test.ts
git commit -m "test: add integration test for image FAQ extraction"
```

---

## Task 7: 更新文档和类型定义

**Files:**
- Modify: `src/types/faq.ts` (if needed)
- Create: `docs/image-faq-extraction.md`

**Step 1: Add ImportStatus type**

```typescript
// src/types/faq.ts - add if not exists
export type ImportStatus =
  | "pending"
  | "ocr_processing"
  | "question_extracting"
  | "answer_generating"
  | "judging"
  | "enriching"
  | "completed"
  | "failed";
```

**Step 2: Create documentation**

```markdown
// docs/image-faq-extraction.md
# 图片面试题提取功能

## 使用方式

1. 在 Admin 后台选择 "导入 FAQ"
2. 上传面试经验贴图片 (PNG/JPG/WEBP)
3. 系统自动处理：
   - OCR 文字识别
   - AI 提取问题列表
   - 为每个问题生成答案
   - 质量评估
   - 存入数据库

## API

```http
POST /api/admin/faq/import
Content-Type: multipart/form-data

file: <图片文件>
```

## 处理状态

- `ocr_processing`: 正在识别图片文字
- `question_extracting`: 正在提取问题列表
- `answer_generating`: 正在生成答案
- `judging`: 正在评估质量
- `enriching`: 正在增强内容
- `completed`: 完成
- `failed`: 失败

## 依赖的 Skills

- `faq-generator`: 答案生成规则
- `faq-judge`: 质量评估规则
```

**Step 3: Commit**

```bash
git add src/types/faq.ts docs/image-faq-extraction.md
git commit -m "docs: add image FAQ extraction documentation"
```

---

## 验证清单

- [ ] `lib/question-extractor.ts` 单元测试通过
- [ ] `lib/answer-generator.ts` 单元测试通过
- [ ] `lib/import-pipeline.ts` 10维度评分更新
- [ ] `app/api/admin/faq/import/route.ts` 支持图片
- [ ] 集成测试通过
- [ ] TypeScript 无错误
- [ ] 文档已更新

## 环境变量要求

确保以下环境变量已配置：

```bash
AI_API_BASE_URL=https://api.openai.com/v1  # 或兼容 API
AI_API_KEY=your-api-key
AI_MODEL=gpt-4o  # 或兼容模型
```
