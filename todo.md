# AIFAQ TODO (Discussion + Execution View)

更新时间: 2026-03-20
真源: `Claude.md`（本文件为讨论与执行视图）

## 规则

- 会话开始先读 `Claude.md` 的 `当前重点 TODO`。
- 本文件先记录讨论结论，再按迭代维护状态。
- 状态约定: `todo` / `doing` / `blocked` / `done`。

## 整体 TODO（排序版）

1. Admin API Key 统一鉴权（`done`）
- 目标: 所有 `/api/admin/*` 路由统一支持 GitHub session 与 `Authorization: Bearer <ADMIN_API_KEY>`，`verifyAdmin` 统一处理 NextRequest。
- 要点: 拒绝错误 Authorization，禁止 query 传 key，key 比较用固定时间算法，`.env.example` 补充 `ADMIN_API_KEY=`。

2. Agent 触发与执行隔离（`doing`）
- 目标: 通过独立 `self-hosted runner` 调用 Codex/Claude Code skills，主业务运行时不直接执行 agent。
- 已完成: control plane 侧已补齐 `admin_tasks`、`dispatch`、`callback`、`RUNNER_SHARED_SECRET`、状态机与失败回退。
- 未完成: 真实 `self-hosted runner` 仓库/部署、程序化上传链路、执行面联调。

3. Admin Review 退回自动重生成（`done`）
- 目标: 退回后立即生成任务，固定枚举原因（多选）附备注，自动派发给 runner。
- 已完成: `reject -> create task -> dispatch -> callback -> FAQ 回写 review` 最小闭环已打通，可追踪来源。
- 后续增强: reject event / task / faq status 仍未做事务化。

4. 后台批量 API（一期）（`todo`）
- 目标: 提供 `publish` / `reject` / `regenerate` / `set_level` 批量动作。
- 要点: 逐条返回执行结果，并复用统一鉴权与执行路径。

5. 历史信息查看（`todo`）
- 目标: 优先支持“内容版本 diff 历史”查看。
- 要点: API 可以对比任意版本，统一在审核页展示 diff 摘要。

6. 开源脱敏（严格模式）（`doing`）
- 目标: 严格脱敏密钥、身份、IP、敏感原文和内部 prompt。
- 已完成: runner callback 入库前已做 `sanitize`，仅保留必要结果字段。
- 未完成: 其他日志/导出/开源路径的统一脱敏策略仍未补齐。

7. 相似问题识别（BERT，两段式）（`todo`）
- 目标: 提交阶段提示、不阻断；Review 阶段强提示并要求处理（合并/保留决策）。
- 要点: 提供候选列表与分数，审稿者需记录处理结果。

8. 手机端查看自适应（`todo`）
- 目标: 无论直接展开还是通过 `DetailModal`，都不出现影响阅读的横向滚动条。
- 要点: 检查 markdown 表格、公式、代码块、图片 gallery、标签/筛选条、详情弹窗内容区等横向 overflow 源，确保按触控尺寸优化。

9. 平台接入范围（一期）（`todo`）
- 目标: 一期仅接入 `self-hosted agent-runner` 与 `1个向量库`，其他平台保留接口但暂不强接。
- 要点: 明确范围，避免过多平台耦合。

## 下一阶段筹备

1. 微信小程序支持（`todo`）
- 目标: 将小程序与现有后台共享数据库。
- 要点: 先评估当前 Vercel Postgres 免费额度是否有超额风险，再决定是否需要数据分层或迁移。

