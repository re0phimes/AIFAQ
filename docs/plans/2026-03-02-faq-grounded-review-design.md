# FAQ Grounded Review Pipeline Design

- Date: 2026-03-02
- Scope: 新建 FAQ 类 skill + AIFAQ 自动化脚本，实现“文本问题/图片提问 -> 基础回答 -> 联网证据验证 -> 入 Neon review 队列”

## 1. Goals

1. 支持从文本输入问题直接生成 FAQ 草稿并入库。
2. 支持从图片 OCR 后提取多个问题，批量生成 FAQ 草稿并入库。
3. 联网验证时优先使用论文或知名专家博客来源。
4. 所有自动生成内容默认进入人工审核（`status = review`）。

## 2. Architecture

### 2.1 New Skill

- Path: `C:/Users/re0ph/.codex/skills/faq-grounded-review/SKILL.md`
- Responsibility:
  - 指导输入收集（文本问题、图片问题）
  - 指导检索优先级（论文 > 专家博客 > 其他）
  - 指导验证输出结构（references + verification_notes）
  - 指导入库策略（review 队列）

### 2.2 AIFAQ Runtime Entry

- New script: `tools/faq-sync/answer-and-stage.ts`
- CLI inputs:
  - `--question "..."`
  - `--questions-file <path>`
  - `--images <img1,img2,...>`
  - `--max <N>`
  - `--dry-run`
- Output directory:
  - `data/faq-sync/grounded/`
  - per-question result JSON + `_errors.json`

### 2.3 Pipeline

1. Collect questions (text list / OCR image extraction)
2. Generate draft answer
3. Retrieve evidence from web with preference rules
4. Validate and revise draft with retrieved evidence
5. Stage into DB with `status = review`

## 3. Retrieval and Verification Rules

## 3.1 Source Priority

1. Paper sources: arXiv / conference publication pages
2. Expert blogs: identifiable expert authors with strong technical credibility
3. General tech blogs: supplementary only

## 3.2 Minimum Evidence Threshold

- At least 2 total sources per question
- At least 1 paper-class source preferred
- If no paper source found:
  - set `needs_manual_verification = true`
  - still stage to `review`

## 3.3 Conflict Resolution

- For conflicting claims:
  - prefer higher-priority source class
  - retain conflicting links in `references`
  - summarize conflict in `verification_notes`

## 4. DB Staging Strategy (Neon)

Reuse existing DB helpers in `lib/db.ts`:

1. `createFaqItem(question, answerRaw)`
2. `updateFaqStatus(id, "review", payload)` with:
   - enhanced answer fields
   - tags/categories
   - references
   - verification metadata (`needs_manual_verification`, `verification_notes`)

No direct publish path in this pipeline.

## 5. Compatibility with Existing Admin Flow

- Keep existing admin review page unchanged
- New entries appear in existing `review` filter
- Human reviewer remains final gate for publish/reject

## 6. Error Handling

- Per-question isolation: one failure does not block the batch
- Persist failures to `data/faq-sync/grounded/_errors.json`
- `--dry-run` mode performs full pipeline except DB writes

## 7. Acceptance Criteria

1. `--question` flow stages one review item successfully.
2. `--images` flow extracts multiple questions and stages successful ones.
3. Every staged item includes references.
4. Missing-paper cases are marked with `needs_manual_verification`.
5. Batch processing continues when partial failures occur.

## 8. Out of Scope

1. Admin UI redesign
2. Fully automatic publishing
3. Replacing existing import route behavior
