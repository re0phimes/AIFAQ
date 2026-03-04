# AIFAQ TODO (Discussion + Execution View)

更新时间: 2026-03-04
真源: `Claude.md`（本文件为讨论与执行视图）

## 规则

- 会话开始先读 `Claude.md` 的 `当前重点 TODO`。
- 本文件先记录讨论结论，再按迭代维护状态。
- 状态约定: `todo` / `doing` / `blocked` / `done`。

## 当前迭代（讨论结论）

1. Admin Review 退回自动重生成（`todo`）
- 结论:
  - 退回后立即自动触发重生成。
  - 退回原因为固定枚举（可多选）+ 备注。
- 固定枚举:
  - `images_missing`
  - `content_incomplete`
  - `formula_missing`
  - `reference_weak`
  - `format_issue`
  - `language_issue`
  - `policy_risk`

2. OpenCrawl / Agent 触发路径（`todo`）
- 结论:
  - 走独立 `self-hosted runner`。
  - 允许触发 Codex/Claude Code skills，但不在主业务运行时环境直接执行。

3. 批量 API 与历史查看（`todo`）
- 结论:
  - 一期批量 API 只做: `publish` / `reject` / `regenerate` / `set_level`。
  - 历史查看优先做“内容版本 diff 历史”。

4. 开源仓库脱敏（`todo`）
- 结论:
  - 采用严格脱敏模式（密钥、身份、IP、敏感原文、内部 prompt）。

5. 相似问题识别（`todo`）
- 结论:
  - 两段式:
    - 提交阶段: BERT 相似问题提示（不阻断）。
    - Review 阶段: 强提示并要求处理。

6. 平台接入范围（`todo`）
- 结论:
  - 一期仅接入: `self-hosted agent-runner` + `1个向量库`。
  - 其余平台先保留接口，不在一期强接入。

