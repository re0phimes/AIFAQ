# Admin Review Automation and Governance Design

Date: 2026-03-04

## Context

当前后台审核链路已有 `reject` / `regenerate` 基础动作，但缺少：
- 可结构化的退回原因与自动重生成策略
- 独立 agent 执行隔离层
- 批量审核 API（一期）
- 面向审核的内容版本 diff 历史
- 严格开源脱敏策略
- 低成本相似问题治理（BERT）

同时，项目需要统一任务管理入口：`Claude.md` 为真源，`todo.md` 为讨论/执行视图。

## Confirmed Decisions

1. `Claude.md` 为任务真源，`todo.md` 为执行视图。
2. 退回后立即自动重生成。
3. 退回原因采用固定枚举（可多选）+ 备注。
4. agent 执行走 `self-hosted runner`（隔离环境）。
5. 一期批量 API 仅支持：`publish/reject/regenerate/set_level`。
6. 历史查看优先做“内容版本 diff”。
7. 开源安全采用严格脱敏模式。
8. 相似问题治理采用 BERT 两段式（提交提示不阻断，review 强提示）。
9. 一期外部接入仅：`agent-runner + 1个向量库`。

## Scope

### In Scope (Phase 1)

- Review 退回原因结构化 + 自动重生成任务分发
- 独立 runner 任务分发与状态回调
- 批量审核 API（四个动作）
- 内容版本 diff 查询与展示 API
- BERT 相似度提示（提交 + review）
- 脱敏策略与审计日志最小化
- `Claude.md` / `todo.md` 工作流落地

### Out of Scope (Phase 1)

- 直接在业务 Runtime 执行 Codex/Claude Code
- 多向量库并行与混合召回
- 全字段批量内容覆盖式 patch
- 自动合并重复问题（仅提示，不自动合并）

## Architecture

采用“主站控制面 + 隔离执行面”的分层架构：

- Control Plane (Vercel / Next API)
  - 接收 admin 审核动作
  - 持久化任务与审计记录
  - 调度任务到 runner
  - 接收 runner 回调并回写 FAQ 状态/版本

- Execution Plane (Self-hosted Runner)
  - 拉取或接收任务 payload
  - 调用 Codex/Claude Code skills
  - 产出候选内容并回传摘要
  - 不持有长期高权限主库凭证

- Similarity Plane (Single Vector Store + BERT embedding)
  - 提交阶段查询 top-k 相似候选
  - review 阶段返回强提示候选

## Data Model Changes

1. `faq_reject_events`
- `id`
- `faq_id`
- `reasons text[]`
- `note text`
- `created_by`
- `created_at`

2. `admin_tasks`
- `id`
- `task_type` (`regenerate`, `batch_action`, ...)
- `source` (`reject_auto`, `manual`, `batch`)
- `payload_json`
- `status` (`pending`, `running`, `succeeded`, `failed`, `timeout`)
- `error_message`
- `created_by`
- `created_at`, `updated_at`

3. `faq_version_events` (可选轻量表，或复用现有版本表扩展字段)
- `faq_id`
- `version`
- `trigger_type` (`manual`, `import`, `reject_regen`, `batch`)
- `trigger_ref` (task id / reject event id)

4. `faq_similarity_candidates`（可选缓存层）
- `faq_id or draft_id`
- `candidate_faq_id`
- `score`
- `stage` (`submit`, `review`)
- `created_at`

## Core Workflows

### A. Reject -> Auto Regenerate

1. Admin 在 review 中提交 `reject` + `reasons[]` + `note`。
2. API 写入 `faq_reject_events`。
3. API 立即创建 `admin_tasks(task_type=regenerate, source=reject_auto)`。
4. Dispatcher 将任务发送到 runner。
5. Runner 根据 reasons 选择 prompt profile，生成候选答案。
6. 回调 API 后，系统创建新版本草稿并将 FAQ 置回 `review`。
7. 审核页标注“由 reject 自动重生”。

### B. Batch Review Actions

1. Admin 提交 `ids[] + action`。
2. 系统逐条校验权限与状态机合法性。
3. 同步执行轻动作（`set_level` / `publish`），异步派发重动作（`regenerate`）。
4. 返回逐条结果：`accepted/rejected/failed`。

### C. Similarity Check (Two-stage)

- Submit Stage:
  - 用 BERT embedding 查询向量库 top-k。
  - 前端展示“疑似重复”建议，不阻断提交。

- Review Stage:
  - 审核详情页强提示相似候选和分数。
  - 要求 reviewer 在发布前显式做决策（保留/忽略）。

## API Design (Phase 1)

1. `POST /api/admin/faq/:id/reject`
- body: `{ reasons: string[], note?: string }`
- behavior: reject + create auto-regenerate task

2. `POST /api/admin/tasks/:id/dispatch` (internal)
- dispatch task to runner

3. `POST /api/admin/tasks/:id/callback` (runner)
- body: sanitized result summary + artifact refs

4. `POST /api/admin/faq/batch`
- body: `{ ids: number[], action: 'publish'|'reject'|'regenerate'|'set_level', params?: ... }`

5. `GET /api/admin/faq/:id/version-diff?from=x&to=y`
- return structured field-level diff summary

6. `POST /api/similarity/check` (internal or admin submit path)
- input draft question/answer
- return top-k candidates

## Security and Desensitization

严格模式默认策略：
- 不记录 secrets、用户明文标识、IP 明文、内部 prompt 原文。
- 任务与日志只保存必要字段：task id、状态、耗时、匿名 hash、错误码。
- callback payload 在入库前统一走 `sanitize`。
- runner token 使用短期凭证 + 最小权限 + 白名单命令。

## Observability

关键指标：
- auto-regenerate 成功率
- reject -> review 回流时长
- batch action 成功率/失败分类
- similarity 命中率与误报率
- runner 超时率

## Risks and Mitigations

1. 自动重生质量不稳定
- Mitigation: reasons -> prompt profile 映射可迭代，保留人工最终发布门。

2. runner 安全边界被突破
- Mitigation: 网络隔离、短 token、审计追踪、最小权限。

3. 相似问题误报影响审核效率
- Mitigation: 两段式提示，不自动阻断发布，持续调阈值。

4. 批量操作误用
- Mitigation: dry-run 预览、逐条结果回执、强审计日志。

## Success Criteria

- Reject 后无需人工二次点击即可进入重生成流程。
- Admin 可一次性批量执行四类审核动作并拿到逐条结果。
- 审核页可查看任意版本间内容 diff。
- 提交与审核均能看到相似问题提示。
- 开源仓库与生产日志满足严格脱敏要求。

## Documentation and Task Governance

- `Claude.md` 维护长期真源任务状态。
- `todo.md` 维护当前迭代执行状态。
- 每次迭代结束必须双向同步，若冲突以 `Claude.md` 为准。
