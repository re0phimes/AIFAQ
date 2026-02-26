# FAQ 页面 5 项修复 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复标签过滤 bug、行内公式渲染、参考来源展开、头部滚动隐藏、不准确投票理由 5 个问题。

**Architecture:** 纯前端修复为主（Task 1-4），Task 5 涉及前后端联动（投票 API + DB schema + 前端面板）。所有修改基于现有组件结构，不引入新依赖。

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, react-markdown, remark-math, rehype-katex, @vercel/postgres

---

### Task 1: 修复标签分类过滤 bug

**Files:**
- Modify: `components/FAQList.tsx:94-105, 138-151`

**Step 1: 构建 category -> tags 映射，替换分类过滤逻辑**

在 `FAQList.tsx` 的 `useMemo` 区域，新增一个从 taxonomy 构建的映射。
然后修改 `filtered` 的分类过滤部分，用 taxonomy tags 匹配 item.tags。

在 `FAQList` 组件内，`allTags` useMemo 之后，新增:

```typescript
// 构建 category -> tags 映射
const categoryTagsMap = useMemo(() => {
  const map = new Map<string, Set<string>>();
  for (const cat of (taxonomy as TagTaxonomy).categories) {
    map.set(cat.name, new Set(cat.tags));
  }
  return map;
}, []);
```

修改 `filtered` useMemo 中的分类过滤部分（原 L144-148），从:

```typescript
if (selectedCategories.length > 0) {
  result = result.filter((item) =>
    selectedCategories.some((cat) => item.categories.includes(cat))
  );
}
```

改为:

```typescript
if (selectedCategories.length > 0) {
  result = result.filter((item) =>
    selectedCategories.some((cat) => {
      const catTags = categoryTagsMap.get(cat);
      return catTags ? item.tags.some((tag) => catTags.has(tag)) : false;
    })
  );
}
```

将 `categoryTagsMap` 加入 `filtered` useMemo 的依赖数组。

**Step 2: 验证**

Run: `npx next build` 确认编译通过。
手动验证: 打开页面，点击分类按钮，确认 FAQ 列表正确过滤。

**Step 3: Commit**

```bash
git add components/FAQList.tsx
git commit -m "fix(filter): use taxonomy tags for category filtering instead of empty item.categories"
```

---

### Task 2: 修复行内公式 `$...$` 渲染

**Files:**
- Modify: `components/FAQItem.tsx:171-173`
- Possibly: `app/globals.css`

**Step 1: 排查 remark-math 配置**

检查 `remark-math` v6 的 `singleDollarTextMath` 选项是否默认启用。
如果需要显式启用，修改 `FAQItem.tsx` 中的 remarkPlugins 配置:

```typescript
// 原代码
remarkPlugins={[remarkMath]}
// 如果需要显式配置
remarkPlugins={[[remarkMath, { singleDollarTextMath: true }]]}
```

**Step 2: 检查 Tailwind prose 对 KaTeX 的样式干扰**

在 `globals.css` 中添加 prose 对 katex 的样式保护:

```css
/* 确保 prose 不干扰 KaTeX 行内公式 */
.prose .katex-display {
  overflow-x: auto;
  padding: 0.5rem 0;
}

.prose .katex {
  font-size: 1em;
}
```

**Step 3: 同步修复 ReadingView.tsx**

`ReadingView.tsx:201-203` 也使用了相同的 remarkMath + rehypeKatex 配置，
需要同步修改（如果 Step 1 需要改配置的话）。

**Step 4: 验证**

Run: `npx next build` 确认编译通过。
手动验证: 打开包含行内公式的 FAQ（如 ID 65-80），确认 `$O(N^2)$` 等正确渲染为数学公式。

**Step 5: Commit**

```bash
git add components/FAQItem.tsx components/ReadingView.tsx app/globals.css
git commit -m "fix(render): ensure inline math $...$ renders correctly with KaTeX"
```

---

### Task 3: 参考来源默认展开

**Files:**
- Modify: `components/ReferenceList.tsx:12`

**Step 1: 修改默认展开状态**

将 `ReferenceList.tsx` 第 12 行:

```typescript
const [expanded, setExpanded] = useState(false);
```

改为:

```typescript
const [expanded, setExpanded] = useState(true);
```

**Step 2: 验证**

手动验证: 展开一个 FAQ，确认参考来源在桌面端默认展开显示完整列表。

**Step 3: Commit**

```bash
git add components/ReferenceList.tsx
git commit -m "feat(reference): default expand references when FAQ is opened"
```

---

### Task 4: 头部滚动隐藏/显示

**Files:**
- Modify: `app/page.tsx`
- Modify: `components/FAQList.tsx`
- Modify: `app/globals.css`

**Step 1: 重构页面布局，将 header 移入 FAQList**

当前 header 在 `app/page.tsx`（Server Component）中，滚动逻辑需要客户端状态。
将 header 内容移入 `FAQList.tsx`，使其可以被滚动监听控制。

修改 `app/page.tsx`:

```typescript
export default async function Home() {
  // ... 数据获取逻辑不变 ...
  return <FAQList items={allItems} />;
}
```

**Step 2: 在 FAQList 中添加滚动监听和 header**

在 `FAQList.tsx` 中:

1. 新增状态和 ref:

```typescript
const [headerVisible, setHeaderVisible] = useState(true);
const lastScrollY = useRef(0);
const headerRef = useRef<HTMLDivElement>(null);
```

2. 新增滚动监听 useEffect:

```typescript
useEffect(() => {
  const THRESHOLD = 10; // 最小滚动距离
  function handleScroll() {
    const currentY = window.scrollY;
    if (Math.abs(currentY - lastScrollY.current) < THRESHOLD) return;
    setHeaderVisible(currentY < lastScrollY.current || currentY < 80);
    lastScrollY.current = currentY;
  }
  window.addEventListener("scroll", handleScroll, { passive: true });
  return () => window.removeEventListener("scroll", handleScroll);
}, []);
```

3. 在 JSX 中包裹 header + 搜索 + 标签:

```tsx
<div
  ref={headerRef}
  className={`sticky top-0 z-20 bg-warm-white/95 backdrop-blur-sm
    pb-3 transition-transform duration-300 ${
      headerVisible ? "translate-y-0" : "-translate-y-full"
    }`}
>
  <header className="mb-4 pt-2">
    <h1 className="font-serif text-3xl font-bold text-deep-ink">AIFAQ</h1>
    <p className="mt-1 text-sm text-slate-secondary">
      AI/ML 常见问题知识库
    </p>
  </header>
  <SearchBar ... />
  <div className="mt-3">
    <TagFilter ... />
  </div>
</div>
```

**Step 3: 添加 CSS 过渡支持**

在 `globals.css` 中确保 sticky header 的过渡平滑:

```css
/* Sticky header 底部阴影 */
.sticky-header-shadow {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}
```

**Step 4: 验证**

Run: `npx next build` 确认编译通过。
手动验证:
- 向下滚动: header 区域平滑向上滑出
- 向上滚动: header 区域平滑滑回
- 页面顶部: header 始终可见

**Step 5: Commit**

```bash
git add app/page.tsx components/FAQList.tsx app/globals.css
git commit -m "feat(ui): auto-hide header on scroll down, show on scroll up"
```

---

### Task 5: "不准确"投票增加理由

**Files:**
- Modify: `lib/db.ts:42-52, 146-168`
- Modify: `app/api/faq/[id]/vote/route.ts`
- Modify: `components/FAQItem.tsx`
- Modify: `components/FAQList.tsx`

**Step 1: 数据库 schema 变更**

在 `lib/db.ts` 的 `initDB()` 函数中，`faq_votes` 表创建之后，添加:

```typescript
await sql`ALTER TABLE faq_votes ADD COLUMN IF NOT EXISTS reason VARCHAR(50)`;
await sql`ALTER TABLE faq_votes ADD COLUMN IF NOT EXISTS detail TEXT`;
```

**Step 2: 修改 castVote 函数签名**

修改 `lib/db.ts` 中的 `castVote`:

```typescript
export async function castVote(
  faqId: number,
  voteType: string,
  fingerprint: string,
  ipAddress: string | null,
  reason?: string,
  detail?: string
): Promise<boolean> {
  const result = await sql`
    INSERT INTO faq_votes (faq_id, vote_type, fingerprint, ip_address, reason, detail)
    VALUES (${faqId}, ${voteType}, ${fingerprint}, ${ipAddress}, ${reason ?? null}, ${detail ?? null})
    ON CONFLICT (faq_id, vote_type, fingerprint) DO NOTHING
    RETURNING id
  `;
  if (result.rows.length === 0) return false;

  const column = VALID_VOTE_COLUMNS[voteType];
  if (!column) throw new Error(`Invalid vote type: ${voteType}`);
  await sql.query(
    `UPDATE faq_items SET ${column} = ${column} + 1 WHERE id = $1`,
    [faqId]
  );
  return true;
}
```

**Step 3: 修改投票 API**

修改 `app/api/faq/[id]/vote/route.ts`，在 body 解析中增加 `reason` 和 `detail`:

```typescript
let body: { type?: string; fingerprint?: string; reason?: string; detail?: string };
// ...
const { type, fingerprint, reason, detail } = body;
// ...
const success = await castVote(faqId, type, fingerprint, ip, reason, detail);
```

**Step 4: 修改前端投票交互**

在 `FAQItem.tsx` 中:

1. 修改 `FAQItemProps`，增加 `onInaccurateVote` 回调:

```typescript
interface FAQItemProps {
  // ... 现有 props ...
  onVote: (type: VoteType) => void;
  onInaccurateVote: (reason: string, detail: string) => void;
  votedTypes: Set<VoteType>;
}
```

2. 新增 `InaccuratePanel` 内联组件:

```typescript
const INACCURATE_REASONS = [
  { value: "factual_error", label: "事实错误" },
  { value: "outdated_info", label: "过时信息" },
  { value: "unclear", label: "表述不清" },
  { value: "other", label: "其他" },
] as const;

function InaccuratePanel({
  onSubmit,
  onCancel,
}: {
  onSubmit: (reason: string, detail: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  return (
    <div className="mt-2 rounded-lg border border-gray-200 bg-code-bg/50 p-3">
      <p className="mb-2 text-xs font-medium text-slate-secondary">
        请选择不准确的原因:
      </p>
      <div className="flex flex-wrap gap-1.5">
        {INACCURATE_REASONS.map((r) => (
          <button
            key={r.value}
            onClick={() => setReason(r.value)}
            className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
              reason === r.value
                ? "bg-copper text-white"
                : "bg-white border border-gray-200 text-deep-ink hover:bg-gray-100"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <textarea
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        placeholder="补充说明 (可选)"
        className="mt-2 w-full rounded border border-gray-200 bg-white px-2 py-1.5
          text-xs text-deep-ink placeholder:text-slate-secondary/50
          focus:border-copper focus:outline-none"
        rows={2}
      />
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => reason && onSubmit(reason, detail)}
          disabled={!reason}
          className="rounded-md bg-copper px-3 py-1 text-xs text-white
            transition-colors hover:bg-copper-light disabled:opacity-40"
        >
          提交
        </button>
        <button
          onClick={onCancel}
          className="rounded-md border border-gray-200 px-3 py-1 text-xs
            text-slate-secondary hover:bg-gray-100"
        >
          取消
        </button>
      </div>
    </div>
  );
}
```

3. 在 `FAQItem` 组件中添加 `showInaccuratePanel` 状态，
   点击"不准确"按钮时展开面板而非直接投票。

**Step 5: 修改 FAQList 中的投票回调**

在 `FAQList.tsx` 中新增 `handleInaccurateVote` 回调:

```typescript
const handleInaccurateVote = useCallback(
  async (faqId: number, reason: string, detail: string) => {
    if (!fingerprint) return;
    if (votedMap.get(faqId)?.has("inaccurate")) return;
    try {
      const res = await fetch(`/api/faq/${faqId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "inaccurate",
          fingerprint,
          reason,
          detail,
        }),
      });
      if (res.ok || res.status === 409) {
        setVotedMap((prev) => {
          const next = new Map(prev);
          const types = new Set(next.get(faqId) ?? []);
          types.add("inaccurate");
          next.set(faqId, types);
          saveVotedMap(next);
          return next;
        });
      }
    } catch { /* network error */ }
  },
  [fingerprint, votedMap]
);
```

将 `onInaccurateVote` 传给 `FAQItem`:

```tsx
<FAQItem
  ...
  onInaccurateVote={(reason, detail) =>
    handleInaccurateVote(item.id, reason, detail)
  }
/>
```

**Step 6: 验证**

Run: `npx next build` 确认编译通过。
手动验证:
- 点击"不准确"按钮，展开理由面板
- 选择预设理由，可选填补充说明
- 提交后按钮高亮，面板关闭
- 未选择理由时提交按钮禁用

**Step 7: Commit**

```bash
git add lib/db.ts app/api/faq/[id]/vote/route.ts components/FAQItem.tsx components/FAQList.tsx
git commit -m "feat(vote): add reason selection panel for inaccurate votes"
```
