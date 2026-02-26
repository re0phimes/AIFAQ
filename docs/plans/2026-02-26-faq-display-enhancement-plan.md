# FAQ 显示增强实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 AIFAQ 添加前端分页、两级标签体系、投票系统、比较模式改造四项功能。

**Architecture:** 前端分页（客户端切片），配置文件定义大标签 + AI 自动归类，后端持久化投票 + fingerprint 防刷，比较模式按钮触发 + 全局展开/折叠控制。

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4, Vercel Postgres, @fingerprintjs/fingerprintjs

---

## Task 1: 类型定义扩展

**Files:**
- Modify: `src/types/faq.ts`

**Step 1: 扩展 FAQItem 类型**

在 `src/types/faq.ts` 中添加 `categories` 字段和投票计数:

```ts
export interface FAQItem {
  id: number;
  question: string;
  date: string;
  tags: string[];
  categories: string[];       // 新增: 大标签分类
  references: Reference[];
  answer: string;
  upvoteCount: number;        // 新增: 点赞数
  outdatedCount: number;      // 新增: 过期票数
  inaccurateCount: number;    // 新增: 不准确票数
}
```

**Step 2: 添加标签分类类型**

在同一文件末尾添加:

```ts
export interface TagCategory {
  name: string;
  description: string;
  tags: string[];
}

export interface TagTaxonomy {
  categories: TagCategory[];
}

export type VoteType = "upvote" | "outdated" | "inaccurate";
```

**Step 3: 更新所有引用 FAQItem 的地方**

`app/page.tsx` 中构造 FAQItem 时需要补充新字段默认值:

```ts
// 静态数据: categories 从 tag-taxonomy.json 映射, 投票计数默认 0
// 动态数据: categories 从 DB 读取, 投票计数从 DB 读取
```

**Step 4: Commit**

```bash
git add src/types/faq.ts
git commit -m "feat(types): add categories, vote counts, and tag taxonomy types"
```

---

## Task 2: 创建标签分类配置文件

**Files:**
- Create: `data/tag-taxonomy.json`

**Step 1: 创建分类配置**

```json
{
  "categories": [
    {
      "name": "AI 基础概念",
      "description": "AI 定义、智能体、发展史",
      "tags": []
    },
    {
      "name": "机器学习基础",
      "description": "监督/无监督学习、过拟合、评估指标、特征工程",
      "tags": []
    },
    {
      "name": "深度学习",
      "description": "神经网络、CNN、RNN、Transformer、训练技巧",
      "tags": []
    },
    {
      "name": "自然语言处理",
      "description": "文本分类、机器翻译、情感分析、问答系统",
      "tags": []
    },
    {
      "name": "计算机视觉",
      "description": "图像分类、目标检测、图像分割",
      "tags": []
    },
    {
      "name": "生成式 AI / LLM",
      "description": "GPT、Prompt Engineering、RAG、微调、Agent",
      "tags": []
    },
    {
      "name": "强化学习",
      "description": "Q-learning、策略梯度、多智能体 RL",
      "tags": []
    },
    {
      "name": "推荐系统与搜索",
      "description": "协同过滤、内容推荐、向量检索",
      "tags": []
    },
    {
      "name": "数据工程与 MLOps",
      "description": "数据清洗、特征存储、模型部署、监控",
      "tags": []
    },
    {
      "name": "AI 伦理与安全",
      "description": "公平性、可解释性、隐私保护、对齐",
      "tags": []
    },
    {
      "name": "AI 应用场景",
      "description": "医疗AI、自动驾驶、金融风控等垂直领域",
      "tags": []
    },
    {
      "name": "工具与框架",
      "description": "PyTorch、TensorFlow、HuggingFace、LangChain",
      "tags": []
    }
  ]
}
```

注意: `tags` 数组初始为空，将由 Task 3 的批量归类脚本填充。

**Step 2: Commit**

```bash
git add data/tag-taxonomy.json
git commit -m "feat(data): add tag taxonomy configuration with 12 categories"
```

---

## Task 3: 批量归类脚本 -- 用 AI 将现有标签归类到大标签

**Files:**
- Create: `scripts/categorize-tags.ts`
- Modify: `data/tag-taxonomy.json` (脚本输出)

**Step 1: 编写归类脚本**

```ts
// scripts/categorize-tags.ts
// 读取 data/faq.json 提取所有唯一标签
// 读取 data/tag-taxonomy.json 获取大标签列表
// 调用 AI API 将每个小标签归类到 1-2 个大标签下
// 更新 tag-taxonomy.json 的 tags 数组
// 同时为每条 FAQ 生成 categories 字段，输出到 data/faq.json
```

脚本逻辑:
1. 从 `data/faq.json` 收集所有唯一标签
2. 将标签列表 + 大标签列表发给 AI，让 AI 返回映射关系
3. 更新 `data/tag-taxonomy.json` 中每个 category 的 `tags` 数组
4. 遍历 `data/faq.json`，根据每条 FAQ 的 tags 查找对应的 categories，写入 `categories` 字段
5. 写回 `data/faq.json`

**Step 2: 运行脚本**

```bash
npx tsx scripts/categorize-tags.ts
```

Expected: `data/tag-taxonomy.json` 的每个 category 下有对应的小标签，`data/faq.json` 每条记录有 `categories` 字段。

**Step 3: 验证输出**

手动检查几条 FAQ 的分类是否合理。

**Step 4: Commit**

```bash
git add scripts/categorize-tags.ts data/tag-taxonomy.json data/faq.json
git commit -m "feat(scripts): add tag categorization script and populate taxonomy"
```

---

## Task 4: 数据库迁移 -- 添加 categories 和投票相关字段/表

**Files:**
- Modify: `lib/db.ts`

**Step 1: 修改 initDB 添加新字段和新表**

在 `lib/db.ts` 的 `initDB()` 中追加:

```ts
// 在现有 CREATE TABLE faq_items 之后添加:

// 添加 categories 列 (如果不存在)
await sql`
  ALTER TABLE faq_items
  ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT '{}'
`;

// 添加投票聚合列
await sql`
  ALTER TABLE faq_items
  ADD COLUMN IF NOT EXISTS upvote_count INTEGER DEFAULT 0
`;
await sql`
  ALTER TABLE faq_items
  ADD COLUMN IF NOT EXISTS outdated_count INTEGER DEFAULT 0
`;
await sql`
  ALTER TABLE faq_items
  ADD COLUMN IF NOT EXISTS inaccurate_count INTEGER DEFAULT 0
`;

// 创建投票表
await sql`
  CREATE TABLE IF NOT EXISTS faq_votes (
    id          SERIAL PRIMARY KEY,
    faq_id      INTEGER NOT NULL,
    vote_type   VARCHAR(20) NOT NULL,
    fingerprint VARCHAR(64) NOT NULL,
    ip_address  VARCHAR(45),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(faq_id, vote_type, fingerprint)
  )
`;
```

**Step 2: 更新 DBFaqItem 接口**

```ts
export interface DBFaqItem {
  // ... 现有字段 ...
  categories: string[];        // 新增
  upvote_count: number;        // 新增
  outdated_count: number;      // 新增
  inaccurate_count: number;    // 新增
}
```

**Step 3: 更新 rowToFaqItem**

```ts
function rowToFaqItem(row: Record<string, unknown>): DBFaqItem {
  return {
    // ... 现有字段 ...
    categories: (row.categories as string[]) ?? [],
    upvote_count: (row.upvote_count as number) ?? 0,
    outdated_count: (row.outdated_count as number) ?? 0,
    inaccurate_count: (row.inaccurate_count as number) ?? 0,
  };
}
```

**Step 4: 更新 updateFaqStatus 支持 categories**

在 `data` 参数中添加 `categories?: string[]`，UPDATE 语句中添加 `categories` 字段。

**Step 5: 添加投票相关数据库函数**

```ts
export async function castVote(
  faqId: number,
  voteType: string,
  fingerprint: string,
  ipAddress: string | null
): Promise<boolean> {
  // INSERT INTO faq_votes ... ON CONFLICT DO NOTHING
  // 如果插入成功，更新 faq_items 的对应计数 +1
  // 返回 true 表示投票成功，false 表示重复投票
}

export async function getVoteCounts(
  faqIds: number[]
): Promise<Map<number, { upvote: number; outdated: number; inaccurate: number }>> {
  // SELECT faq_id, vote_type, COUNT(*) FROM faq_votes
  // WHERE faq_id = ANY($1) GROUP BY faq_id, vote_type
}
```

**Step 6: Commit**

```bash
git add lib/db.ts
git commit -m "feat(db): add categories, vote counts columns and faq_votes table"
```

---

## Task 5: 投票 API 路由

**Files:**
- Create: `app/api/faq/[id]/vote/route.ts`

**Step 1: 创建投票 API**

```ts
// POST /api/faq/[id]/vote
// Body: { type: "upvote" | "outdated" | "inaccurate", fingerprint: string }
// 验证 type 和 fingerprint 参数
// 调用 castVote()
// 成功返回 200，重复投票返回 409
```

注意:
- 不需要 JWT 认证（匿名投票）
- 从 request headers 获取 IP 地址 (`x-forwarded-for` 或 `x-real-ip`)
- faq_id 对于静态 FAQ 不在数据库中，投票表的 faq_id 不加外键约束（已在 Task 4 中处理）

**Step 2: Commit**

```bash
git add app/api/faq/[id]/vote/route.ts
git commit -m "feat(api): add anonymous vote endpoint with fingerprint dedup"
```

---

## Task 6: 修改 AI 分析 prompt 支持大标签归类

**Files:**
- Modify: `lib/ai.ts`

**Step 1: 更新 AIAnalysisResult 接口**

```ts
interface AIAnalysisResult {
  tags: string[];
  categories: string[];  // 新增
  references: Reference[];
  answer: string;
}
```

**Step 2: 修改 system prompt**

在现有 prompt 的要求列表中添加:

```
4. categories: 从以下大标签列表中选择 1-2 个最匹配的分类: [AI 基础概念, 机器学习基础, 深度学习, 自然语言处理, 计算机视觉, 生成式 AI / LLM, 强化学习, 推荐系统与搜索, 数据工程与 MLOps, AI 伦理与安全, AI 应用场景, 工具与框架]
```

从 `data/tag-taxonomy.json` 动态读取大标签列表（import JSON）。

**Step 3: 更新验证逻辑**

```ts
if (!Array.isArray(parsed.categories)) {
  parsed.categories = []; // 容错
}
```

**Step 4: 更新 admin FAQ 创建流程**

在 `app/api/admin/faq/route.ts` 的 POST handler 中，AI 分析完成后调用 `updateFaqStatus` 时传入 `categories`。

**Step 5: Commit**

```bash
git add lib/ai.ts app/api/admin/faq/route.ts
git commit -m "feat(ai): add category classification to AI analysis prompt"
```

---

## Task 7: 更新首页数据加载 -- 传递 categories 和投票计数

**Files:**
- Modify: `app/page.tsx`

**Step 1: 静态数据补充 categories**

```ts
import taxonomy from "@/data/tag-taxonomy.json";
import type { TagTaxonomy } from "@/src/types/faq";

// 构建 tag -> categories 映射
const tagToCategories = new Map<string, string[]>();
for (const cat of (taxonomy as TagTaxonomy).categories) {
  for (const tag of cat.tags) {
    const existing = tagToCategories.get(tag) ?? [];
    existing.push(cat.name);
    tagToCategories.set(tag, existing);
  }
}

const staticItems: FAQItem[] = (faqData as any[]).map((item) => ({
  ...item,
  categories: item.categories ?? [...new Set(
    item.tags.flatMap((t: string) => tagToCategories.get(t) ?? [])
  )],
  upvoteCount: 0,
  outdatedCount: 0,
  inaccurateCount: 0,
}));
```

**Step 2: 动态数据传递 categories 和投票计数**

```ts
dynamicItems = dbItems.map((item) => ({
  id: 10000 + item.id,
  question: item.question,
  date: item.created_at.toISOString().slice(0, 10),
  tags: item.tags,
  categories: item.categories,
  references: item.references,
  answer: item.answer ?? item.answer_raw,
  upvoteCount: item.upvote_count,
  outdatedCount: item.outdated_count,
  inaccurateCount: item.inaccurate_count,
}));
```

**Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat(page): pass categories and vote counts to FAQList"
```

---

## Task 8: Pagination 组件

**Files:**
- Create: `components/Pagination.tsx`

**Step 1: 创建分页组件**

```tsx
"use client";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const PAGE_SIZES = [10, 20, 50];

export default function Pagination({
  currentPage, totalPages, pageSize, totalItems,
  onPageChange, onPageSizeChange,
}: PaginationProps) {
  // 左侧: "共 X 条，第 Y/Z 页" + 每页条数选择器
  // 右侧: 上一页 / 页码按钮 / 下一页
  // 页码超过 7 页时用省略号 (1 ... 4 5 6 ... 10)
}
```

页码生成逻辑:
- 总页数 <= 7: 显示所有页码
- 总页数 > 7: 始终显示第1页和最后一页，当前页前后各1页，其余用 `...`

**Step 2: Commit**

```bash
git add components/Pagination.tsx
git commit -m "feat(ui): add Pagination component with page size selector"
```

---

## Task 9: TagFilter 改造为两级标签

**Files:**
- Modify: `components/TagFilter.tsx`

**Step 1: 更新 Props 接口**

```tsx
import type { TagTaxonomy } from "@/src/types/faq";

interface TagFilterProps {
  taxonomy: TagTaxonomy;           // 新增: 大标签分类体系
  allTags: string[];
  tagCounts: Map<string, number>;
  selectedCategories: string[];    // 新增: 选中的大标签
  selectedTags: string[];
  onToggleCategory: (cat: string) => void;  // 新增
  onToggleTag: (tag: string) => void;
  onClearAll: () => void;          // 改名: 清除所有筛选
}
```

**Step 2: 实现两级展示**

```tsx
// 第一级: 大标签横向排列
// 点击大标签: toggle selectedCategories
// 选中大标签后，下方展开该分类下的小标签
// 小标签只显示在已选大标签的分类下
// 未选任何大标签时，不显示小标签区域
```

布局:
- 上方: 大标签按钮行（带分类下的FAQ总数）
- 下方: 已选大标签对应的小标签（带各自计数）
- 右上角: "清除" 按钮（清除所有大标签和小标签选择）

**Step 3: Commit**

```bash
git add components/TagFilter.tsx
git commit -m "feat(ui): refactor TagFilter to two-level category/tag hierarchy"
```

---

## Task 10: FAQItem 添加投票按钮

**Files:**
- Modify: `components/FAQItem.tsx`

**Step 1: 更新 Props**

```tsx
interface FAQItemProps {
  item: FAQItemType;
  isOpen: boolean;
  isSelected: boolean;
  showCheckbox: boolean;           // 新增: 是否显示 checkbox
  onToggle: () => void;
  onSelect: () => void;
  onVote: (type: VoteType) => void;  // 新增: 投票回调
  votedTypes: Set<VoteType>;         // 新增: 已投票类型
}
```

**Step 2: 条件显示 checkbox**

```tsx
{showCheckbox && (
  <label className="..." onClick={(e) => e.stopPropagation()}>
    <input type="checkbox" ... />
  </label>
)}
```

**Step 3: 在答案区域底部添加投票按钮**

```tsx
// 在 ReferenceList 下方添加投票栏
<div className="mt-3 flex items-center gap-4 border-t border-gray-100 pt-3">
  <VoteButton type="upvote" count={item.upvoteCount}
    voted={votedTypes.has("upvote")} onClick={() => onVote("upvote")} />
  <VoteButton type="outdated" count={item.outdatedCount}
    voted={votedTypes.has("outdated")} onClick={() => onVote("outdated")} />
  <VoteButton type="inaccurate" count={item.inaccurateCount}
    voted={votedTypes.has("inaccurate")} onClick={() => onVote("inaccurate")} />
</div>
```

VoteButton 是一个内联的小组件:
- upvote: 竖起大拇指 SVG + 计数
- outdated: 时钟 SVG + "过期" + 计数
- inaccurate: 警告三角 SVG + "不准确" + 计数
- 已投票时按钮高亮（copper 色）

**Step 4: 时效性警告**

当 `outdatedCount + inaccurateCount >= 3` 时，在问题标题旁显示一个小的警告标记。

**Step 5: Commit**

```bash
git add components/FAQItem.tsx
git commit -m "feat(ui): add vote buttons and timeliness warning to FAQItem"
```

---

## Task 11: FAQList 核心改造 -- 分页、比较模式、展开/折叠

**Files:**
- Modify: `components/FAQList.tsx`

这是最大的改动，涉及多个状态的新增和渲染逻辑的调整。

**Step 1: 新增状态**

```tsx
// 分页
const [currentPage, setCurrentPage] = useState(1);
const [pageSize, setPageSize] = useState(() => {
  if (typeof window === "undefined") return 20;
  return Number(localStorage.getItem("aifaq-pagesize")) || 20;
});

// 比较模式
const [compareMode, setCompareMode] = useState(false);

// 大标签筛选
const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

// 投票状态 (localStorage)
const [votedMap, setVotedMap] = useState<Map<number, Set<VoteType>>>(() => {
  // 从 localStorage 加载
});

// fingerprint
const [fingerprint, setFingerprint] = useState<string>("");
```

**Step 2: 加载 fingerprint**

```tsx
useEffect(() => {
  import("@fingerprintjs/fingerprintjs").then((FingerprintJS) =>
    FingerprintJS.load().then((fp) =>
      fp.get().then((result) => setFingerprint(result.visitorId))
    )
  );
}, []);
```

**Step 3: 更新过滤逻辑**

在现有的 `filtered` useMemo 中，添加 categories 筛选:

```tsx
// 在 selectedTags 筛选之后添加:
if (selectedCategories.length > 0) {
  result = result.filter((item) =>
    selectedCategories.some((cat) => item.categories.includes(cat))
  );
}
```

**Step 4: 分页切片**

```tsx
const totalPages = Math.ceil(filtered.length / pageSize);
const paginatedItems = filtered.slice(
  (currentPage - 1) * pageSize,
  currentPage * pageSize
);
```

**Step 5: 搜索/筛选变化时重置页码**

```tsx
useEffect(() => {
  setCurrentPage(1);
}, [searchQuery, searchMode, selectedTags, selectedCategories]);
```

**Step 6: pageSize 持久化**

```tsx
useEffect(() => {
  localStorage.setItem("aifaq-pagesize", String(pageSize));
}, [pageSize]);
```

**Step 7: 翻页滚动到顶部**

```tsx
function handlePageChange(page: number): void {
  setCurrentPage(page);
  window.scrollTo({ top: 0, behavior: "smooth" });
}
```

**Step 8: 比较模式按钮**

在 SearchBar 下方添加工具栏:

```tsx
<div className="flex items-center justify-between">
  <div className="flex gap-2">
    <button onClick={() => setCompareMode(!compareMode)}>
      {compareMode ? "退出比较" : "比较"}
    </button>
    <button onClick={handleExpandAll}>全部展开</button>
    <button onClick={handleCollapseAll}>全部折叠</button>
  </div>
  <p className="text-sm text-slate-secondary">
    共 {filtered.length} 条，第 {currentPage}/{totalPages} 页
  </p>
</div>
```

**Step 9: 展开/折叠控制**

```tsx
function handleExpandAll(): void {
  setOpenItems(new Set(paginatedItems.map((item) => item.id)));
}
function handleCollapseAll(): void {
  setOpenItems(new Set());
}
```

**Step 10: 投票处理**

```tsx
async function handleVote(faqId: number, type: VoteType): Promise<void> {
  if (!fingerprint) return;
  const res = await fetch(`/api/faq/${faqId}/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, fingerprint }),
  });
  if (res.ok) {
    // 更新本地投票状态
    setVotedMap((prev) => {
      const next = new Map(prev);
      const types = new Set(next.get(faqId) ?? []);
      types.add(type);
      next.set(faqId, types);
      return next;
    });
    // 持久化到 localStorage
  }
}
```

**Step 11: 渲染调整**

- 用 `paginatedItems` 替代 `filtered` 渲染列表
- FAQItem 传入 `showCheckbox={compareMode}`
- 只在 `compareMode` 时渲染 SelectionSidebar
- 退出比较模式时清空 selectedItems
- 列表底部渲染 Pagination 组件

**Step 12: 传递 taxonomy 给 TagFilter**

```tsx
import taxonomy from "@/data/tag-taxonomy.json";

<TagFilter
  taxonomy={taxonomy as TagTaxonomy}
  allTags={allTags}
  tagCounts={tagCounts}
  selectedCategories={selectedCategories}
  selectedTags={selectedTags}
  onToggleCategory={handleToggleCategory}
  onToggleTag={handleToggleTag}
  onClearAll={() => { setSelectedTags([]); setSelectedCategories([]); }}
/>
```

**Step 13: Commit**

```bash
git add components/FAQList.tsx
git commit -m "feat(ui): add pagination, compare mode toggle, expand/collapse, voting"
```

---

## Task 12: ReadingView 添加展开/折叠

**Files:**
- Modify: `components/ReadingView.tsx`

**Step 1: 添加展开/折叠状态和按钮**

ReadingView 当前所有 FAQ 都是展开的（没有手风琴）。添加折叠能力:

```tsx
const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set());

function handleExpandAll(): void { setCollapsedIds(new Set()); }
function handleCollapseAll(): void {
  setCollapsedIds(new Set(items.map((item) => item.id)));
}
```

在工具栏中添加"全部展开"/"全部折叠"按钮（在"导出 PDF"按钮左侧）。

折叠时只显示问题标题，展开时显示完整答案。

**Step 2: Commit**

```bash
git add components/ReadingView.tsx
git commit -m "feat(ui): add expand/collapse controls to ReadingView"
```

---

## Task 13: 安装 fingerprintjs 依赖

**Files:**
- Modify: `package.json`

**Step 1: 安装**

```bash
npm install @fingerprintjs/fingerprintjs
```

**Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add @fingerprintjs/fingerprintjs for vote dedup"
```

---

## Task 14: 构建验证和修复

**Step 1: 运行构建**

```bash
npm run build
```

**Step 2: 修复所有 TypeScript 错误**

检查所有类型不匹配、缺失属性等问题。

**Step 3: 本地测试**

手动验证:
- 分页: 切换每页条数，翻页，搜索后重置页码
- 标签: 大标签筛选，大标签+小标签组合筛选
- 投票: 点击投票按钮，刷新后投票状态保持
- 比较: 默认无 checkbox，点击比较后出现，退出后消失
- 展开/折叠: 列表页和阅读视图都能全部展开/折叠

**Step 4: Commit**

```bash
git add -A
git commit -m "fix: resolve build errors and type mismatches"
```

---

## 执行顺序和依赖关系

```
Task 1 (类型) ─┬─> Task 2 (taxonomy.json) ──> Task 3 (归类脚本)
               │
               ├─> Task 4 (DB迁移) ──> Task 5 (投票API)
               │
               └─> Task 6 (AI prompt)
                        │
Task 7 (首页数据) <─────┘
        │
        ├─> Task 8 (Pagination组件)
        ├─> Task 9 (TagFilter改造)
        ├─> Task 10 (FAQItem投票)
        │
        └─> Task 11 (FAQList核心改造) <── Task 8, 9, 10
                │
                └─> Task 12 (ReadingView)

Task 13 (依赖安装) -- 可在任何时候执行
Task 14 (构建验证) -- 最后执行
```
