# AIFAQ Project Notes

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

## 当前重点 TODO

1. 收藏日期提示与“尽快内化”提醒
- 需求：在收藏卡片显示时间信息，例如“14 天前收藏/学习”
- 触发规则建议：
  - 若收藏后 14 天未查看（或仍处于 `unread`），显示提醒标签
  - 标签文案建议：`已 2 周未回顾，建议尽快内化`
- 数据字段可用：
  - `created_at`（收藏时间）
  - `last_viewed_at`（最近查看时间）
  - `learning_status`（未读/学习中/已内化）
- 实现建议：
  - 新增相对时间格式函数（天/周）
  - 在 `FavoriteCard` 中展示时间与提醒标签
  - 在 `ProfileClient` 中统一计算触发条件，避免重复逻辑

2. 样式与字体占比优化（当前偏大）
- 问题：部分页面标题和组件字号过大，信息密度偏低
- 目标：保证层级清晰，同时提升阅读效率和首屏内容承载
- 调整建议：
  - 降低主标题级别（如 `text-3xl -> text-2xl`）
  - 卡片标题与正文分别下调一级
  - 统一移动端与桌面端字阶与行高比例
  - 保留关键按钮可点击面积，不牺牲可用性
- 优先页面：
  - `app/profile/ProfileClient.tsx`
  - `components/FavoriteCard.tsx`
  - `components/FAQItem.tsx`

## 备注

- 当前项目已切换到收藏页内展开/弹窗模式（尽量避免依赖详情页跳转）
- 上述 TODO 可作为下一轮 UI/学习流程优化的主任务
