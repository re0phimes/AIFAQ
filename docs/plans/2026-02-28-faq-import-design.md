# FAQ 文件导入 + QA 生成 Pipeline 设计

日期: 2026-02-28

## 目标

在 admin 提交页支持文件导入（md/txt/pdf），自动提取文本、生成 QA 对、AI 评分筛选，通过的进入人工审批。同时提供 API 端点供程序化调用。

## 两个任务

- Task A: 文件导入功能（Web UI + API 端点 + 文件解析）
- Task B: 处理 Skill（faq-generator + faq-judge，用 skill-creator 创建）

## 决策

- 后端统一解析（方案 A2）
- 两阶段 Skill Pipeline（方案 B2）
- PDF 解析: Mistral OCR（预留 provider 接口可替换）
- 认证: 所有 /api/admin/* 统一支持 Cookie JWT + Bearer API Key
- 多文件独立处理，进度队列，5 分钟超时
- Skill 用 skill-creator 创建，不直接写代码

## API 端点

### POST /api/admin/faq/import

认证: Cookie JWT 或 Authorization: Bearer <ADMIN_API_KEY>

请求: multipart/form-data
- file: 上传文件（必填，最大 4MB）
- format: 格式提示（可选，md/pdf/txt，默认自动检测）

响应:
```json
{
  "importId": "imp_abc123",
  "status": "processing",
  "fileType": "pdf",
  "message": "文件已接收，正在处理..."
}
```

### GET /api/admin/faq/import/[id]

查询导入状态，前端轮询用。

## 认证改造

新增 ADMIN_API_KEY 环境变量。统一认证函数:
```typescript
async function verifyAdmin(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7) === process.env.ADMIN_API_KEY;
  }
  return getAuthStatus();
}
```
所有 /api/admin/* 端点使用此函数。

## OCR Provider 接口

```typescript
interface OCRProvider {
  name: string;
  parseToMarkdown(fileBuffer: Buffer, mimeType: string): Promise<string>;
}
```
默认: MistralOCRProvider。后续可替换。

## Web 端导入页面

/admin/submit 页面扩展，Tab 切换: 手动输入 / 文件导入。

文件导入模式:
- 拖拽上传区，支持多文件选择
- 处理队列列表: 每个文件独立显示进度条、耗时、状态
- 状态: 解析中 → 生成 QA → Judge 评分 → 完成/失败/超时
- 5 分钟超时，超时可重试
- 底部 API 使用说明（curl 示例）

## Skill 1: faq-generator

用 skill-creator 创建。

输入: 文档 Markdown 文本
输出: QA 对列表

每个 QA 包含: question, answer (Markdown+LaTeX), tags, categories, confidence

生成数量: 根据文档长度自适应（约每 1000 字 1-2 个 QA）

## Skill 2: faq-judge

用 skill-creator 创建。

输入: QA 对列表 + 原文摘要

### 问题评分 (1-5)
- naturalness: 是否像真实用户会问的
- context_relevance: 脱离原文后问题是否有意义
- knowledge_clarity: 是否清楚在考什么知识
- phrasing: 结合场景的问法是否恰当

### 答案评分 (1-5)
- accuracy: 答案是否正确
- completeness: 是否充分回答
- mastery: 读者能否真正理解知识点
- independence: 不依赖原文也能理解

### 输出
- 每个 QA 的各维度分数 + 平均分 + verdict (pass/fail)
- question_suggestion: 问题改进建议
- answer_suggestion: 答案改进建议
- 阈值: 平均分 >= 3.5 → pass

## 数据流

```
文件上传 → API 接收
  → md/txt: 直接读取
  → pdf: Mistral OCR → Markdown
  → Skill 1 (faq-generator): 生成 QA 对
  → Skill 2 (faq-judge): 评分 + 建议
  → pass: analyzeFAQ() 增强 → DB (status: review)
  → fail: 记录日志
  → /admin/review 人工终审
```

## 新表 faq_imports

```sql
CREATE TABLE faq_imports (
  id          TEXT PRIMARY KEY,
  filename    TEXT NOT NULL,
  file_type   VARCHAR(10) NOT NULL,
  status      VARCHAR(20) DEFAULT 'pending',
  total_qa    INTEGER DEFAULT 0,
  passed_qa   INTEGER DEFAULT 0,
  error_msg   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
```

status 值: pending/parsing/generating/judging/enriching/completed/failed/timeout

## 不做的事情

- URL 导入
- 图片文件导入
- WebSocket 实时推送（用轮询）
- 导入历史管理页面
- 直接写 Skill 代码（用 skill-creator）
