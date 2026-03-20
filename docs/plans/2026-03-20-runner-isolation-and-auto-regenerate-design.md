# Runner Isolation and Auto-Regenerate Design

Date: 2026-03-20

## Context

当前项目已经完成了 admin API 的统一鉴权，但“Agent 触发与执行隔离”以及“Admin Review 退回自动重生成”仍然没有实现。现状是：

- 主站没有任务表，也没有隔离执行层的控制面抽象。
- `reject` 只是修改 FAQ 状态，没有结构化原因记录，也不会自动创建 regenerate 任务。
- 没有独立 `dispatch` / `callback` API 来承接 `self-hosted runner`。

用户已确认：

1. 第 2 项和第 3 项这次一起打通。
2. 需要并行执行，但必须串行的任务要按 stack 顺序推进。
3. 本轮只做“最小可闭环纵切”，不把 batch、diff、similarity 一起纳入。

## Confirmed Decisions

1. 本轮目标是打通：
   - `reject`
   - `create task`
   - `dispatch to runner`
   - `runner callback`
   - `FAQ 回写到 review`
2. 采用 Control Plane + Execution Plane 分层：
   - Control Plane：Next.js API + DB
   - Execution Plane：独立 `self-hosted runner`
3. 主业务 runtime 不直接执行 agent。
4. admin 鉴权继续使用已落地的 `verifyAdmin(request)`。
5. runner 不复用 `ADMIN_API_KEY`，使用独立 `RUNNER_SHARED_SECRET`。
6. callback 入库前必须走 `sanitize`。
7. 本轮不单独引入 `faq_version_events` 表，优先复用现有版本写入路径记录来源。

## Scope

### In Scope

- `faq_reject_events` 最小表
- `admin_tasks` 最小表
- reject reasons + note 结构化入参
- `POST /api/admin/tasks/[id]/dispatch`
- `POST /api/admin/tasks/[id]/callback`
- `reject -> task -> dispatch -> callback -> FAQ review` 闭环
- runner secret 鉴权
- contract test

### Out of Scope

- 批量 API
- 版本 diff API
- similarity 两段式
- 真实 runner 仓库实现
- 多任务类型扩展
- 多 secret / key rotation

## Architecture

### Control Plane

主站负责：

- 接收 admin `reject`
- 校验并写入 reject event
- 创建 `admin_tasks`
- 触发 `dispatch`
- 接收 runner `callback`
- 回写 FAQ 内容与状态

### Execution Plane

`self-hosted runner` 负责：

- 接收已创建 task 的 payload
- 在隔离环境执行 regenerate
- 返回精简结果给 callback API

Control Plane 与 Execution Plane 的边界是：
- Control Plane 决定状态机和审计
- Execution Plane 只负责生成候选产物

## Minimal Data Model

### 1. `faq_reject_events`

最小字段：

- `id`
- `faq_id`
- `reasons text[]`
- `note text`
- `created_by text`
- `created_at`

作用：
- 记录一次 reject 的结构化原因
- 为 regenerate 任务提供明确来源

### 2. `admin_tasks`

最小字段：

- `id`
- `task_type`（本轮仅 `regenerate`）
- `source`（本轮仅 `reject_auto`）
- `status`（`pending | running | succeeded | failed`）
- `payload_json`
- `result_json`
- `error_message`
- `created_by`
- `created_at`
- `updated_at`

作用：
- 作为隔离执行层的任务承载体
- 让主站不直接执行 agent

### 3. Version Source Recording

本轮不新增 `faq_version_events` 表。

方案：
- callback 成功回写 FAQ 时，沿用现有版本写入路径
- 在 `change_reason` 或等价元信息中记录来源
  - 例如：`reject_auto:<taskId>`

原因：
- 这是最小可闭环所需的最低复杂度
- 后续做完整 diff 历史时再扩展独立事件模型更合适

## API Design

### A. Extend `PATCH /api/admin/faq/[id]` Reject Action

请求：

```json
{
  "action": "reject",
  "reasons": ["reference_weak", "formula_missing"],
  "note": "Need stronger sourcing and explicit derivation"
}
```

行为：

1. 校验 `reasons`
2. 写入 `faq_reject_events`
3. 创建 `admin_tasks(task_type="regenerate", source="reject_auto")`
4. 将 FAQ 置为 `rejected`
5. 返回：

```json
{
  "ok": true,
  "taskId": "..."
}
```

### B. `POST /api/admin/tasks/[id]/dispatch`

调用方：
- admin control plane

行为：

1. 校验 admin 权限
2. 读取 task
3. 仅允许 `pending`
4. 调 runner webhook
5. 成功后更新 task 为 `running`

### C. `POST /api/admin/tasks/[id]/callback`

调用方：
- runner

鉴权：
- `Authorization: Bearer <RUNNER_SHARED_SECRET>`

最小回调体：

```json
{
  "status": "succeeded",
  "answer": "...",
  "answer_brief": "...",
  "answer_en": "...",
  "answer_brief_en": "...",
  "question_en": "...",
  "tags": ["..."],
  "primary_category": "...",
  "secondary_category": "...",
  "topics": ["..."],
  "tool_stack": ["..."],
  "references": [],
  "images": []
}
```

失败时：

```json
{
  "status": "failed",
  "error_message": "..."
}
```

行为：

1. 验 runner secret
2. 校验 task 当前为 `running`
3. 对 payload 执行 `sanitize`
4. 更新 task 状态
5. 若成功：
   - 将 FAQ 回写到 `review`
   - 写入新内容
   - 记录来源 `reject_auto:<taskId>`
6. 若失败：
   - task 置为 `failed`
   - 保留 FAQ 当前状态，不自动发布

## Security Design

### Admin vs Runner Separation

两类调用方必须分离：

1. admin
- 使用 `verifyAdmin(request)`
- GitHub admin session 或 `ADMIN_API_KEY`

2. runner
- 使用独立 `RUNNER_SHARED_SECRET`
- 不可复用 admin key

理由：
- admin key 是控制面权限
- runner secret 是执行面回调权限
- 混用会破坏权限边界

### Sanitization Rules

callback 入库前必须：

- 去掉 secrets
- 去掉内部 prompt 原文
- 只保留必要产物字段
- 错误信息保留摘要，不保留敏感上下文

### State Guards

状态机：

- `pending -> running -> succeeded|failed`

约束：

- 只有 `pending` 可 dispatch
- 只有 `running` 可 callback
- 重复 dispatch 必须拒绝
- 重复 callback 必须拒绝或幂等处理

## Execution Plan Shape

### Serial First

先串行完成：

1. contract test
2. `faq_reject_events` / `admin_tasks` schema
3. 共享类型与 DB helper

这是后续并行实现的公共前置。

### Parallel Middle Slice

在基础模型稳定后，并行做两条线：

1. dispatch line
- `app/api/admin/tasks/[id]/dispatch/route.ts`
- `lib/admin-task-dispatch.ts`

2. callback line
- `app/api/admin/tasks/[id]/callback/route.ts`
- `lib/sanitize.ts`

这两条线共享 schema，但功能职责基本独立，适合并行。

### Serial Integration

最后串行完成：

1. `reject` action 接 task 创建
2. dispatch/callback 接口联调
3. FAQ 回写与来源标记
4. 验证与收尾

## Success Criteria

- admin 在 review 中执行 reject 时可提交 `reasons[] + note`
- 系统自动创建 `regenerate` task
- task 能从 `pending` 进入 `running`
- runner callback 后 task 能进入 `succeeded` 或 `failed`
- 成功 callback 时 FAQ 回到 `review` 并写入新内容
- 主业务 runtime 不直接执行 agent
- runner 权限和 admin 权限明确分离
