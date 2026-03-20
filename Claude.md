# AIFAQ Project Notes

## 工作约定（高优先级）

- `Claude.md` 是任务真源（Single Source of Truth）。
- 每次会话开始必须先读取 `Claude.md` 的 `当前重点 TODO`。
- `todo.md` 是讨论与执行视图，先记讨论，定稿后回写 `Claude.md`。
- 任务完成时同步更新 `Claude.md` 与 `todo.md`，以 `Claude.md` 为准。

## 项目目的

AIFAQ 是一个 AI/ML FAQ 知识库项目，目标是：
- 提供可检索、可投票、可收藏的问答体验
- 支持中英文阅读与答案呈现
- 通过个人收藏与学习状态（未读/学习中/已内化）帮助用户沉淀知识
- 提供后台审核、导入、版本历史等内容管理能力

## 项目结构（核心）

- `app/`
  - `page.tsx` + `FAQPage.tsx`: 首页与主交互入口
  - `faq/[id]/`: FAQ 详情页
  - `profile/`: 个人收藏与学习页
  - `admin/`: 后台管理页
  - `api/`: 投票、收藏、状态更新、管理相关 API
- `components/`
  - FAQ 展示组件：`FAQList.tsx`, `FAQItem.tsx`, `DetailModal.tsx`
  - 收藏组件：`FavoriteCard.tsx`, `Toast.tsx`
  - 通用组件：`SearchBar.tsx`, `TagFilter.tsx`, `Pagination.tsx` 等
- `lib/`
  - `db.ts`: 数据库访问与业务查询
  - `i18n.ts`: 文案与多语言
  - `ai.ts`, `import-pipeline.ts`, `image-extractor.ts`, `ocr.ts`: AI/导入/图像能力
- `data/`
  - `faq.json`, `tag-taxonomy.json` 等静态数据
- `docs/plans/`
  - 设计与实施计划文档（按日期管理）
- `scripts/` / `tools/`
  - 数据初始化、分析、内容同步脚本

## 近期已完成

1. 收藏日期提示与“尽快内化”提醒
- 已落地相对时间与提醒逻辑（14 天阈值）。
- 已在收藏卡片展示时间标签和提醒标签。
- 已在个人页统一统计 stale 数量并展示提醒条。
- 相关文件：
  - `lib/favorite-reminder.ts`
  - `lib/favorite-reminder.test.ts`
  - `components/FavoriteCard.tsx`
  - `app/profile/ProfileClient.tsx`
  - `lib/i18n.ts`

2. 样式与字体占比优化
- 个人页、收藏卡片、FAQ 卡片的字号层级已下调并统一（移动端/桌面端）。
- 保留了按钮点击面积与交互可用性。
- 相关文件：
  - `app/profile/ProfileClient.tsx`
  - `components/FavoriteCard.tsx`
  - `components/FAQItem.tsx`

## 当前重点 TODO

1. Admin API Key 统一鉴权
- 所有 `/api/admin/*` 路由统一支持:
  - GitHub admin session
  - `Authorization: Bearer <ADMIN_API_KEY>`
- `verifyAdmin` 改为接收 `NextRequest`，统一处理 bearer + session。
- 若显式携带错误的 `Authorization` header，则直接 `401`，不回退 session。
- `ADMIN_API_KEY` 仅允许通过请求头传递，不支持 query 参数。
- Bearer key 比较使用固定时间比较，避免明文日志和错误细节泄露。
- 首批覆盖:
  - `app/api/admin/faq/route.ts`
  - `app/api/admin/faq/[id]/route.ts`
  - `app/api/admin/faq/import/route.ts`
  - `app/api/admin/faq/import/[id]/route.ts`
  - `app/api/admin/users/[id]/route.ts`
- `.env.example` 补充 `ADMIN_API_KEY=`，并与后台上传页 API 文案保持一致。

2. Agent 触发与执行隔离
- 通过独立 `self-hosted runner` 触发 Codex/Claude Code skills。
- 主业务运行时环境不直接执行 agent。
- 一期先补齐 `ADMIN_API_KEY` 鉴权，供程序化上传与 admin API 调用。

3. Admin Review 退回自动重生成
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

4. 后台批量 API（一期）
- 范围仅限:
  - `publish`
  - `reject`
  - `regenerate`
  - `set_level`

5. 历史信息查看
- 优先实现“内容版本 diff 历史”查看。

6. 开源脱敏（严格模式）
- 密钥、身份标识、IP、敏感原文、内部 prompt 默认脱敏并最小化落盘。

7. 相似问题识别（BERT，两段式）
- 提交阶段: 相似问题提示，不阻断。
- Review 阶段: 强提示并要求处理（合并/保留决策）。

8. 手机端查看自适应
- 无论直接展开还是 `modal`，都不要出现影响阅读体验的横向滚动条。
- 重点检查:
  - markdown 表格
  - 公式
  - 代码块
  - 图片 gallery
  - 标签 / 筛选条
  - 详情弹窗内容区

9. 平台接入范围（一期）
- 仅接入:
  - `self-hosted agent-runner`
  - `1个向量库`
- 其他平台先留接口，不在一期强接入。

## 下一阶段 TODO

1. 微信小程序支持
- 与现有后台共享数据库。
- 先评估当前 Vercel Postgres 免费额度是否有超额风险，再决定是否需要迁移或分层。

## 备注

- 当前项目已切换到收藏页内展开/弹窗模式（尽量避免依赖详情页跳转）
- 最近已完成 FAQ 图片 gallery/lightbox 改造与交互性能修复（含 INP 优化）。
- 讨论与执行视图见 `todo.md`。
