# Admin 页面重设计

日期: 2026-02-28

## 目标

将现有单页 admin 拆分为独立的提交和审批管理页面，审批页采用 Master-Detail 分栏布局，新增审批日期字段。

## 决策

- 路由方案：共享 admin layout + 独立子路由（方案 B）
- 审批列表：Master-Detail 分栏（左列表 35% / 右详情 65%）
- 数据模型：faq_items 表加 reviewed_at + reviewed_by 字段
- 认证：保持密码登录，不做 GitHub OAuth
- 统计栏：可点击切换筛选状态

## 路由结构

```
app/admin/
  layout.tsx          — 共享布局（导航栏 + auth 检查）
  page.tsx            — 重定向到 /admin/review
  login/page.tsx      — 保持不变
  submit/page.tsx     — 提交新 FAQ
  review/page.tsx     — 审批管理（Master-Detail）
```

## Admin Layout

- 顶部导航栏：logo/标题 + 导航链接（提交 / 审批管理）+ 登出按钮
- usePathname() 高亮当前页
- 客户端 auth 检查，未登录重定向 /admin/login

## 提交页 (/admin/submit)

- 问题输入框（单行）
- 原始答案 textarea（Markdown）
- 提交按钮 + 状态反馈
- 成功后可继续提交或跳转审批页

## 审批管理页 (/admin/review)

### 统计栏
横向排列状态计数（全部/待审/已发布/已拒绝/失败），点击切换筛选，当前选中高亮。

### 左侧列表面板 (~35%)
- 搜索框（按问题标题）
- 每行：状态圆点 + 问题标题（截断）+ 日期 + 标签数
- 选中行高亮

### 右侧详情面板 (~65%)
- 问题标题
- Tab 切换：原始答案 / AI 增强 / 英文 / 简要
- Markdown 渲染（复用 SyncMarkdownContent）
- 元数据：标签、分类、引用、图片
- 操作按钮：发布 / 拒绝 / 撤回 / 重试 AI

## Data Model 变更

```sql
ALTER TABLE faq_items ADD COLUMN reviewed_at TIMESTAMPTZ;
ALTER TABLE faq_items ADD COLUMN reviewed_by TEXT;
```

在 publish/reject/unpublish 操作时自动更新。migration 加到 initDB()。

## 不做的事情

- GitHub OAuth（下次）
- 实时刷新 / WebSocket
- 批量操作
- 审批历史表
- 状态管理库
- 键盘快捷键
