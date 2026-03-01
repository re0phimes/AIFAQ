# 个人功能模块设计文档

**日期：** 2026-03-01
**状态：** 已批准
**实施方式：** 渐进式（Phase 1 → Phase 2）

---

## 概述

为 AIFAQ 增加个人功能模块，包括学习进度追踪、个人主页、关注标签和设置页面。采用渐进式实现策略，优先验证核心价值。

---

## 需求总结

### Phase 1：核心功能
1. **学习进度追踪**：三状态流转（未看 → 学习中 → 已内化）
2. **个人主页**：极简版（收藏列表按状态分组 + 基本统计）
3. **独立详情页**：`/faq/[id]` 路由，自动状态追踪
4. **90天提醒**：超过90天未读的收藏显示删除建议

### Phase 2：扩展功能
1. **关注标签**：快速筛选 + 个性化首页排序
2. **设置页面**：整合现有分散的显示偏好设置

---

## 架构设计

### 数据库扩展

**扩展 `user_favorites` 表：**

```sql
ALTER TABLE user_favorites ADD COLUMN learning_status VARCHAR(20) DEFAULT 'unread';
ALTER TABLE user_favorites ADD COLUMN last_viewed_at TIMESTAMPTZ;
ALTER TABLE user_favorites ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
```

**状态枚举：**
- `unread`（未看）：收藏时的默认状态
- `learning`（学习中）：从个人页面点击查看详情时自动触发
- `mastered`（已内化）：用户手动标记

### 路由结构

**Phase 1 新增路由：**
```
/profile              # 个人主页
/faq/[id]             # FAQ 详情页（新增）
/api/user/favorites   # 获取收藏列表 + 统计
/api/favorites/[id]/status  # 更新学习状态
/api/favorites/batch  # 批量删除收藏
```

---

## 页面设计

### `/profile` 个人主页

**布局结构：**

```
┌─────────────────────────────────────────┐
│ 统计卡片区域                              │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│ │ 总收藏   │ │ 学习中   │ │ 已内化   │    │
│ │   42    │ │   15    │ │   8     │    │
│ └─────────┘ └─────────┘ └─────────┘    │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ ⚠️ 90天提醒横幅（条件显示）               │
│ 你有 3 个收藏超过90天未查看，建议删除     │
│                              [查看] [忽略]│
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 📚 未看 (19)                    [全部展开]│
├─────────────────────────────────────────┤
│ • Transformer 的注意力机制是什么？        │
│ • BERT 和 GPT 的区别                     │
│ ...                                      │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 📖 学习中 (15)                  [全部展开]│
├─────────────────────────────────────────┤
│ • 什么是梯度消失？          [标记为已内化] │
│ • Adam 优化器的原理                      │
│ ...                                      │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ ✅ 已内化 (8)                   [全部展开]│
├─────────────────────────────────────────┤
│ • 反向传播算法详解          [取消标记]    │
│ • 卷积神经网络基础                       │
│ ...                                      │
└─────────────────────────────────────────┘
```

**核心组件：**
1. `ProfilePage` (`app/profile/page.tsx`) - 服务端渲染，获取收藏数据
2. `FavoritesList` (`components/FavoritesList.tsx`) - 分组展示收藏列表
3. `StaleReminder` (`components/StaleReminder.tsx`) - 90天提醒横幅

### `/faq/[id]` 详情页

**功能增强：**
- 检测用户是否已收藏该 FAQ
- 如果已收藏且状态为 `unread`，自动更新为 `learning`
- 显示"标记为已内化"按钮（仅对已收藏的项目）
- 完整的阅读体验，支持分享链接

---

## 数据流设计

### API 端点

**1. 获取用户收藏列表：**
```typescript
GET /api/user/favorites

Response: {
  favorites: Array<{
    faq_id: number
    learning_status: 'unread' | 'learning' | 'mastered'
    created_at: string
    last_viewed_at: string | null
    faq: FAQItem  // 关联的 FAQ 数据
  }>
  stats: {
    total: number
    unread: number
    learning: number
    mastered: number
    stale: number  // 超过90天未读的数量
  }
}
```

**2. 更新学习状态：**
```typescript
PATCH /api/favorites/[id]/status
Body: { status: 'learning' | 'mastered' }
Response: { success: boolean }
```

**3. 批量删除收藏：**
```typescript
DELETE /api/favorites/batch
Body: { ids: number[] }
Response: { deleted: number }
```

### 交互流程

**1. 个人页面加载：**
```
用户访问 /profile
  ↓
服务端获取 session
  ↓
查询 user_favorites + 关联 faq_items
  ↓
计算统计数据（分组计数、90天提醒）
  ↓
渲染页面
```

**2. 自动状态更新：**
```
用户在 /profile 点击收藏项
  ↓
跳转到 /faq/[id]
  ↓
详情页检测：用户已登录 && 已收藏 && status='unread'
  ↓
自动调用 PATCH /api/favorites/[id]/status
  ↓
更新 learning_status='learning', last_viewed_at=NOW()
  ↓
（用户返回 /profile 时看到状态已更新）
```

**3. 手动标记已内化：**
```
用户在详情页或个人页面点击"标记为已内化"
  ↓
调用 PATCH /api/favorites/[id]/status
Body: { status: 'mastered' }
  ↓
更新 learning_status='mastered'
  ↓
乐观更新 UI（立即移动到"已内化"分组）
```

---

## 错误处理

### 错误处理策略

**1. 未登录用户访问个人页面：**
- 重定向到首页
- 显示提示："请先登录以查看个人页面"

**2. API 调用失败：**
- 使用乐观更新 + 失败回滚策略
- 显示 toast 提示用户操作失败
- 自动重试（最多 2 次）

**3. 数据库查询失败：**
- 捕获异常，返回空数组而不是崩溃
- 记录错误日志（用于后续排查）
- 显示友好的错误提示

### 边界情况处理

**1. 收藏的 FAQ 被删除：**
- 在查询时使用 LEFT JOIN，过滤掉 `faq_items` 为 null 的记录
- 或者在数据库层面设置 `ON DELETE CASCADE`

**2. 90天提醒的时区问题：**
- 统一使用 UTC 时间存储
- 前端显示时转换为用户本地时区

**3. 并发更新冲突：**
- 使用数据库的 `updated_at` 字段做乐观锁
- 如果检测到冲突，提示用户刷新页面

**4. 空状态处理：**
- 没有收藏时显示引导文案："开始收藏你感兴趣的 FAQ 吧！"
- 没有90天提醒时不显示横幅

---

## Phase 2 预览

**Phase 2 将实现：**

### 1. 关注标签功能

**数据库：**
```sql
CREATE TABLE user_followed_tags (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tag)
);
```

**功能：**
- 主页增加"关注标签"筛选按钮（类似现有的"我的收藏"按钮）
- 登录后首页优先展示关注标签的内容（排序权重）
- 个人页面显示关注的标签列表

### 2. 设置页面

**数据库：**
```sql
CREATE TABLE user_preferences (
  user_id TEXT PRIMARY KEY,
  preferences JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**功能：**
- 路由：`/settings`
- 整合现有的分散设置：
  - 默认语言（zh/en）
  - 每页显示数量（10/20/50）
  - 默认排序方式（default/date/difficulty）
  - 默认视图模式（brief/detailed）

---

## 技术栈

- **框架：** Next.js 14 App Router（服务端渲染）
- **数据库：** PostgreSQL（Vercel Postgres）
- **认证：** NextAuth.js（已有）
- **语言：** TypeScript
- **样式：** Tailwind CSS（已有）

---

## 实施计划

### Phase 1 优先级

1. **数据库迁移**（高优先级）
2. **API 端点实现**（高优先级）
3. **个人页面 UI**（高优先级）
4. **详情页增强**（中优先级）
5. **90天提醒功能**（低优先级，可后续迭代）

### Phase 2 时间线

- Phase 1 完成并验证后启动
- 根据用户反馈调整功能优先级

---

## 成功指标

**Phase 1：**
- 用户能够查看和管理收藏列表
- 学习状态自动追踪正常工作
- 90天提醒功能有效提示用户

**Phase 2：**
- 用户能够关注标签并快速筛选
- 设置页面整合所有偏好设置
- 个性化首页提升用户体验

---

## 风险与缓解

**风险 1：数据库迁移失败**
- 缓解：在测试环境先验证迁移脚本
- 备份现有数据

**风险 2：性能问题（大量收藏）**
- 缓解：添加分页功能
- 优化数据库查询（添加索引）

**风险 3：用户不理解学习状态**
- 缓解：添加引导提示和帮助文档
- 使用清晰的图标和文案
