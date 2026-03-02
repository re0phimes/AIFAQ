# GitHub OAuth 认证 + 投票权重 + 收藏功能设计

日期: 2026-02-28

## 问题

1. 现有 admin 登录存在严重安全漏洞（明文密码、无 middleware、无限流等）
2. 需要 GitHub OAuth 认证支持普通用户和 admin
3. 登录用户投票权重更高，需要微妙的前端体现
4. 用户需要收藏功能

## 方案: NextAuth.js v5 + GitHub Provider

### 1. 认证架构

- NextAuth.js v5 (Auth.js) + GitHub OAuth Provider
- Session 包含: user.id (GitHub ID), user.name, user.image, user.role ("admin" | "user")
- Admin 判断: 环境变量 `ADMIN_GITHUB_IDS` 硬编码 GitHub ID 列表
- JWT 模式 (无需 session 数据库表)

**替换现有登录:**
- 删除 `/api/auth/login`, `/api/auth/logout` 路由
- 删除 `lib/auth.ts` 中密码验证逻辑
- NextAuth 自动提供 `/api/auth/signin`, `/api/auth/signout`

**Middleware 保护:**
- 新建 `middleware.ts`, 用 NextAuth `auth()` 函数
- `/admin/**`: 要求 role === "admin", 否则 redirect
- `/api/admin/**`: 同上, 返回 401
- `/api/seed`: 纳入 admin 保护

**环境变量:**
- 删除: `ADMIN_PASSWORD`, `ADMIN_SECRET`
- 新增: `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AUTH_SECRET`, `ADMIN_GITHUB_IDS`

### 2. 投票权重 + 微妙标记

**后端:**
- `faq_votes` 表新增 `weight` 列 (INTEGER DEFAULT 1)
- `faq_votes` 表新增 `user_id` 列 (TEXT NULLABLE, GitHub user ID)
- 登录用户投票: weight=5, user_id=github_id
- 未登录用户: weight=1, user_id=NULL, fingerprint=xxx
- 同一 GitHub 账号对同一 FAQ 只能投一次 (UNIQUE on user_id + faq_id WHERE user_id IS NOT NULL)

**前端:**
- 投票按钮旁显示票数 (不显示加权分)
- 排序/统计用加权分 (SUM(weight))
- 登录用户的投票旁加小盾牌/✓ 图标, tooltip "已认证用户投票"
- 不显示具体权重数字

### 3. 收藏功能

**数据库:**
- 新建 `user_favorites` 表: user_id + faq_id + created_at
- UNIQUE 约束 (user_id, faq_id)

**API:**
- `POST /api/faq/[id]/favorite` — toggle 收藏/取消
- `GET /api/user/favorites` — 获取当前用户收藏列表

**前端:**
- FAQItem 加星标按钮 (仅登录用户可见)
- 新增"我的收藏"筛选标签

### 4. 安全修复

1. 删除旧密码登录系统
2. 新建 middleware.ts 保护 admin 路由
3. 保护 /api/seed
4. 轮换 .env.local 中所有凭据 (如果在 git 历史中)
5. NextAuth 内置 CSRF 保护

### 5. 影响范围

**新建文件:**
- `auth.ts` (项目根目录, NextAuth 配置)
- `middleware.ts` (项目根目录)
- `app/api/auth/[...nextauth]/route.ts`
- `app/api/faq/[id]/favorite/route.ts`
- `app/api/user/favorites/route.ts`

**修改文件:**
- `lib/db.ts` — 新增 user_favorites 表, faq_votes 表加列
- `lib/auth.ts` — 重写为 NextAuth 辅助函数
- `app/api/faq/[id]/vote/route.ts` — 支持登录用户权重
- `app/api/seed/route.ts` — 加 admin 保护
- `components/FAQItem.tsx` — 加收藏按钮, 投票标记
- `app/admin/layout.tsx` — 改用 NextAuth session 检查
- `app/FAQPage.tsx` — 加登录按钮/用户头像
- `package.json` — 添加 next-auth 依赖

**删除文件:**
- `app/api/auth/login/route.ts`
- `app/api/auth/logout/route.ts`
