# 五项改进设计文档

日期: 2026-02-26

## 概述

五个独立改动：
1. 静态 FAQ 迁入数据库 + 投票计数显示
2. 标签合并（上下文管理 + 上下文长度 -> Context Engineering）
3. 返回顶部按钮
4. 排序功能（时间/难度，互斥）
5. Reference 展示格式（作者 + 标题，自己的博客红色高亮）

---

## Part 1: 静态 FAQ 迁入数据库

### 架构变更

- `faq_items` 表新增 `date VARCHAR(10)` 字段
- 新增 `scripts/seed-faq.ts`：读取 `data/faq.json`，将 81 条 FAQ 插入 `faq_items`
  - status 设为 `ready`
  - 幂等：按 question 去重，已存在则跳过
- `app/page.tsx` 改为只从数据库读取，移除静态 JSON 合并逻辑
- 投票 count 直接更新 `faq_items` 表字段

### 数据流变更

```
之前: AI-FAQ.md -> parse-faq.ts -> faq.json -> page.tsx (合并 DB)
之后: AI-FAQ.md -> parse-faq.ts -> faq.json -> seed-faq.ts -> DB -> page.tsx
```

---

## Part 2: 标签合并

- `AI-FAQ.md` 中 `#上下文管理` 和 `#上下文长度` 统一改为 `#Context Engineering`
- `data/tag-taxonomy.json` 移除旧标签，新增 `Context Engineering`
- 重新运行 parse-faq.ts + seed-faq.ts

---

## Part 3: 返回顶部按钮

- FAQList.tsx 新增固定定位按钮
- 位置: `fixed bottom-6 right-6`（移动端 `bottom-4 right-4`）
- 显示条件: `window.scrollY > window.innerHeight`
- 点击: `window.scrollTo({ top: 0, behavior: "smooth" })`
- 样式: 圆形，向上箭头图标，半透明背景，hover 加深
- 桌面端和移动端都显示

---

## Part 4: 排序功能

### 数据模型

- FAQItem 新增 `difficulty: "beginner" | "intermediate" | "advanced"`
- faq_items 表新增 `difficulty VARCHAR(20)` 列
- faq_items 表新增 `date VARCHAR(10)` 列（Part 1 已包含）

### 难度数据来源

- 新增 `scripts/analyze-difficulty.ts`
- 调用 AI API 批量分析每条 FAQ 的难度
- 写入数据库 difficulty 字段

### 前端排序

- 工具栏新增排序下拉选择（比较/展开/折叠按钮旁边）
- 三种模式互斥: 默认(ID) / 时间(最新在前) / 难度(入门->高级)
- 客户端排序（数据量小）

---

## Part 5: Reference 展示格式

### 数据模型

- Reference 类型新增 `author?: string` 和 `platform?: string`
- 你的博客: `author: "Phimes"`, 无 platform（默认博客）
- 外部来源（未来）: `author: "xxx"`, `platform: "zhihu"` 等

### parse-faq.ts

- "来源文章:" 解析时去掉 `.md` 后缀
- 设置 `author: "Phimes"`

### ReferenceList.tsx

- 有 author 时显示: `作者 · 标题`
- `author === "Phimes"` 时作者名用红色 (`text-red-500`) 高亮
- 有 platform 时显示: `作者 · 平台 · 标题`
