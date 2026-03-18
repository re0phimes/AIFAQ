# AIFAQ TODO (Discussion + Execution View)

更新时间: 2026-03-18
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
  - 一期先补齐 `ADMIN_API_KEY` 鉴权，打通程序化上传与轮询状态查询。

3. Admin API Key 方案（`todo`）
- 结论:
  - 所有 `/api/admin/*` 路由统一支持两种鉴权:
    - 浏览器后台: 继续使用 GitHub admin session。
    - 程序化调用: 使用 `Authorization: Bearer <ADMIN_API_KEY>`。
  - `verifyAdmin` 改为接收 `NextRequest`，统一处理 bearer + session。
  - 若请求显式携带错误的 `Authorization` header，则直接返回 `401`，不回退到 session。
  - Bearer key 仅允许从请求头传递，不支持 query 参数。
  - key 比较使用固定时间比较，避免明文日志和错误细节泄露。
  - 覆盖范围至少包括:
    - `app/api/admin/faq/route.ts`
    - `app/api/admin/faq/[id]/route.ts`
    - `app/api/admin/faq/import/route.ts`
    - `app/api/admin/faq/import/[id]/route.ts`
    - `app/api/admin/users/[id]/route.ts`
  - `.env.example` 补充 `ADMIN_API_KEY=`，与上传页 API 文案保持一致。

4. 批量 API 与历史查看（`todo`）
- 结论:
  - 一期批量 API 只做: `publish` / `reject` / `regenerate` / `set_level`。
  - 历史查看优先做“内容版本 diff 历史”。

5. 开源仓库脱敏（`todo`）
- 结论:
  - 采用严格脱敏模式（密钥、身份、IP、敏感原文、内部 prompt）。

6. 相似问题识别（`todo`）
- 结论:
  - 两段式:
    - 提交阶段: BERT 相似问题提示（不阻断）。
    - Review 阶段: 强提示并要求处理。

7. 平台接入范围（`todo`）
- 结论:
  - 一期仅接入: `self-hosted agent-runner` + `1个向量库`。
  - 其余平台先保留接口，不在一期强接入。

