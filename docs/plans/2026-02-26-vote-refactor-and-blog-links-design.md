# 投票系统重构 + 博客外链自动匹配 设计文档

日期: 2026-02-26

## 概述

两个独立改动：
1. 投票系统从三按钮独立模式改为 up/down 互斥模式，支持显示计数和 toggle 取消
2. FAQ 中 blog 类型的 reference 自动匹配博客 URL

---

## Part 1: 投票系统重构

### 数据模型变更

- `VoteType`: `"upvote" | "downvote"` (移除 `outdated`、`inaccurate`)
- `faq_items` 表: 只保留 `upvote_count`、`downvote_count` (移除 `outdated_count`、`inaccurate_count`)
- `faq_votes` UNIQUE 约束: `UNIQUE(faq_id, fingerprint)` (每用户每 FAQ 只能一票)
- downvote 保留 `reason` (过时/不准确/表述不清/其他) 和可选 `detail`

### 后端 API

#### POST /api/faq/{id}/vote — 投票
- Body: `{ type: "upvote" | "downvote", fingerprint, reason?, detail? }`
- 逻辑: 如果已有不同类型投票，先撤销旧的再投新的 (事务内完成)
- 返回: `{ success: true, upvoteCount, downvoteCount }`

#### DELETE /api/faq/{id}/vote — 取消投票
- Body: `{ fingerprint }`
- 逻辑: 删除记录，对应 count -1 (GREATEST(count-1, 0))
- 返回: `{ success: true, upvoteCount, downvoteCount }`

#### GET /api/faq/votes?fingerprint=xxx — 批量查询用户投票状态
- 返回: `{ [faqId]: "upvote" | "downvote" }`
- 用于页面加载时恢复按钮状态

### 后端 db.ts 新增函数

- `revokeVote(faqId, fingerprint)`: 删除投票记录 + count -1
- `switchVote(faqId, fingerprint, newType, reason?, detail?)`: 事务内切换投票
- `getVotesByFingerprint(fingerprint)`: 批量查询

### 前端改动

#### FAQItem.tsx — VoteButton
- 两个按钮: 👍 (upvote) 和 👎 (downvote)，互斥 toggle
- 按钮旁显示计数 (如 "👍 12")
- 已投票状态: 按钮高亮/填充色
- 再次点击同一按钮: 取消投票
- 点击另一个按钮: 切换投票

#### FAQItem.tsx — DownvotePanel (原 InaccuratePanel)
- 点 👎 时弹出理由选择面板
- 选项: 过时 / 不准确 / 表述不清 / 其他
- 可选补充说明文本框

#### FAQList.tsx
- 页面加载时 fingerprint 就绪后调用 GET /api/faq/votes 恢复状态
- handleVote 改为 toggle + 切换逻辑
- 乐观更新本地计数和状态

#### 待更新标签
- 当 `downvoteCount >= 3` 时显示"待更新"警告标签

### 数据迁移

- 现有 `outdated` 和 `inaccurate` 投票合并为 `downvote`
- `outdated_count + inaccurate_count` 合并为 `downvote_count`
- 迁移脚本处理 faq_votes 表的 vote_type 字段和 UNIQUE 约束变更

### 并发安全

- PostgreSQL 行级锁保证 count 原子更新
- UNIQUE 约束防止重复投票
- 前端乐观更新不影响其他用户

---

## Part 2: 博客外链自动匹配

### 数据文件

新增 `data/blog-index.json`:
```json
[
  { "title": "文章标题", "url": "https://blog.phimes.top/posts/..." },
  ...
]
```
包含 blog.phimes.top 上的 22 篇文章。

### parse-faq.ts 改动

- 加载 `data/blog-index.json`
- `parseReferences` 中，对 `type: "blog"` 的 reference:
  - 去掉 `.md` 后缀
  - 归一化标题 (去除标点、空格)
  - 与 blog-index 中的 title 做子串匹配
  - 匹配成功则填充 `url` 字段

### ReferenceList.tsx 改动

- 渲染逻辑: 只要有 `url` 就渲染为可点击链接 (不限 type)
- blog 类型有 url 时显示为超链接，图标保持 📖

### 维护方式

- 博客新增文章时，手动更新 `data/blog-index.json`
- 运行 `npm run prebuild` 重新解析即可
