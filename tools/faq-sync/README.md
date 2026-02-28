# FAQ 同步工作流

## 概述

双向同步工作流：DB ↔ 本地 JSON 文件。

从 Vercel Postgres 拉取 FAQ 数据到本地 `data/faq-sync/` 目录，在本地借助 Claude Code Skills 评估和改写后，推送回数据库。推送时自动创建答案版本记录。

## 前置条件

`.env.local` 中需要配置以下环境变量：

```
POSTGRES_URL=postgres://...        # Vercel Postgres 连接串
AI_API_KEY=sk-...                  # AI API 密钥
AI_API_BASE_URL=https://...        # AI API 地址（默认 OpenAI）
AI_MODEL=gpt-4o                    # 模型名称
```

## 命令说明

### `npm run faq:pull` — 从数据库导出 FAQ 到本地

将 FAQ 数据导出为独立 JSON 文件，存放在 `data/faq-sync/` 目录下，每条 FAQ 一个文件（以 ID 命名）。

参数：

- `--all` — 全量导出所有 FAQ
- `--flagged` — 只导出 downvote 超过 upvote 的条目
- `--ids 42,108` — 手动指定 FAQ ID，逗号分隔
- `--status review|published` — 按状态筛选

示例：

```bash
npm run faq:pull -- --all
npm run faq:pull -- --flagged
npm run faq:pull -- --ids 42,108
npm run faq:pull -- --status review
```

### `npm run faq:push` — 推送变更回数据库

读取 `data/faq-sync/*.json`，对比数据库中当前 answer，有变更的自动创建版本记录并更新。

```bash
npm run faq:push
```

### `npm run faq:evaluate` — 批量 AI 评分

对 `data/faq-sync/` 下所有 FAQ 文件进行 AI 质量评估，输出报告到 `data/faq-sync/_report.json`。

```bash
npm run faq:evaluate
```

## 完整工作流示例

```bash
# 1. 拉取需要优化的 FAQ（downvote 超标的）
npm run faq:pull -- --flagged

# 2. 在 Claude Code 中使用 /faq-judge 批量评估
#    指定 data/faq-sync/ 目录，自动逐条评分

# 3. 在 Claude Code 中使用 /faq-generator 改写不达标条目
#    基于 judge 的改进建议，改写后直接写回 JSON 文件

# 4. 推送改进后的内容回数据库
npm run faq:push
```

## JSON 文件格式说明

每条 FAQ 导出为独立 JSON 文件（如 `42.json`），结构如下：

```json
{
  "id": 42,
  "question": "对 LLaMA-7B 使用 LoRA（rank=16）进行 SFT，显存占用大约多少？",
  "question_en": "...",
  "answer": "...",
  "answer_brief": "...",
  "answer_en": "...",
  "answer_brief_en": "...",
  "tags": ["LoRA", "显存"],
  "categories": ["训练优化"],
  "references": [],
  "images": [],
  "difficulty": "intermediate",
  "status": "published",
  "current_version": 3,
  "votes_summary": { "up": 15, "down": 3 },
  "downvote_reasons": { "outdated": 2, "unclear": 1 },
  "_pulled_at": "2026-02-28T12:00:00Z"
}
```

可编辑字段：`answer`、`answer_brief`、`answer_en`、`answer_brief_en`、`tags`、`categories`。

## 与 Claude Code Skills 配合使用

### `/faq-judge` 批量模式

指定 `data/faq-sync/` 目录，自动读取所有 JSON 文件，按 10 维度评分，输出汇总报告，标记不达标条目并给出改进建议。

### `/faq-generator` 改写模式

输入一条现有 QA 的 JSON 文件路径 + judge 的改进建议，输出改进后的 QA，直接写回对应的 JSON 文件。

## 注意事项

- `push` 会自动创建版本记录，无需手动管理版本号
- 只有 `answer` 字段有变更才会触发版本创建
- `_report.json` 和 `_pulled_at` 是元数据，不会被推送到数据库
- `data/faq-sync/` 目录已在 `.gitignore` 中，不会提交到仓库
