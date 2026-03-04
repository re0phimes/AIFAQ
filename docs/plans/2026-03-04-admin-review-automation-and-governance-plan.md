# Admin Review Automation and Governance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现 Admin Review 退回自动重生成、隔离 runner 调度、一期批量审核 API、内容版本 diff 历史、BERT 两段式相似提示和严格脱敏。

**Architecture:** 采用 Control Plane（Next.js API）+ Execution Plane（self-hosted runner）+ Similarity Plane（单向量库）分层。主站只负责任务状态机与审计，不直接执行 agent；runner 通过回调写回产物摘要。

**Tech Stack:** Next.js 16 App Router, TypeScript, @vercel/postgres, node:test + tsx, ESLint, self-hosted runner webhook

---

### Task 1: 建立契约测试（先红）

**Files:**
- Create: `scripts/admin-review-automation-contract.test.ts`
- Create: `scripts/admin-batch-and-diff-contract.test.ts`
- Create: `scripts/similarity-two-stage-contract.test.ts`

**Step 1: 写失败测试（结构契约）**

断言：
- `app/api/admin/faq/[id]/route.ts` 存在 reject reasons 处理与 auto-regenerate 任务创建。
- `app/api/admin/faq/batch/route.ts` 存在并支持四种 action。
- `app/api/admin/faq/[id]/version-diff/route.ts` 存在并接收 from/to 参数。
- submit/review 路径存在 similarity 提示入口。
- sanitize 工具被 admin task callback 使用。

**Step 2: 运行红灯验证**

Run: `npx tsx --test scripts/admin-review-automation-contract.test.ts scripts/admin-batch-and-diff-contract.test.ts scripts/similarity-two-stage-contract.test.ts`
Expected: FAIL（新 API/逻辑尚未实现）。

**Step 3: Commit（可选）**

```bash
git add scripts/admin-review-automation-contract.test.ts scripts/admin-batch-and-diff-contract.test.ts scripts/similarity-two-stage-contract.test.ts
git commit -m "test: add contracts for review automation and governance flows"
```

### Task 2: 数据层扩展（reject events + tasks + version trigger metadata）

**Files:**
- Modify: `lib/db.ts`
- Create: `lib/admin-task-types.ts`
- Create: `lib/sanitize.ts`
- Test: `scripts/admin-review-automation-contract.test.ts`

**Step 1: 先补最小 schema 迁移与类型**

在 `initDB()` 添加：
- `faq_reject_events`
- `admin_tasks`
- `faq_versions` 的 trigger metadata 字段（或同等元信息表）

新增 helper：
- `createRejectEvent(...)`
- `createAdminTask(...)`
- `updateAdminTaskStatus(...)`
- `appendVersionTriggerMeta(...)`

**Step 2: 运行局部 lint + 合同测试**

Run:
- `npx eslint lib/db.ts lib/admin-task-types.ts lib/sanitize.ts`
- `npx tsx --test scripts/admin-review-automation-contract.test.ts`

Expected: 部分 contract 仍 FAIL（API 未接）。

**Step 3: Commit**

```bash
git add lib/db.ts lib/admin-task-types.ts lib/sanitize.ts
git commit -m "feat(admin): add reject event and admin task persistence primitives"
```

### Task 3: 单条 reject 自动重生成链路

**Files:**
- Modify: `app/api/admin/faq/[id]/route.ts`
- Create: `lib/reject-reason-profile.ts`
- Modify: `lib/ai.ts` (如需接收 profile hints)
- Test: `scripts/admin-review-automation-contract.test.ts`

**Step 1: reject action 入参校验**

- `reasons: string[]`（可多选）
- `note?: string`
- 枚举值校验（7 项固定值）

**Step 2: reject 后自动创建 regenerate task**

流程：
- `updateFaqStatus(..., "rejected")`
- `createRejectEvent(...)`
- `createAdminTask(task_type="regenerate", source="reject_auto")`
- 返回 task id

**Step 3: 跑测试**

Run:
- `npx eslint app/api/admin/faq/[id]/route.ts lib/reject-reason-profile.ts`
- `npx tsx --test scripts/admin-review-automation-contract.test.ts`

Expected: 该 contract PASS。

**Step 4: Commit**

```bash
git add app/api/admin/faq/[id]/route.ts lib/reject-reason-profile.ts lib/ai.ts
git commit -m "feat(admin): trigger auto-regenerate task on reject with structured reasons"
```

### Task 4: Runner 调度与回调 API（隔离执行面接入）

**Files:**
- Create: `app/api/admin/tasks/[id]/dispatch/route.ts`
- Create: `app/api/admin/tasks/[id]/callback/route.ts`
- Create: `lib/admin-task-dispatch.ts`
- Modify: `lib/sanitize.ts`
- Test: `scripts/admin-review-automation-contract.test.ts`

**Step 1: dispatch API**

- 从 task 表取 payload
- 签名/鉴权后推送 runner webhook
- 更新 task `running`

**Step 2: callback API**

- 验签
- `sanitize` 入库
- 写回 task status + artifact refs
- 成功时触发 FAQ 回到 `review` 并写版本触发来源

**Step 3: 验证**

Run:
- `npx eslint app/api/admin/tasks/[id]/dispatch/route.ts app/api/admin/tasks/[id]/callback/route.ts lib/admin-task-dispatch.ts lib/sanitize.ts`
- `npx tsx --test scripts/admin-review-automation-contract.test.ts`

**Step 4: Commit**

```bash
git add app/api/admin/tasks/[id]/dispatch/route.ts app/api/admin/tasks/[id]/callback/route.ts lib/admin-task-dispatch.ts lib/sanitize.ts
git commit -m "feat(admin): add isolated runner dispatch and callback flow"
```

### Task 5: 一期批量审核 API

**Files:**
- Create: `app/api/admin/faq/batch/route.ts`
- Create: `lib/admin-batch.ts`
- Test: `scripts/admin-batch-and-diff-contract.test.ts`

**Step 1: 实现 batch action（一期四动作）**

支持：
- `publish`
- `reject`（含 reasons/note）
- `regenerate`
- `set_level`

返回：逐条 `accepted/rejected/failed`。

**Step 2: 验证**

Run:
- `npx eslint app/api/admin/faq/batch/route.ts lib/admin-batch.ts`
- `npx tsx --test scripts/admin-batch-and-diff-contract.test.ts`

**Step 3: Commit**

```bash
git add app/api/admin/faq/batch/route.ts lib/admin-batch.ts
git commit -m "feat(admin): add phase-1 batch review actions API"
```

### Task 6: 内容版本 diff 历史 API

**Files:**
- Create: `app/api/admin/faq/[id]/version-diff/route.ts`
- Create: `lib/version-diff.ts`
- Modify: `lib/db.ts` (query helpers)
- Test: `scripts/admin-batch-and-diff-contract.test.ts`

**Step 1: 版本差异摘要逻辑**

输出字段：
- answer / answer_brief
- references
- images
- tags
- trigger source

**Step 2: 验证**

Run:
- `npx eslint app/api/admin/faq/[id]/version-diff/route.ts lib/version-diff.ts lib/db.ts`
- `npx tsx --test scripts/admin-batch-and-diff-contract.test.ts`

**Step 3: Commit**

```bash
git add app/api/admin/faq/[id]/version-diff/route.ts lib/version-diff.ts lib/db.ts
git commit -m "feat(admin): add content version diff API for review history"
```

### Task 7: BERT 两段式相似问题治理

**Files:**
- Create: `lib/similarity.ts`
- Create: `app/api/similarity/check/route.ts`
- Modify: `app/admin/submit/page.tsx`
- Modify: `app/admin/review/page.tsx`
- Test: `scripts/similarity-two-stage-contract.test.ts`

**Step 1: Similarity service（单向量库）**

- 生成 embedding
- top-k 检索
- 统一阈值配置

**Step 2: 提交阶段提示（不阻断）**

在 submit 页面展示候选。

**Step 3: review 阶段强提示**

在 review 页显示更强提醒与处理动作提示。

**Step 4: 验证**

Run:
- `npx eslint lib/similarity.ts app/api/similarity/check/route.ts app/admin/submit/page.tsx app/admin/review/page.tsx`
- `npx tsx --test scripts/similarity-two-stage-contract.test.ts`

**Step 5: Commit**

```bash
git add lib/similarity.ts app/api/similarity/check/route.ts app/admin/submit/page.tsx app/admin/review/page.tsx
git commit -m "feat(similarity): add bert-based two-stage duplicate hints"
```

### Task 8: 文档与任务真源治理

**Files:**
- Modify: `Claude.md`
- Modify: `todo.md`
- Modify: `README.md` (新增 admin workflow 与安全说明)

**Step 1: 固化工作约定**

- `Claude.md` 真源规则
- `todo.md` 执行视图规则

**Step 2: 增加运维说明**

- runner 配置
- 脱敏策略
- 批量 API 与 diff API 使用说明

**Step 3: 验证与最终回归**

Run:
- `npx tsx --test scripts/admin-review-automation-contract.test.ts scripts/admin-batch-and-diff-contract.test.ts scripts/similarity-two-stage-contract.test.ts`
- `npm run lint`
- `npm run build`

**Step 4: Commit**

```bash
git add Claude.md todo.md README.md
git commit -m "docs(admin): document review automation governance and runbook"
```

---

## Notes For Execution

1. 全流程遵循 `@test-driven-development`。
2. 出现行为偏差先走 `@systematic-debugging`，禁止猜改。
3. 对外声明完成前执行 `@verification-before-completion`。
4. 所有 runner 回调入库前必须走 sanitize。
