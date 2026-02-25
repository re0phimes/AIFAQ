# AIFAQ 管理后台 + AI 分析功能设计

日期: 2026-02-25

## 概述

为 AIFAQ 项目添加管理员登录、FAQ 提交、AI 自动分析功能。管理员通过后台提交问答对，AI 异步分析生成标签、参考文献并润色答案，处理完成后自动加入公开页面的卡片列表。

## 决策记录

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 认证方案 | 环境变量密码 + JWT cookie | 单用户场景，最简方案 |
| AI 提供商 | 通用 OpenAI 兼容接口 | 灵活，不绑定特定厂商 |
| 数据存储 | Vercel Postgres | Vercel 原生支持，免费层足够 |
| 数据迁移 | 混合模式 | 现有 81 条保持 Markdown，新增存 DB |
| 异步处理 | waitUntil() 后台处理 | 不阻塞响应，Vercel 原生支持 |
| 架构方案 | 最小改动路径 (ISR) | 对现有代码侵入最小 |

## 1. 认证

- 环境变量 `ADMIN_PASSWORD` 存储管理员密码
- `/admin/login` 页面: 密码输入表单
- 登录成功后设置 HTTP-only cookie (JWT, 用 `ADMIN_SECRET` 签名)
- API routes 通过验证 cookie 中的 JWT 鉴权
- 使用 `jose` 库处理 JWT

## 2. 管理后台 `/admin`

- 受保护路由，未登录重定向到 `/admin/login`
- 功能:
  - 表单: 粘贴问题 + 粘贴答案 → 提交
  - 列表: 显示所有后台提交的 FAQ，含状态 (pending/processing/ready/failed)
  - 查看 AI 分析结果、手动编辑后发布
  - 失败项支持重试

## 3. 数据模型

```sql
CREATE TABLE faq_items (
  id            SERIAL PRIMARY KEY,
  question      TEXT NOT NULL,
  answer_raw    TEXT NOT NULL,
  answer        TEXT,
  tags          TEXT[] DEFAULT '{}',
  references    JSONB DEFAULT '[]',
  status        VARCHAR(20) DEFAULT 'pending',
  error_message TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
```

## 4. 数据合并策略

公开首页合并两个数据源:
1. 静态: 构建时从 `AI-FAQ.md` 解析的 81 条 (保持现有 `parse-faq.ts` 逻辑)
2. 动态: 从 Postgres 查询 `status = 'ready'` 的记录

首页改为 ISR (`revalidate = 60`)，Server Component 中合并两个数据源后传给 `FAQList`。

## 5. AI 分析流程

```
管理员提交 Q&A
  → POST /api/admin/faq
  → 写入 DB (status: pending)
  → 返回 201
  → waitUntil() 启动后台任务
  → 调用 AI API (status → processing)
  → AI 返回结构化 JSON
  → 解析 tags, references, 润色 answer
  → 写入 DB (status: ready)
  → 下次 ISR 重新验证时出现在首页
```

AI 返回格式:
```json
{
  "tags": ["标签1", "标签2"],
  "references": [
    {"type": "paper", "title": "论文标题", "url": "https://arxiv.org/..."},
    {"type": "blog", "title": "文章标题", "url": "https://..."}
  ],
  "answer": "润色后的 Markdown 答案"
}
```

AI prompt 包含现有标签列表，确保标签一致性。

## 6. 错误处理

- AI 调用失败 → `status = 'failed'`，记录 `error_message`
- 管理后台显示失败原因，支持重试
- AI 返回格式不合法 → 标记失败

## 7. 安全

- AI API key 只在服务端使用，前端不可见
- API base URL 和 key 通过 Vercel 环境变量配置
- 前端 JS bundle 不包含任何 AI 相关配置
- JWT cookie 设置 HTTP-only, Secure, SameSite=Strict

## 8. API Routes

| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| POST | `/api/auth/login` | 验证密码，返回 JWT cookie | 无 |
| POST | `/api/auth/logout` | 清除 cookie | 无 |
| GET | `/api/admin/faq` | 获取管理员提交的 FAQ 列表 | 需要 |
| POST | `/api/admin/faq` | 提交新 FAQ | 需要 |
| PATCH | `/api/admin/faq/[id]` | 编辑 FAQ / 重试 | 需要 |

## 9. 环境变量

| 变量 | 说明 |
|------|------|
| `ADMIN_PASSWORD` | 管理员登录密码 |
| `ADMIN_SECRET` | JWT 签名密钥 |
| `POSTGRES_URL` | Vercel Postgres 连接串 (Vercel 自动注入) |
| `AI_API_BASE_URL` | OpenAI 兼容 API 的 base URL |
| `AI_API_KEY` | AI API key |
| `AI_MODEL` | 模型名称 |

## 10. Next.js 配置变更

- 移除 `output: 'export'`
- 首页改为 ISR: `export const revalidate = 60`
- 保留 `prebuild` 中的 `parse-faq.ts` (仍需生成静态 faq.json)

## 11. 新增依赖

- `jose` — JWT 处理
- `@vercel/postgres` — Vercel Postgres 客户端

## 12. 文件结构新增

```
app/
├── admin/
│   ├── login/page.tsx
│   └── page.tsx
├── api/
│   ├── auth/
│   │   ├── login/route.ts
│   │   └── logout/route.ts
│   └── admin/
│       └── faq/
│           ├── route.ts          -- GET + POST
│           └── [id]/route.ts     -- PATCH
lib/
├── auth.ts          -- JWT 工具函数
├── db.ts            -- 数据库查询封装
└── ai.ts            -- AI API 调用封装
```
