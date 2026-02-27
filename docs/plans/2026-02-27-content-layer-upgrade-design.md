# Content Layer Upgrade Design

日期: 2026-02-27
状态: 已确认
范围: Phase 1 — 内容层改进 (精简/详细切换 + 图片支持 + 中英文 + Admin 升级)

## 背景

当前 FAQ 系统的内容只有单一版本答案，无图片支持，无多语言，Admin 后台功能简陋。
本次升级解决以下问题：

1. 答案分为精简版和详细版，可切换显示
2. 从博客/arXiv 源文章中提取关联图片
3. 中英文双语支持
4. Admin 后台升级为完整的内容管理系统

## 1. 数据模型变更

### 1.1 DB Schema 新增字段

```sql
ALTER TABLE faq_items ADD COLUMN IF NOT EXISTS answer_brief TEXT;
ALTER TABLE faq_items ADD COLUMN IF NOT EXISTS answer_en TEXT;
ALTER TABLE faq_items ADD COLUMN IF NOT EXISTS answer_brief_en TEXT;
ALTER TABLE faq_items ADD COLUMN IF NOT EXISTS question_en TEXT;
ALTER TABLE faq_items ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]';
```

### 1.2 Status 字段变更

```
旧: pending → processing → ready/failed
新: pending → processing → review → published/rejected/failed
```

- `review`: AI 处理完成，等待管理员审核
- `published`: 审核通过，前端可见 (替代 `ready`)
- `rejected`: 审核不通过

迁移: `UPDATE faq_items SET status = 'published' WHERE status = 'ready'`

### 1.3 TypeScript 类型扩展

```typescript
// src/types/faq.ts
export interface FAQImage {
  url: string;
  caption: string;
  source: "blog" | "paper";
}

export interface FAQItem {
  id: number;
  question: string;
  questionEn?: string;
  date: string;
  tags: string[];
  categories: string[];
  references: Reference[];
  answer: string;              // 中文详细版
  answerBrief?: string;        // 中文精简版
  answerEn?: string;           // 英文详细版
  answerBriefEn?: string;      // 英文精简版
  images?: FAQImage[];
  upvoteCount: number;
  downvoteCount: number;
  difficulty?: "beginner" | "intermediate" | "advanced" | null;
}
```

## 2. AI Pipeline 扩展

### 2.1 图片提取 (新增 lib/image-extractor.ts)

```
references 中的 URL
├── blog URL → fetch HTML → 提取 <img> src + alt + 前后 200 字上下文
└── arXiv URL → 转换为 ar5iv URL → fetch HTML → 提取 <figure> img + figcaption
```

过滤规则:
- 排除 logo/icon/装饰图 (尺寸 < 100x100 或 src 含 logo/icon/favicon)
- 每个源最多提取 10 张候选图

接口:
- `extractImagesFromBlog(url: string): Promise<CandidateImage[]>`
- `extractImagesFromArxiv(arxivId: string): Promise<CandidateImage[]>`

### 2.2 AI 分析扩展 (lib/ai.ts)

单次 API 调用输出:

```typescript
interface AIAnalysisResult {
  tags: string[];
  categories: string[];
  references: Reference[];
  answer: string;           // 中文详细版 (扩展原始答案)
  answer_brief: string;     // 中文精简版 (≤500字则保留原文，>500字则压缩)
  answer_en: string;        // 英文详细版
  answer_brief_en: string;  // 英文精简版
  question_en: string;      // 英文问题
  images: FAQImage[];       // 从候选中选择 0-3 张最相关图片
}
```

精简版规则:
- 原始答案 ≤ 500 字 → 直接作为精简版
- 原始答案 > 500 字 → AI 压缩至 ≤ 500 字
- 详细版 = AI 在原始答案基础上扩展 (加入推导、示例、对比)

图片选择规则:
- 图片 caption/alt/上下文与答案内容语义相关
- 优先架构图、流程图、公式推导图
- 每题 0-3 张

## 3. Admin 后台升级

### 3.1 页面结构

```
Admin Dashboard
├── 概览 (Overview)
│   ├── 总题数 / 已发布 / 待审核 / 失败
│   ├── 本周新增
│   └── 投票统计 (总赞/总踩/踩最多 Top 5)
│
├── 内容管理 (Content)
│   ├── 筛选: 全部 | 待审核 | 已发布 | 失败
│   ├── 每条 FAQ:
│   │   ├── 问题 + 状态标签
│   │   ├── 三 tab: 原始答案 | 精简版 | 详细版
│   │   ├── 图片预览 (可增删)
│   │   ├── 操作: [发布] [退回] [重新生成] [编辑]
│   │   └── 投票数据
│   └── 排序: 最新 | 投票最多 | 踩最多
│
└── 提交新题 (New FAQ)
```

### 3.2 审核流程

1. 提交新 FAQ → status: pending
2. AI 处理 → status: processing
3. AI 完成 → status: review (等待审核)
4. Admin 审核:
   - 预览精简版/详细版/英文版
   - 确认/编辑图片
   - [发布] → status: published (前端可见)
   - [退回] → status: rejected
   - [重新生成] → 重新触发 AI pipeline

## 4. 前端展示改动

### 4.1 FAQItem 组件

展开答案后顶部增加:
- 精简/详细切换: `[精简] [详细]` tab 按钮，默认精简
- 详细模式下答案末尾显示关联图片 (figure + caption，点击放大)

### 4.2 ReadingView (比较模式)

- 工具栏增加全局切换: `[全部精简] [全部详细]`
- 每个 item 也可单独切换

### 4.3 语言切换

- 页面顶部加 `中文 / EN` 切换
- 切换后问题和答案切换语言
- 图片、标签、参考文献共享不变

### 4.4 图片展示

- 详细模式下，答案 Markdown 下方显示图片
- 每张图: 缩略图 + caption，点击弹出 lightbox 放大
- 图片来源标注 (博客/论文)

## 5. 迁移策略

### 5.1 迁移脚本 (scripts/migrate-content.ts)

1. 从 Neon DB 读取所有记录 (不限于 AI-FAQ.md 的 81 题)
2. 对每条:
   - 备份 answer → answer_brief
   - 调用扩展版 AI pipeline (生成详细版 + 英文版 + 图片)
   - 保持 published 状态
3. 支持断点续传 (记录已处理 ID)
4. 一次 AI 调用同时输出中英文精简版 + 详细版

### 5.2 DB Migration

```sql
-- Status 迁移
UPDATE faq_items SET status = 'published' WHERE status = 'ready';
-- 新增字段 (见 1.1)
```

## 6. Phase 2 (后续)

不在本次范围，留待设计:
- OAuth 用户登录 (GitHub/Google)
- 反复学习 / 间隔复习功能
- 难度评估细化
- 图片本地存储 (Vercel Blob)
