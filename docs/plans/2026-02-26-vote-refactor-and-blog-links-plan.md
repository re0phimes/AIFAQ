# 投票系统重构 + 博客外链自动匹配 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将投票系统从三按钮独立模式重构为 up/down 互斥 toggle 模式（显示计数、可取消），并为 blog 类型 reference 自动匹配博客 URL。

**Architecture:** 后端新增 DELETE 端点和 GET 批量查询端点，db.ts 新增 revokeVote/switchVote/getVotesByFingerprint 函数。前端 VoteButton 改为两按钮互斥 toggle，FAQList 页面加载时恢复投票状态。博客外链通过静态 blog-index.json 映射表在 parse-faq.ts 中自动填充。

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 5, PostgreSQL (@vercel/postgres), Tailwind CSS 4

---

### Task 1: 更新类型定义 (src/types/faq.ts)

**Files:**
- Modify: `src/types/faq.ts`

**Step 1: 修改 VoteType 和 FAQItem 类型**

将 `VoteType` 从三值改为二值，`FAQItem` 移除 `outdatedCount`/`inaccurateCount`，新增 `downvoteCount`：

```typescript
// src/types/faq.ts — 完整替换内容
export interface Reference {
  type: "blog" | "paper" | "other";
  title: string;
  url?: string;
}

export interface FAQItem {
  id: number;
  question: string;
  date: string;
  tags: string[];
  categories: string[];
  references: Reference[];
  answer: string;
  upvoteCount: number;
  downvoteCount: number;
}

export interface TagCategory {
  name: string;
  description: string;
  tags: string[];
}

export interface TagTaxonomy {
  categories: TagCategory[];
}

export type VoteType = "upvote" | "downvote";
```

**Step 2: 验证无 TypeScript 编译错误**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: 会有编译错误（因为其他文件还引用旧字段），这是预期的，后续 task 会修复。

**Step 3: Commit**

```bash
git add src/types/faq.ts
git commit -m "refactor(types): simplify VoteType to upvote/downvote, replace outdated/inaccurate counts with downvoteCount"
```

---

### Task 2: 重构数据库层 (lib/db.ts)

**Files:**
- Modify: `lib/db.ts`

**Step 1: 更新 DBFaqItem 接口和 initDB**

替换 `lib/db.ts` 中的 `DBFaqItem` 接口：
- 移除 `outdated_count`, `inaccurate_count`
- 新增 `downvote_count`

更新 `initDB`：
- 移除 `outdated_count`, `inaccurate_count` 的 ALTER TABLE
- 新增 `downvote_count` 的 ALTER TABLE
- faq_votes 的 UNIQUE 约束改为 `UNIQUE(faq_id, fingerprint)`（需要先 DROP 旧约束再 ADD 新约束）

```typescript
// DBFaqItem 接口 — 替换 outdated_count/inaccurate_count 为 downvote_count
export interface DBFaqItem {
  id: number;
  question: string;
  answer_raw: string;
  answer: string | null;
  tags: string[];
  categories: string[];
  references: Reference[];
  upvote_count: number;
  downvote_count: number;
  status: "pending" | "processing" | "ready" | "failed";
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
}
```

initDB 新增的迁移语句：
```typescript
// 新增 downvote_count 列
await sql`ALTER TABLE faq_items ADD COLUMN IF NOT EXISTS downvote_count INTEGER DEFAULT 0`;

// 迁移旧数据：合并 outdated_count + inaccurate_count 到 downvote_count
await sql`
  UPDATE faq_items
  SET downvote_count = COALESCE(outdated_count, 0) + COALESCE(inaccurate_count, 0)
  WHERE downvote_count = 0
    AND (COALESCE(outdated_count, 0) + COALESCE(inaccurate_count, 0)) > 0
`;

// 迁移 faq_votes：将 outdated/inaccurate 改为 downvote
// 先处理冲突：如果同一 faq_id+fingerprint 已有 upvote 又有 outdated/inaccurate，保留 upvote 删除后者
await sql`
  DELETE FROM faq_votes
  WHERE vote_type IN ('outdated', 'inaccurate')
    AND (faq_id, fingerprint) IN (
      SELECT faq_id, fingerprint FROM faq_votes WHERE vote_type = 'upvote'
    )
`;
// 再处理同一 faq_id+fingerprint 有多条 outdated/inaccurate 的情况，只保留最新一条
await sql`
  DELETE FROM faq_votes a
  USING faq_votes b
  WHERE a.vote_type IN ('outdated', 'inaccurate')
    AND b.vote_type IN ('outdated', 'inaccurate')
    AND a.faq_id = b.faq_id
    AND a.fingerprint = b.fingerprint
    AND a.id < b.id
`;
// 将剩余的 outdated/inaccurate 改为 downvote
await sql`UPDATE faq_votes SET vote_type = 'downvote' WHERE vote_type IN ('outdated', 'inaccurate')`;

// 删除旧 UNIQUE 约束，添加新的
await sql`ALTER TABLE faq_votes DROP CONSTRAINT IF EXISTS faq_votes_faq_id_vote_type_fingerprint_key`;
await sql`
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'faq_votes_faq_id_fingerprint_key'
    ) THEN
      ALTER TABLE faq_votes ADD CONSTRAINT faq_votes_faq_id_fingerprint_key UNIQUE (faq_id, fingerprint);
    END IF;
  END $$
`;
```

**Step 2: 更新 rowToFaqItem**

```typescript
function rowToFaqItem(row: Record<string, unknown>): DBFaqItem {
  return {
    id: row.id as number,
    question: row.question as string,
    answer_raw: row.answer_raw as string,
    answer: row.answer as string | null,
    tags: (row.tags as string[]) ?? [],
    categories: (row.categories as string[]) ?? [],
    references: (typeof row.references === "string"
      ? JSON.parse(row.references)
      : row.references) as Reference[],
    upvote_count: (row.upvote_count as number) ?? 0,
    downvote_count: (row.downvote_count as number) ?? 0,
    status: row.status as DBFaqItem["status"],
    error_message: row.error_message as string | null,
    created_at: new Date(row.created_at as string),
    updated_at: new Date(row.updated_at as string),
  };
}
```

**Step 3: 替换 VALID_VOTE_COLUMNS 和 castVote**

```typescript
const VALID_VOTE_COLUMNS: Record<string, string> = {
  upvote: "upvote_count",
  downvote: "downvote_count",
};

export async function castVote(
  faqId: number,
  voteType: string,
  fingerprint: string,
  ipAddress: string | null,
  reason?: string,
  detail?: string
): Promise<{ inserted: boolean; switched: boolean }> {
  const column = VALID_VOTE_COLUMNS[voteType];
  if (!column) throw new Error(`Invalid vote type: ${voteType}`);

  // Check for existing vote
  const existing = await sql`
    SELECT vote_type FROM faq_votes
    WHERE faq_id = ${faqId} AND fingerprint = ${fingerprint}
  `;

  if (existing.rows.length > 0) {
    const oldType = existing.rows[0].vote_type as string;
    if (oldType === voteType) {
      // Already voted same type
      return { inserted: false, switched: false };
    }
    // Switch vote: delete old, insert new
    const oldColumn = VALID_VOTE_COLUMNS[oldType];
    if (oldColumn) {
      await sql.query(
        `UPDATE faq_items SET ${oldColumn} = GREATEST(${oldColumn} - 1, 0) WHERE id = $1`,
        [faqId]
      );
    }
    await sql`DELETE FROM faq_votes WHERE faq_id = ${faqId} AND fingerprint = ${fingerprint}`;
  }

  await sql`
    INSERT INTO faq_votes (faq_id, vote_type, fingerprint, ip_address, reason, detail)
    VALUES (${faqId}, ${voteType}, ${fingerprint}, ${ipAddress}, ${reason ?? null}, ${detail ?? null})
  `;
  await sql.query(
    `UPDATE faq_items SET ${column} = ${column} + 1 WHERE id = $1`,
    [faqId]
  );

  return { inserted: true, switched: existing.rows.length > 0 };
}
```

**Step 4: 新增 revokeVote 函数**

```typescript
export async function revokeVote(
  faqId: number,
  fingerprint: string
): Promise<boolean> {
  const existing = await sql`
    SELECT vote_type FROM faq_votes
    WHERE faq_id = ${faqId} AND fingerprint = ${fingerprint}
  `;
  if (existing.rows.length === 0) return false;

  const voteType = existing.rows[0].vote_type as string;
  const column = VALID_VOTE_COLUMNS[voteType];

  await sql`DELETE FROM faq_votes WHERE faq_id = ${faqId} AND fingerprint = ${fingerprint}`;
  if (column) {
    await sql.query(
      `UPDATE faq_items SET ${column} = GREATEST(${column} - 1, 0) WHERE id = $1`,
      [faqId]
    );
  }
  return true;
}
```

**Step 5: 新增 getVotesByFingerprint 函数**

```typescript
export async function getVotesByFingerprint(
  fingerprint: string
): Promise<Record<number, string>> {
  const result = await sql`
    SELECT faq_id, vote_type FROM faq_votes WHERE fingerprint = ${fingerprint}
  `;
  const map: Record<number, string> = {};
  for (const row of result.rows) {
    map[row.faq_id as number] = row.vote_type as string;
  }
  return map;
}
```

**Step 6: 更新 getVoteCounts 函数**

```typescript
export async function getVoteCounts(
  faqIds: number[]
): Promise<Map<number, { upvote: number; downvote: number }>> {
  if (faqIds.length === 0) return new Map();
  const result = await sql.query(
    `SELECT faq_id, vote_type, COUNT(*)::int as count
     FROM faq_votes
     WHERE faq_id = ANY($1)
     GROUP BY faq_id, vote_type`,
    [faqIds]
  );
  const map = new Map<number, { upvote: number; downvote: number }>();
  for (const row of result.rows) {
    const faqId = row.faq_id as number;
    if (!map.has(faqId)) map.set(faqId, { upvote: 0, downvote: 0 });
    const entry = map.get(faqId)!;
    const type = row.vote_type as string;
    if (type === "upvote") entry.upvote = row.count as number;
    else if (type === "downvote") entry.downvote = row.count as number;
  }
  return map;
}
```

**Step 7: Commit**

```bash
git add lib/db.ts
git commit -m "refactor(db): migrate to upvote/downvote model with toggle support"
```

---

### Task 3: 重构投票 API (app/api/faq/[id]/vote/route.ts) + 新增批量查询 API

**Files:**
- Modify: `app/api/faq/[id]/vote/route.ts`
- Create: `app/api/faq/votes/route.ts`

**Step 1: 重写 vote route.ts，支持 POST 和 DELETE**

```typescript
// app/api/faq/[id]/vote/route.ts — 完整替换
import { NextResponse } from "next/server";
import { initDB, castVote, revokeVote } from "@/lib/db";

const VALID_TYPES = new Set(["upvote", "downvote"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const faqId = Number(id);
  if (!Number.isInteger(faqId) || faqId <= 0) {
    return NextResponse.json({ error: "Invalid FAQ ID" }, { status: 400 });
  }

  let body: { type?: string; fingerprint?: string; reason?: string; detail?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { type, fingerprint, reason, detail } = body;
  if (!type || !VALID_TYPES.has(type)) {
    return NextResponse.json(
      { error: "type must be one of: upvote, downvote" },
      { status: 400 }
    );
  }
  if (!fingerprint || typeof fingerprint !== "string") {
    return NextResponse.json({ error: "fingerprint is required" }, { status: 400 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null;

  try {
    await initDB();
    const result = await castVote(faqId, type, fingerprint, ip, reason, detail);
    if (!result.inserted) {
      return NextResponse.json({ error: "Already voted" }, { status: 409 });
    }
    return NextResponse.json({ success: true, switched: result.switched });
  } catch (err) {
    console.error("Vote error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const faqId = Number(id);
  if (!Number.isInteger(faqId) || faqId <= 0) {
    return NextResponse.json({ error: "Invalid FAQ ID" }, { status: 400 });
  }

  let body: { fingerprint?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { fingerprint } = body;
  if (!fingerprint || typeof fingerprint !== "string") {
    return NextResponse.json({ error: "fingerprint is required" }, { status: 400 });
  }

  try {
    await initDB();
    const success = await revokeVote(faqId, fingerprint);
    if (!success) {
      return NextResponse.json({ error: "No vote found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Revoke vote error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Step 2: 创建批量查询 API**

```typescript
// app/api/faq/votes/route.ts — 新建
import { NextResponse } from "next/server";
import { initDB, getVotesByFingerprint } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fingerprint = searchParams.get("fingerprint");

  if (!fingerprint) {
    return NextResponse.json({ error: "fingerprint is required" }, { status: 400 });
  }

  try {
    await initDB();
    const votes = await getVotesByFingerprint(fingerprint);
    return NextResponse.json(votes);
  } catch (err) {
    console.error("Get votes error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Step 3: Commit**

```bash
git add app/api/faq/[id]/vote/route.ts app/api/faq/votes/route.ts
git commit -m "feat(api): add DELETE vote endpoint and GET bulk vote query"
```

---

### Task 4: 重构前端投票组件 (FAQItem.tsx)

**Files:**
- Modify: `components/FAQItem.tsx`

**Step 1: 替换 VoteButton 组件为 up/down 双按钮**

移除旧的三按钮 `VoteButton`、`InaccuratePanel`、`INACCURATE_REASONS`。替换为：

```typescript
// 新的 DOWNVOTE_REASONS（替换 INACCURATE_REASONS）
const DOWNVOTE_REASONS = [
  { value: "outdated", label: "过时" },
  { value: "factual_error", label: "不准确" },
  { value: "unclear", label: "表述不清" },
  { value: "other", label: "其他" },
] as const;

// DownvotePanel（替换 InaccuratePanel）
function DownvotePanel({
  onSubmit,
  onCancel,
}: {
  onSubmit: (reason: string, detail: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  return (
    <div className="mt-2 rounded-lg border border-gray-200 bg-code-bg/50 p-3"
      onClick={(e) => e.stopPropagation()}>
      <p className="mb-2 text-xs font-medium text-slate-secondary">
        请选择反馈原因:
      </p>
      <div className="flex flex-wrap gap-1.5">
        {DOWNVOTE_REASONS.map((r) => (
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

**Step 2: 更新 FAQItemProps 接口和 FAQItem 组件**

```typescript
interface FAQItemProps {
  item: FAQItemType;
  isOpen: boolean;
  isSelected: boolean;
  showCheckbox: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onVote: (type: VoteType, reason?: string, detail?: string) => void;
  onRevokeVote: () => void;
  currentVote: VoteType | null;  // 替换 votedTypes: Set<VoteType>
}
```

投票按钮区域替换为：

```tsx
{/* Vote buttons — up/down 互斥 */}
<div className="mt-3 flex items-center gap-3 border-t border-gray-100 pt-3">
  {/* Upvote */}
  <button
    onClick={(e) => {
      e.stopPropagation();
      if (currentVote === "upvote") {
        onRevokeVote();
      } else {
        onVote("upvote");
      }
    }}
    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1
      text-xs transition-colors ${
        currentVote === "upvote"
          ? "bg-green-100 text-green-700"
          : "text-slate-secondary hover:bg-code-bg"
      }`}
  >
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor"
      viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z M2 13h2v9H2z" />
    </svg>
    有用
    {(item.upvoteCount ?? 0) > 0 && (
      <span className="font-mono text-[10px]">{item.upvoteCount}</span>
    )}
  </button>

  {/* Downvote */}
  <button
    onClick={(e) => {
      e.stopPropagation();
      if (currentVote === "downvote") {
        onRevokeVote();
        setShowDownvotePanel(false);
      } else {
        setShowDownvotePanel((v) => !v);
      }
    }}
    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1
      text-xs transition-colors ${
        currentVote === "downvote"
          ? "bg-red-100 text-red-600"
          : "text-slate-secondary hover:bg-code-bg"
      }`}
  >
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor"
      viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M10 15V19a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z M22 2h-2v9h2z" />
    </svg>
    反馈
    {(item.downvoteCount ?? 0) > 0 && (
      <span className="font-mono text-[10px]">{item.downvoteCount}</span>
    )}
  </button>
</div>
{showDownvotePanel && currentVote !== "downvote" && (
  <DownvotePanel
    onSubmit={(reason, detail) => {
      onVote("downvote", reason, detail);
      setShowDownvotePanel(false);
    }}
    onCancel={() => setShowDownvotePanel(false)}
  />
)}
```

注意：组件内部 state 变量名从 `showInaccuratePanel` 改为 `showDownvotePanel`。

`hasTimelinessWarning` 改为：
```typescript
const hasTimelinessWarning = (item.downvoteCount ?? 0) >= 3;
```

**Step 3: Commit**

```bash
git add components/FAQItem.tsx
git commit -m "refactor(ui): replace 3-button vote with up/down toggle buttons"
```

---

### Task 5: 重构 FAQList.tsx 投票状态管理

**Files:**
- Modify: `components/FAQList.tsx`

**Step 1: 替换 votedMap 类型和相关函数**

`votedMap` 从 `Map<number, Set<VoteType>>` 改为 `Map<number, VoteType>`（每个 FAQ 只有一票）。

替换 `loadVotedMap` 和 `saveVotedMap`：

```typescript
function loadVotedMap(): Map<number, VoteType> {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = localStorage.getItem(LS_VOTED);
    if (raw) {
      const obj = JSON.parse(raw) as Record<string, VoteType>;
      const map = new Map<number, VoteType>();
      for (const [k, v] of Object.entries(obj)) {
        map.set(Number(k), v);
      }
      return map;
    }
  } catch { /* ignore */ }
  return new Map();
}

function saveVotedMap(map: Map<number, VoteType>): void {
  const obj: Record<string, VoteType> = {};
  for (const [k, v] of map) obj[String(k)] = v;
  localStorage.setItem(LS_VOTED, JSON.stringify(obj));
}
```

**Step 2: 添加从服务端恢复投票状态的 effect**

在 fingerprint 加载完成后，调用 GET /api/faq/votes 恢复状态：

```typescript
// 在 fingerprint effect 之后添加
useEffect(() => {
  if (!fingerprint) return;
  fetch(`/api/faq/votes?fingerprint=${fingerprint}`)
    .then((res) => res.ok ? res.json() : null)
    .then((data: Record<string, string> | null) => {
      if (!data) return;
      const map = new Map<number, VoteType>();
      for (const [k, v] of Object.entries(data)) {
        if (v === "upvote" || v === "downvote") {
          map.set(Number(k), v);
        }
      }
      setVotedMap(map);
      saveVotedMap(map);
    })
    .catch(() => { /* network error, use localStorage fallback */ });
}, [fingerprint]);
```

**Step 3: 替换 handleVote 和 handleInaccurateVote**

移除 `handleInaccurateVote`，重写 `handleVote` 为 toggle + 切换逻辑：

```typescript
const handleVote = useCallback(
  async (faqId: number, type: VoteType, reason?: string, detail?: string) => {
    if (!fingerprint) return;
    const current = votedMap.get(faqId);

    // 乐观更新
    setVotedMap((prev) => {
      const next = new Map(prev);
      next.set(faqId, type);
      saveVotedMap(next);
      return next;
    });

    try {
      const res = await fetch(`/api/faq/${faqId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, fingerprint, reason, detail }),
      });
      if (!res.ok && res.status !== 409) {
        // 回滚
        setVotedMap((prev) => {
          const next = new Map(prev);
          if (current) next.set(faqId, current);
          else next.delete(faqId);
          saveVotedMap(next);
          return next;
        });
      }
    } catch {
      // 回滚
      setVotedMap((prev) => {
        const next = new Map(prev);
        if (current) next.set(faqId, current);
        else next.delete(faqId);
        saveVotedMap(next);
        return next;
      });
    }
  },
  [fingerprint, votedMap]
);

const handleRevokeVote = useCallback(
  async (faqId: number) => {
    if (!fingerprint) return;
    const current = votedMap.get(faqId);

    // 乐观更新
    setVotedMap((prev) => {
      const next = new Map(prev);
      next.delete(faqId);
      saveVotedMap(next);
      return next;
    });

    try {
      const res = await fetch(`/api/faq/${faqId}/vote`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fingerprint }),
      });
      if (!res.ok) {
        // 回滚
        setVotedMap((prev) => {
          const next = new Map(prev);
          if (current) next.set(faqId, current);
          saveVotedMap(next);
          return next;
        });
      }
    } catch {
      setVotedMap((prev) => {
        const next = new Map(prev);
        if (current) next.set(faqId, current);
        saveVotedMap(next);
        return next;
      });
    }
  },
  [fingerprint, votedMap]
);
```

**Step 4: 更新 FAQItem 调用处的 props**

```tsx
<FAQItem
  item={item}
  isOpen={openItems.has(item.id)}
  isSelected={selectedItems.has(item.id)}
  showCheckbox={compareMode}
  onToggle={() => handleToggleItem(item.id)}
  onSelect={() => handleToggleSelect(item.id)}
  onVote={(type, reason, detail) => handleVote(item.id, type, reason, detail)}
  onRevokeVote={() => handleRevokeVote(item.id)}
  currentVote={votedMap.get(item.id) ?? null}
/>
```

**Step 5: Commit**

```bash
git add components/FAQList.tsx
git commit -m "refactor(ui): FAQList toggle vote with server sync and optimistic updates"
```

---

### Task 6: 更新 page.tsx 和 parse-faq.ts 的字段映射

**Files:**
- Modify: `app/page.tsx`
- Modify: `scripts/parse-faq.ts`

**Step 1: 更新 app/page.tsx**

将 `outdatedCount` / `inaccurateCount` 替换为 `downvoteCount`：

```typescript
// staticItems 映射中
downvoteCount: (item.downvoteCount as number) ?? 0,
// 移除 outdatedCount 和 inaccurateCount

// dynamicItems 映射中
downvoteCount: item.downvote_count,
// 移除 outdatedCount 和 inaccurateCount
```

**Step 2: 更新 scripts/parse-faq.ts**

`parseFAQ` 函数中 `items.push` 的对象：

```typescript
items.push({
  id,
  question,
  date,
  tags,
  categories: [],
  references,
  answer,
  upvoteCount: 0,
  downvoteCount: 0,
  // 移除 outdatedCount 和 inaccurateCount
});
```

**Step 3: Commit**

```bash
git add app/page.tsx scripts/parse-faq.ts
git commit -m "refactor: update page.tsx and parse-faq.ts for new vote model"
```

---

### Task 7: 创建博客索引文件 (data/blog-index.json)

**Files:**
- Create: `data/blog-index.json`

**Step 1: 创建 blog-index.json**

从 blog.phimes.top 抓取的 22 篇文章，创建标题到 URL 的映射：

```json
[
  {
    "title": "KV Cache（二）：从如何让GPU不摸鱼开始思考——MQA、GQA到MLA的计算拆解",
    "url": "https://blog.phimes.top/posts/2026/KV Cache（二）：从如何让GPU不摸鱼开始思考——MQA、GQA到MLA的计算拆解。.html"
  },
  {
    "title": "KV Cache（一）：从KV Cache看懂Attention（MHA、MQA、GQA、MLA）的优化之路",
    "url": "https://blog.phimes.top/posts/2026/KV Cache（一）：从KV Cache看懂Attention（MHA、MQA、GQA、MLA）的优化之路.html"
  },
  {
    "title": "从vibe到spec：可维护性视角下探讨为什么很多人的AI编程依然是小玩具",
    "url": "https://blog.phimes.top/posts/2025/从vibe到spec：可维护性视角下探讨为什么很多人的AI编程依然是小玩具.html"
  },
  {
    "title": "通过下游任务理解BERT和GPT的区别：不只是完形填空和词语接龙",
    "url": "https://blog.phimes.top/posts/2025/通过下游任务理解BERT和GPT的区别：不只是完形填空和词语接龙.html"
  },
  {
    "title": "为什么Embedding加上位置编码后不会破坏语义？",
    "url": "https://blog.phimes.top/posts/2025/为什么Embedding加上位置编码后不会破坏语义？.html"
  },
  {
    "title": "流形视角下的Embedding：从理论到RAG实践",
    "url": "https://blog.phimes.top/posts/2025/流形视角下的Embedding：从理论到RAG实践.html"
  },
  {
    "title": "Add & Norm（二）：从传统CV到Transformer里的Normalizaiton详解",
    "url": "https://blog.phimes.top/posts/2025/Add & Norm （二）从传统CV到Transformer里的Normalizaiton详解.html"
  },
  {
    "title": "Add & Norm（一）：对残差连接深入解析",
    "url": "https://blog.phimes.top/posts/2025/Add & Norm（一）：对残差连接深入解析.html"
  },
  {
    "title": "前馈神经网络（FFN）详解（二）：从激活函数到MOE",
    "url": "https://blog.phimes.top/posts/2025/前馈神经网络（FFN）详解（二）：从激活函数到MOE.html"
  },
  {
    "title": "前馈神经网络（FFN）详解（一）",
    "url": "https://blog.phimes.top/posts/2025/为什么前馈神经网络（FFN）对Transformer这么重要（一）.html"
  },
  {
    "title": "注意力机制之多头注意力（Multi-Head Attention）",
    "url": "https://blog.phimes.top/posts/2025/Transformer之多头注意力.html"
  },
  {
    "title": "Qwen3-8b的变化和能力初探",
    "url": "https://blog.phimes.top/posts/2025/Qwen3小测.html"
  },
  {
    "title": "工程实现系列：从什么都不会到QLoRA分布式DPO（一）",
    "url": "https://blog.phimes.top/posts/2025/从什么都不会到QLoRA分布式DPO（一）.html"
  },
  {
    "title": "LLM最长上下文的一些运用和理解",
    "url": "https://blog.phimes.top/posts/2025/LLM最长上下文的一些理解.html"
  },
  {
    "title": "从什么都不会到QLoRA分布式DPO（二）",
    "url": "https://blog.phimes.top/posts/2025/从什么都不会到QLoRA分布式DPO（二）- wandb曲线如何看以及QLoRA代码实操.html"
  },
  {
    "title": "从tools use谈谈Deepseek的联网搜索怎么实现",
    "url": "https://blog.phimes.top/posts/2025/从tools use谈谈Deepseek的\"联网搜索\"怎么实现 2025-02-01.html"
  },
  {
    "title": "Transformer中的Q和K",
    "url": "https://blog.phimes.top/posts/2025/Transformer中的Q和K 2025-01-29.html"
  },
  {
    "title": "浅谈CoT",
    "url": "https://blog.phimes.top/posts/2025/浅谈CoT Prompt 2025-01-26.html"
  },
  {
    "title": "更优雅的使用大模型：DeepSeek API+Cherry Studio+激活CoT的Prompt",
    "url": "https://blog.phimes.top/posts/2025/更优雅的使用大模型：DeepSeek API+Cherry Studio+激活CoT的Prompt.html"
  },
  {
    "title": "大模型训练策略选择",
    "url": "https://blog.phimes.top/posts/2025/关于大模型训练策略选择的思考.html"
  },
  {
    "title": "agent概述",
    "url": "https://blog.phimes.top/posts/2025/agent介绍.html"
  },
  {
    "title": "vue语法总结",
    "url": "https://blog.phimes.top/posts/2024/vue语法总结.html"
  }
]
```

**Step 2: Commit**

```bash
git add data/blog-index.json
git commit -m "data: add blog-index.json with 22 blog article URLs"
```

---

### Task 8: 在 parse-faq.ts 中自动匹配博客 URL

**Files:**
- Modify: `scripts/parse-faq.ts`

**Step 1: 加载 blog-index 并实现匹配逻辑**

在文件顶部加载 blog-index.json，新增归一化和匹配函数：

```typescript
const BLOG_INDEX_PATH = path.resolve(__dirname, "../data/blog-index.json");

interface BlogEntry {
  title: string;
  url: string;
}

// 归一化：去掉标点、空格、.md 后缀，转小写
function normalize(s: string): string {
  return s
    .replace(/\.md$/i, "")
    .replace(/[（）()：:，,。.、？?！!""''《》\s]/g, "")
    .toLowerCase();
}

function matchBlogUrl(title: string, blogIndex: BlogEntry[]): string | undefined {
  const norm = normalize(title);
  // 精确匹配
  for (const entry of blogIndex) {
    if (normalize(entry.title) === norm) return entry.url;
  }
  // 子串匹配：blog title 包含 reference title 或反过来
  for (const entry of blogIndex) {
    const entryNorm = normalize(entry.title);
    if (entryNorm.includes(norm) || norm.includes(entryNorm)) return entry.url;
  }
  return undefined;
}
```

**Step 2: 修改 parseReferences 函数签名，传入 blogIndex**

```typescript
function parseReferences(lines: string[], blogIndex: BlogEntry[]): Reference[] {
  const refs: Reference[] = [];
  for (const line of lines) {
    const trimmed = line.replace(/^-\s*/, "").trim();
    if (!trimmed) continue;

    const arxivMatch = trimmed.match(/arXiv:(\d+\.\d+)/);
    if (arxivMatch) {
      refs.push({
        type: "paper",
        title: trimmed,
        url: `https://arxiv.org/abs/${arxivMatch[1]}`,
      });
    } else if (trimmed.startsWith("来源文章:") || trimmed.startsWith("来源文章：")) {
      const blogTitle = trimmed.replace(/^来源文章[:：]\s*/, "");
      const url = matchBlogUrl(blogTitle, blogIndex);
      refs.push({
        type: "blog",
        title: blogTitle,
        ...(url ? { url } : {}),
      });
    } else {
      refs.push({ type: "other", title: trimmed });
    }
  }
  return refs;
}
```

**Step 3: 更新 main 和 parseFAQ 调用**

```typescript
function main(): void {
  const content = fs.readFileSync(MD_PATH, "utf-8");

  let blogIndex: BlogEntry[] = [];
  try {
    blogIndex = JSON.parse(fs.readFileSync(BLOG_INDEX_PATH, "utf-8"));
  } catch {
    console.warn("Warning: blog-index.json not found, blog URLs will not be matched");
  }

  const items = parseFAQ(content, blogIndex);
  // ...
}

function parseFAQ(content: string, blogIndex: BlogEntry[]): FAQItem[] {
  // ... 在调用 parseReferences 时传入 blogIndex
  const references = parseReferences(refLines, blogIndex);
  // ...
}
```

**Step 4: 运行解析脚本验证**

Run: `npx tsx scripts/parse-faq.ts`
Expected: 输出 "Parsed XX FAQ items"，检查 data/faq.json 中 blog 类型 reference 是否有 url 字段。

**Step 5: Commit**

```bash
git add scripts/parse-faq.ts
git commit -m "feat(parse): auto-match blog URLs from blog-index.json"
```

---

### Task 9: 更新 ReferenceList.tsx 支持 blog 链接

**Files:**
- Modify: `components/ReferenceList.tsx`

**Step 1: 修改 RefItems 渲染逻辑**

将"只有 paper 且有 url 才渲染为链接"改为"只要有 url 就渲染为链接"：

```typescript
function RefItems({ references }: { references: Reference[] }) {
  return (
    <ul className="space-y-1">
      {references.map((ref, i) => (
        <li key={i} className="flex items-start gap-2 text-xs md:text-sm">
          <span className="shrink-0 text-slate-secondary">
            {ref.type === "paper" ? "📄" : ref.type === "blog" ? "📖" : "📌"}
          </span>
          {ref.url ? (
            <a
              href={ref.url}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-copper underline-offset-2 hover:underline"
            >
              {ref.title}
            </a>
          ) : (
            <span className="text-slate-secondary">{ref.title}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
```

**Step 2: Commit**

```bash
git add components/ReferenceList.tsx
git commit -m "feat(ui): render blog references as clickable links when URL available"
```

---

### Task 10: 全局验证和清理

**Files:**
- 无新文件

**Step 1: TypeScript 编译检查**

Run: `npx tsc --noEmit`
Expected: 无错误

**Step 2: ESLint 检查**

Run: `npx eslint .`
Expected: 无错误（或仅有预先存在的 warning）

**Step 3: 运行解析脚本，验证 faq.json 输出**

Run: `npx tsx scripts/parse-faq.ts`
Expected: blog 类型 reference 中有 url 字段

**Step 4: 验证 build**

Run: `npm run build`
Expected: 构建成功

**Step 5: 最终 Commit**

如果有任何修复：
```bash
git add -A
git commit -m "fix: resolve build issues from vote refactor and blog links"
```
