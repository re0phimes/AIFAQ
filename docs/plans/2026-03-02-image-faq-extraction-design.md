# 图片面试题提取与 FAQ 生成设计

**日期**: 2026-03-02
**背景**: 从面试经验贴图片中提取面试问题，自动生成答案并存入 FAQ 数据库

---

## 需求概述

用户上传包含面试题的图片（如小红书面试复盘贴），系统自动：
1. OCR 提取图片中的文字
2. AI 识别并提取面试问题列表
3. 为每个问题生成完整答案
4. 质量评估（可选）
5. 存入数据库

---

## 架构设计

### 方案对比

| 方案 | 描述 | 优点 | 缺点 |
|------|------|------|------|
| A. 直接复用现有 import 接口 | 修改 `app/api/admin/faq/import/route.ts` 支持图片，复用 OCR + 改造 generateQAPairs | 代码复用高，改动小 | 原流程从文档抽知识点，需适配问题列表识别 |
| B. 新建专用接口 | 创建 `app/api/admin/faq/extract/route.ts`，专门处理图片问题提取 | 逻辑清晰，独立演进 | 部分代码重复 |
| C. 扩展 lib/extract-pipeline.ts | 新增提取模块，import 和 extract 共用 OCR 底层 | 架构优雅 | 工作量较大 |

**推荐方案 A**：复用现有 import 接口，但改造流程：
- 原流程：`文档 → 抽取知识点 → 生成 QA → 评估 → 入库`
- 新流程：`图片 → OCR → 提取问题列表 → 生成答案 → 评估 → 入库`

---

## 组件设计

### 1. API 入口

复用 `POST /api/admin/faq/import`，支持图片文件类型：

```typescript
// 新增支持的文件类型
if (!["md", "txt", "pdf", "png", "jpg", "jpeg", "webp"].includes(fileType)) {
  return NextResponse.json({ error: `Unsupported file type: ${fileType}` }, { status: 400 });
}
```

### 2. 流程路由

根据文件类型选择处理流程：

```typescript
if (["png", "jpg", "jpeg", "webp"].includes(fileType)) {
  await processImageExtract(importId, buffer, filename, mimeType);
} else {
  await processDocumentImport(importId, buffer, filename, mimeType);
}
```

### 3. 问题提取模块

新增 `lib/question-extractor.ts`：

```typescript
interface ExtractedQuestion {
  question: string;      // 提取的问题文本
  context?: string;      // 周围上下文（可选）
  order: number;         // 原始顺序
}

/**
 * 从 OCR 文本中提取面试问题列表
 * @param ocrText - OCR 提取的原始文本
 * @returns 问题列表
 */
export async function extractQuestionsFromText(
  ocrText: string
): Promise<ExtractedQuestion[]>;
```

**提取规则（AI Prompt）**：
- 识别以数字编号开头的问题（如 "1.", "2.", "①", "Q1"）
- 识别以问号结尾的句子
- 过滤描述性文字（如"总结了50道题"）
- 过滤社交媒体元素（如"点赞收藏"）
- 保留问题的技术上下文

### 4. 答案生成模块

新增 `lib/answer-generator.ts`：

```typescript
interface GeneratedAnswer {
  question: string;
  answer: string;
  tags: string[];
  categories: string[];
  confidence: number;
  references?: Reference[];
}

/**
 * 为面试问题生成答案
 * @param question - 面试问题
 * @param existingTags - 已有标签列表（保持一致性）
 * @returns 生成的答案
 */
export async function generateAnswer(
  question: string,
  existingTags: string[]
): Promise<GeneratedAnswer>;
```

**生成规则（基于 `faq-generator` Skill）**：

答案生成必须遵循 `.claude/skills/faq-generator/SKILL.md` 的精确规则：

1. **问题要求**：
   - 自然、有场景感，不要生硬拼凑
   - 包含足够的场景约束（模型名、参数量、硬件等）

2. **答案要求**：
   - 完整、准确，读者不需要看原文也能理解
   - 支持 Markdown 格式和 LaTeX 公式
   - 公式必须包含：**来源说明**、**参数定义**、**代入实际值的示例**

3. **标签与分类**：
   - tags: 2-5 个中文技术标签，尽量复用已有标签
   - categories: 1-2 个分类，从 `data/tag-taxonomy.json` 中选择

4. **LaTeX 公式格式（硬性要求）**：
   - 行内公式用 `$...$` 包裹，行间公式用 `$$...$$` 包裹
   - JSON 中的 LaTeX 需要正确转义：`\` 写为 `\\`
   - 检查常见错误：`\times` 写成 `\\times`、下标 `_` 未用 `{}` 包裹多字符

5. **双语输出**：
   - answer: 中文完整答案
   - answer_brief: 中文简要版（不超过 500 字符）
   - answer_en: 英文完整答案
   - answer_brief_en: 英文简要版
   - question_en: 英文问题翻译

### 5. 完整处理流程

```
图片上传
    ↓
OCR 提取 (复用 lib/ocr.ts)
    ↓
提取问题列表 (lib/question-extractor.ts)
    ↓
并行生成答案 (lib/answer-generator.ts)
    ↓
质量评估 (基于 `faq-judge` Skill 精确规则)
    ↓
AI 增强 (复用 lib/ai.ts:analyzeFAQ)
    ↓
存入数据库
```

**质量评估规则（基于 `faq-judge` Skill）**：

质量评估必须遵循 `.claude/skills/faq-judge/SKILL.md` 的 10 维度评分标准：

**问题评分 (每项 1-5 分)**：
- `naturalness`: 是否像真实用户会问的，不是生硬拼凑
- `context_relevance`: 脱离原文后问题是否还有意义
- `knowledge_clarity`: 是否清楚在考什么知识
- `phrasing`: 结合场景的问法是否恰当
- `scenario_completeness`: 问题是否包含足够的场景约束（模型、参数、硬件等）

**答案评分 (每项 1-5 分)**：
- `accuracy`: 答案是否正确
- `completeness`: 是否充分回答了问题
- `mastery`: 读者看完能否真正理解这个知识点
- `independence`: 不依赖原文上下文也能理解
- `formula_rigor`: 公式是否有来源说明、参数定义、代入实际值的示例

**评分逻辑**：
- 平均分 >= 3.5 为 `pass`，否则 `fail`
- `scenario_completeness` <= 2 或 `formula_rigor` <= 2 自动判定为 `fail`
- 每个失败的 QA 给出 `question_suggestion` 和 `answer_suggestion`

**LaTeX 公式检查（硬性要求）**：
- 检查 question 和 answer 中所有 LaTeX 公式格式
- 行内公式必须用 `$...$` 包裹，且能正确渲染
- 发现格式错误必须在 suggestion 中指出并给出修正

---

## 数据流

### ImageExtractJob 状态机

```
pending → ocr_processing → question_extracting → answer_generating → judging → enriching → completed
              ↓                      ↓                      ↓              ↓           ↓
           failed                 failed                 failed         failed      failed
```

### 数据库记录

复用现有的 `faq_imports` 表结构，扩展 `metadata` 字段：

```json
{
  "extracted_questions": 50,
  "generated_answers": 48,
  "passed_judge": 45,
  "failed_questions": ["问题1", "问题2"]
}
```

---

## 错误处理

| 阶段 | 可能错误 | 处理方式 |
|------|----------|----------|
| OCR | 图片模糊、文字无法识别 | 返回失败，提示重新上传 |
| 问题提取 | 未识别到任何问题 | 返回失败，建议检查图片内容 |
| 答案生成 | AI API 错误 | 重试 3 次，失败则跳过该问题 |
| 质量评估 | 低质量答案 | 标记为待审核，不直接发布 |

---

## API 响应

### 提交图片

```http
POST /api/admin/faq/import
Content-Type: multipart/form-data

file: <图片文件>
format: image
```

响应：

```json
{
  "importId": "imp_1234567890_abcdef",
  "status": "processing",
  "fileType": "image",
  "message": "图片已接收，正在提取问题..."
}
```

### 查询进度

复用现有 `/api/admin/faq/import/[id]/status` 接口。

---

## 测试策略

1. **单元测试**
   - `extractQuestionsFromText` - 各种格式的问题列表
   - `generateAnswer` - 不同类型的问题

2. **集成测试**
   - 完整流程：上传图片 → 提取 → 生成 → 入库

3. **示例测试图片**
   - 小红书截图（带编号的问题列表）
   - 纯文本问题列表
   - 混合内容（问题 + 描述）

---

## Prompt 同步策略

为确保代码中的 Prompt 与 Skills 保持一致，采用以下策略：

1. **Skill 作为 Source of Truth**：`.claude/skills/faq-generator/SKILL.md` 和 `faq-judge/SKILL.md` 定义权威规则
2. **代码中的 Prompt 注释**：每个 Prompt 字符串顶部添加注释，注明对应的 Skill 文件路径
3. **定期审计**：当 Skill 更新时，同步更新代码中的 Prompt

---

## 待决策事项

1. 是否需要人工审核环节，还是直接发布？
2. 同一图片重复上传如何处理（去重）？
3. 是否支持批量上传多张图片？
