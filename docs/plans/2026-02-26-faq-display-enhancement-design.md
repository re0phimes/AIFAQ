# FAQ 显示增强设计

日期: 2026-02-26

## 概述

对 AIFAQ 前端显示进行四项增强：分页、标签层级体系、投票系统、比较模式改造。

## 技术背景

- Next.js App Router + React 19 + Tailwind CSS v4
- Vercel Postgres 数据库
- 当前 81 条 FAQ（静态 JSON + 数据库动态数据合并）
- 前端一次性加载所有数据，纯客户端过滤

---

## 1. 分页系统

**方案:** 前端分页（数据仍一次性加载，前端切片显示）

### 改造点

- `FAQList` 新增状态: `currentPage`、`pageSize`（默认 20）
- 过滤后的 FAQ 列表按 `pageSize` 切片显示当前页
- 底部新增 `Pagination` 组件:
  - 左侧: 每页条数选择器（10 / 20 / 50）
  - 右侧: 页码导航（上一页 / 页码 / 下一页），超过 7 页时用省略号
- 切换筛选条件或搜索时自动重置到第 1 页
- `pageSize` 持久化到 localStorage
- 翻页后自动滚动到列表顶部
- 显示 "共 X 条结果，第 Y/Z 页"

---

## 2. 标签层级体系

**方案:** 配置文件定义大标签 + AI 自动归类小标签

### 大标签体系（实用 FAQ 体系，约 12 个）

| 编号 | 分类名称 | 覆盖范围 |
|------|---------|---------|
| 1 | AI 基础概念 | AI 定义、智能体、发展史 |
| 2 | 机器学习基础 | 监督/无监督学习、过拟合、评估指标、特征工程 |
| 3 | 深度学习 | 神经网络、CNN、RNN、Transformer、训练技巧 |
| 4 | 自然语言处理 | 文本分类、机器翻译、情感分析、问答系统 |
| 5 | 计算机视觉 | 图像分类、目标检测、图像分割 |
| 6 | 生成式 AI / LLM | GPT、Prompt Engineering、RAG、微调、Agent |
| 7 | 强化学习 | Q-learning、策略梯度、多智能体 RL |
| 8 | 推荐系统与搜索 | 协同过滤、内容推荐、向量检索 |
| 9 | 数据工程与 MLOps | 数据清洗、特征存储、模型部署、监控 |
| 10 | AI 伦理与安全 | 公平性、可解释性、隐私保护、对齐 |
| 11 | AI 应用场景 | 医疗AI、自动驾驶、金融风控等垂直领域 |
| 12 | 工具与框架 | PyTorch、TensorFlow、HuggingFace、LangChain |

### 数据结构

- 新建 `data/tag-taxonomy.json`，定义大标签及其下属小标签映射
- `faq_items` 表新增 `categories TEXT[] DEFAULT '{}'` 字段

### AI 归类

- 修改 AI 分析 prompt，让 AI 从预定义大标签列表中选择 1-2 个
- AI 返回结果新增 `categories` 字段
- 对已有静态数据跑一次批量归类脚本

### 前端展示

- `TagFilter` 改造为两级:
  - 第一级: 大标签横向排列，可多选
  - 第二级: 选中大标签后展开其下小标签
- 可以只选大标签（匹配该分类下所有 FAQ），也可进一步选小标签
- 筛选逻辑: 大标签之间 OR，大标签内小标签之间 OR

---

## 3. 投票系统

**方案:** 后端持久化 + fingerprint 防刷

### 数据库

新建 `faq_votes` 表:

```sql
CREATE TABLE faq_votes (
  id SERIAL PRIMARY KEY,
  faq_id INTEGER NOT NULL,
  vote_type VARCHAR(20) NOT NULL,  -- 'upvote' | 'outdated' | 'inaccurate'
  fingerprint VARCHAR(64) NOT NULL,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(faq_id, vote_type, fingerprint)
);
```

`faq_items` 表新增聚合字段: `upvote_count`、`outdated_count`、`inaccurate_count`（默认 0）。

### API

- `POST /api/faq/[id]/vote` -- 提交投票（body: `{ type, fingerprint }`），重复投票返回 409
- `GET /api/faq/votes?ids=1,2,3` -- 批量获取投票计数

### 前端

- 使用 `@fingerprintjs/fingerprintjs` 开源版生成浏览器指纹
- 每个 FAQItem 底部三个投票按钮: 点赞、过期、不准确
- 已投票按钮高亮（状态存 localStorage）
- outdated + inaccurate 超阈值时显示"时效性警告"

### 静态 FAQ 处理

静态 FAQ 使用偏移 id（+10000）关联投票，与现有逻辑一致。

---

## 4. 比较模式 & 展开/折叠

### 比较模式改造

- 默认隐藏所有 checkbox 和选择侧边栏
- 搜索栏旁新增"比较"按钮，点击后:
  - 显示 checkbox + 选择侧边栏
  - 按钮变为"退出比较"
- 退出时清空选中状态

### 展开/折叠控制

- 列表顶部新增"全部展开"/"全部折叠"按钮
- 默认页面和比较阅读视图都有
- `FAQList` 维护 `expandedIds: Set<number>` 状态
  - 全部展开: 当前页所有 FAQ id 加入 set
  - 全部折叠: 清空 set
  - 单个点击: toggle 该 id

---

## 依赖新增

- `@fingerprintjs/fingerprintjs` -- 浏览器指纹生成（投票防刷）

## 数据库迁移

1. `faq_items` 表新增: `categories`、`upvote_count`、`outdated_count`、`inaccurate_count`
2. 新建 `faq_votes` 表

## 文件影响范围

- `src/components/FAQList.tsx` -- 分页、比较模式、展开/折叠
- `src/components/TagFilter.tsx` -- 两级标签
- `src/components/FAQItem.tsx` -- 投票按钮
- `src/components/Pagination.tsx` -- 新建，分页组件
- `src/components/ReadingView.tsx` -- 展开/折叠按钮
- `data/tag-taxonomy.json` -- 新建，大标签体系
- `lib/db.ts` -- 数据库迁移、投票查询
- `app/api/faq/[id]/vote/route.ts` -- 新建，投票 API
- `app/api/faq/votes/route.ts` -- 新建，批量查询投票
- `lib/ai-analyze.ts` -- 修改 prompt，增加大标签归类
- `scripts/categorize-existing.ts` -- 新建，批量归类脚本
- `src/types/faq.ts` -- 类型更新
