# FAQ 同步工作流 + 答案版本化 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 建立 FAQ 双向同步机制（DB ↔ 本地 JSON），实现答案版本化存储，投票绑定版本，Premium 用户可查看历史版本。

**Architecture:** 在现有 `@vercel/postgres` + NextAuth v5 基础上，新增 `faq_versions` 表存储历史版本，`faq_votes` 绑定 `version_id`。本地 CLI 工具（`tools/faq-sync/`）负责 pull/push/evaluate。前端按用户 tier 展示版本历史。

**Tech Stack:** Next.js 15, @vercel/postgres, NextAuth v5 (GitHub OAuth), tsx (CLI scripts)

---

## Task 1: 数据库 Schema 迁移 — faq_versions 表 + faq_items 新字段

**Files:**
- Modify: `lib/db.ts:13-36` (DBFaqItem interface)
- Modify: `lib/db.ts:38-159` (initDB function)
- Modify: `lib/db.ts:257-286` (rowToFaqItem function)

**Step 1: 在 `lib/db.ts` DBFaqItem 接口添加新字段**

在 `lib/db.ts:35` (`reviewed_by` 行之后) 添加：

```typescript
  current_version: number;
  last_updated_at: Date | null;
```

**Step 2: 在 `initDB()` 添加迁移 SQL**

在 `lib/db.ts:158` (`faq_imports` 表创建之后) 添加：

```typescript
  // Version tracking columns on faq_items
  await sql`ALTER TABLE faq_items ADD COLUMN IF NOT EXISTS current_version INTEGER DEFAULT 1`;
  await sql`ALTER TABLE faq_items ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMPTZ`;

  // FAQ versions table
  await sql`
    CREATE TABLE IF NOT EXISTS faq_versions (
      id              SERIAL PRIMARY KEY,
      faq_id          INTEGER NOT NULL REFERENCES faq_items(id) ON DELETE CASCADE,
      version         INTEGER NOT NULL,
      answer          TEXT NOT NULL,
      answer_brief    TEXT,
      answer_en       TEXT,
      answer_brief_en TEXT,
      change_reason   TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(faq_id, version)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_faq_versions_faq_id ON faq_versions(faq_id)`;

  // Version tracking on votes
  await sql`ALTER TABLE faq_votes ADD COLUMN IF NOT EXISTS version_id INTEGER`;
```

**Step 3: 更新 `rowToFaqItem` 映射**

在 `lib/db.ts:284` (`reviewed_by` 行之后) 添加：

```typescript
    current_version: (row.current_version as number) ?? 1,
    last_updated_at: row.last_updated_at ? new Date(row.last_updated_at as string) : null,
```

**Step 4: 验证迁移**

Run: `npx tsx -r ./scripts/env-loader.js scripts/init-db.ts`
Expected: 无报错，表和字段创建成功

**Step 5: Commit**

```bash
git add lib/db.ts
git commit -m "feat(db): add faq_versions table and version tracking fields"
```

---

## Task 2: 版本化写入逻辑 — 更新答案时自动创建版本

**Files:**
- Modify: `lib/db.ts:174-230` (updateFaqStatus function)
- Create: `lib/db.ts` (新增 createVersion, getVersions, getVersionById 函数)

**Step 1: 新增版本相关的数据库函数**

在 `lib/db.ts` 的 `rowToFaqItem` 函数之后（约 line 287）添加：

```typescript
export interface DBFaqVersion {
  id: number;
  faq_id: number;
  version: number;
  answer: string;
  answer_brief: string | null;
  answer_en: string | null;
  answer_brief_en: string | null;
  change_reason: string | null;
  created_at: Date;
}

export async function createVersion(
  faqId: number,
  version: number,
  data: { answer: string; answer_brief?: string | null; answer_en?: string | null; answer_brief_en?: string | null; change_reason?: string }
): Promise<number> {
  await ensureSchema();
  const result = await sql`
    INSERT INTO faq_versions (faq_id, version, answer, answer_brief, answer_en, answer_brief_en, change_reason)
    VALUES (${faqId}, ${version}, ${data.answer}, ${data.answer_brief ?? null}, ${data.answer_en ?? null}, ${data.answer_brief_en ?? null}, ${data.change_reason ?? null})
    RETURNING id
  `;
  return result.rows[0].id as number;
}

export async function getVersionsByFaqId(faqId: number): Promise<DBFaqVersion[]> {
  await ensureSchema();
  const result = await sql`
    SELECT * FROM faq_versions WHERE faq_id = ${faqId} ORDER BY version DESC
  `;
  return result.rows.map(row => ({
    id: row.id as number,
    faq_id: row.faq_id as number,
    version: row.version as number,
    answer: row.answer as string,
    answer_brief: (row.answer_brief as string | null) ?? null,
    answer_en: (row.answer_en as string | null) ?? null,
    answer_brief_en: (row.answer_brief_en as string | null) ?? null,
    change_reason: (row.change_reason as string | null) ?? null,
    created_at: new Date(row.created_at as string),
  }));
}

export async function getVersionVoteCounts(versionId: number): Promise<{ upvote_count: number; downvote_count: number }> {
  await ensureSchema();
  const result = await sql`
    SELECT
      COALESCE(SUM(CASE WHEN vote_type = 'upvote' THEN weight ELSE 0 END), 0) as upvote_count,
      COALESCE(SUM(CASE WHEN vote_type = 'downvote' THEN weight ELSE 0 END), 0) as downvote_count
    FROM faq_votes
    WHERE version_id = ${versionId}
  `;
  return {
    upvote_count: Number(result.rows[0].upvote_count),
    downvote_count: Number(result.rows[0].downvote_count),
  };
}
```

**Step 2: 修改 `updateFaqStatus` 支持版本创建**

在 `lib/db.ts:192`，`if (data?.answer !== undefined)` 分支内，在执行 UPDATE 之前，插入版本归档逻辑：

```typescript
  if (data?.answer !== undefined) {
    // Archive current answer as a version before overwriting
    const current = await getFaqItemById(id);
    if (current && current.answer) {
      await createVersion(id, current.current_version, {
        answer: current.answer,
        answer_brief: current.answer_brief,
        answer_en: current.answer_en,
        answer_brief_en: current.answer_brief_en,
        change_reason: data.change_reason,
      });
    }

    const newVersion = (current?.current_version ?? 1) + 1;
    // ... existing UPDATE SQL, but add:
    //   current_version = ${newVersion},
    //   last_updated_at = NOW(),
```

需要在 `updateFaqStatus` 的 `data` 参数类型中添加 `change_reason?: string`。

在 UPDATE SQL（line 195-210）中添加两个字段：

```sql
      current_version = ${newVersion},
      last_updated_at = NOW(),
```

**Step 3: 验证**

手动测试：通过 admin API 更新一条 FAQ 的 answer，检查 `faq_versions` 表是否有记录。

**Step 4: Commit**

```bash
git add lib/db.ts
git commit -m "feat(db): auto-create version on answer update"
```

---

## Task 3: 投票绑定版本

**Files:**
- Modify: `lib/db.ts:293-374` (castVote, castVoteAuth functions)
- Modify: `app/api/faq/[id]/vote/route.ts`

**Step 1: 修改 `castVoteAuth` 接受 `versionId` 参数**

在 `lib/db.ts` 的 `castVoteAuth` 函数签名中添加 `versionId?: number` 参数，并在 INSERT SQL 中包含 `version_id`。

**Step 2: 修改 `castVote` 同理**

匿名投票也传入 `versionId`。

**Step 3: 修改投票 API route**

在 `app/api/faq/[id]/vote/route.ts` 中，投票前先查询 FAQ 的 `current_version`，获取对应的 `faq_versions.id`，传给 castVote/castVoteAuth。

对于 `current_version = 1` 且 `faq_versions` 中无记录的情况（从未更新过的 FAQ），`version_id` 传 NULL。

**Step 4: Commit**

```bash
git add lib/db.ts app/api/faq/[id]/vote/route.ts
git commit -m "feat(vote): bind votes to answer version"
```

---

## Task 4: 用户 Tier 系统

**Files:**
- Modify: `types/next-auth.d.ts`
- Modify: `auth.ts`
- Modify: `lib/db.ts` (initDB — 新增 users 表)
- Modify: `middleware.ts`

**Step 1: 新增 `users` 表**

在 `lib/db.ts` initDB 中添加：

```typescript
  // Users table for tier persistence
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,  -- GitHub user ID
      login       TEXT,              -- GitHub username
      tier        VARCHAR(20) DEFAULT 'free',
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;
```

**Step 2: 扩展 NextAuth 类型**

`types/next-auth.d.ts` 添加 `tier: "free" | "premium"` 到 Session.user 和 JWT。

**Step 3: 修改 `auth.ts` callbacks**

在 `jwt` callback 中：首次登录时 upsert `users` 表，读取 tier。
在 `session` callback 中：暴露 `tier` 到 session。

```typescript
jwt({ token, profile }) {
  if (profile?.id) {
    token.githubId = String(profile.id);
    token.role = adminIds.includes(String(profile.id)) ? "admin" : "user";
    // tier will be loaded from DB on first sign-in via signIn callback
  }
  return token;
},
```

需要添加 `signIn` callback 或 `jwt` callback 中查询 DB 获取 tier。

**Step 4: Admin API 设置用户 tier**

新建 `app/api/admin/users/[id]/route.ts`：

```typescript
// PATCH /api/admin/users/:id — set tier
export async function PATCH(request, { params }) {
  // verify admin
  // update users table SET tier = body.tier WHERE id = params.id
}
```

**Step 5: Commit**

```bash
git add types/next-auth.d.ts auth.ts lib/db.ts middleware.ts app/api/admin/users/
git commit -m "feat(auth): add user tier system (free/premium)"
```

---

## Task 5: 版本历史 API

**Files:**
- Create: `app/api/faq/[id]/versions/route.ts`
- Create: `app/api/faq/[id]/versions/[version]/route.ts`

**Step 1: 版本列表 API**

`GET /api/faq/[id]/versions` — 需要 Premium 或 Admin 权限。

```typescript
import { auth } from "@/auth";
import { getVersionsByFaqId, getVersionVoteCounts } from "@/lib/db";

export async function GET(request, { params }) {
  const session = await auth();
  if (!session?.user || (session.user.tier !== "premium" && session.user.role !== "admin")) {
    return NextResponse.json({ error: "Premium required" }, { status: 403 });
  }
  const { id } = await params;
  const versions = await getVersionsByFaqId(parseInt(id));
  // For each version, attach vote counts
  const versionsWithVotes = await Promise.all(
    versions.map(async (v) => ({
      ...v,
      votes: await getVersionVoteCounts(v.id),
    }))
  );
  return NextResponse.json(versionsWithVotes);
}
```

**Step 2: 单版本详情 API**

`GET /api/faq/[id]/versions/[version]` — 同样需要 Premium/Admin。

**Step 3: Commit**

```bash
git add app/api/faq/[id]/versions/
git commit -m "feat(api): add version history endpoints"
```

---

## Task 6: 本地同步工具 — pull.ts

**Files:**
- Create: `tools/faq-sync/pull.ts`
- Modify: `.gitignore` (添加 `data/faq-sync/`)
- Modify: `package.json` (添加 scripts)

**Step 1: 添加 gitignore 和 package.json scripts**

`.gitignore` 添加：
```
data/faq-sync/
```

`package.json` scripts 添加：
```json
"faq:pull": "npx tsx -r ./scripts/env-loader.js tools/faq-sync/pull.ts",
"faq:push": "npx tsx -r ./scripts/env-loader.js tools/faq-sync/push.ts",
"faq:evaluate": "npx tsx -r ./scripts/env-loader.js tools/faq-sync/evaluate.ts"
```

**Step 2: 创建 `tools/faq-sync/pull.ts`**

参考 `scripts/migrate-content.ts` 的模式。解析命令行参数：

```typescript
import { sql } from "@vercel/postgres";
import { initDB } from "../../lib/db";
import * as fs from "fs";
import * as path from "path";

const OUTPUT_DIR = path.resolve(__dirname, "../../data/faq-sync");

async function main() {
  await initDB();
  const args = process.argv.slice(2);

  let query = `SELECT f.*,
    COALESCE(SUM(CASE WHEN v.vote_type='upvote' THEN v.weight ELSE 0 END), 0) as up,
    COALESCE(SUM(CASE WHEN v.vote_type='downvote' THEN v.weight ELSE 0 END), 0) as down
    FROM faq_items f LEFT JOIN faq_votes v ON f.id = v.faq_id`;
  let where: string[] = [];

  if (args.includes("--flagged")) {
    // downvote > upvote (weighted)
    where.push("HAVING SUM(CASE WHEN v.vote_type='downvote' THEN v.weight ELSE 0 END) > SUM(CASE WHEN v.vote_type='upvote' THEN v.weight ELSE 0 END)");
  }
  // --ids, --status, --all parsing...

  // Write each FAQ to individual JSON file
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  for (const row of results.rows) {
    const filePath = path.join(OUTPUT_DIR, `${row.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(mapToSyncFormat(row), null, 2));
  }
  console.log(`Pulled ${results.rows.length} items to ${OUTPUT_DIR}`);
}
```

完整实现需要处理 `--all`、`--flagged`、`--ids`、`--status` 四种参数，以及 downvote_reasons 的聚合查询。

**Step 3: 测试**

Run: `npm run faq:pull -- --all`
Expected: `data/faq-sync/` 下生成 JSON 文件

**Step 4: Commit**

```bash
git add tools/faq-sync/pull.ts .gitignore package.json
git commit -m "feat(sync): add pull.ts for DB-to-local export"
```

---

## Task 7: 本地同步工具 — push.ts

**Files:**
- Create: `tools/faq-sync/push.ts`

**Step 1: 创建 push.ts**

```typescript
import { sql } from "@vercel/postgres";
import { initDB, getFaqItemById, createVersion } from "../../lib/db";
import * as fs from "fs";
import * as path from "path";

const SYNC_DIR = path.resolve(__dirname, "../../data/faq-sync");

async function main() {
  await initDB();
  const files = fs.readdirSync(SYNC_DIR).filter(f => f.endsWith(".json") && !f.startsWith("_"));
  let updated = 0, skipped = 0;

  for (const file of files) {
    const local = JSON.parse(fs.readFileSync(path.join(SYNC_DIR, file), "utf-8"));
    const current = await getFaqItemById(local.id);
    if (!current) { console.log(`Skip ${local.id}: not found in DB`); skipped++; continue; }

    // Compare answer content
    if (current.answer === local.answer) { skipped++; continue; }

    // Archive old version
    await createVersion(local.id, current.current_version, {
      answer: current.answer!,
      answer_brief: current.answer_brief,
      answer_en: current.answer_en,
      answer_brief_en: current.answer_brief_en,
      change_reason: local._change_reason ?? "sync update",
    });

    // Update faq_items with new content + bump version
    const newVersion = current.current_version + 1;
    await sql`
      UPDATE faq_items SET
        answer = ${local.answer},
        answer_brief = ${local.answer_brief ?? null},
        answer_en = ${local.answer_en ?? null},
        answer_brief_en = ${local.answer_brief_en ?? null},
        tags = ${`{${(local.tags ?? []).map((t: string) => `"${t}"`).join(",")}}`}::text[],
        categories = ${`{${(local.categories ?? []).map((c: string) => `"${c}"`).join(",")}}`}::text[],
        current_version = ${newVersion},
        last_updated_at = NOW(),
        updated_at = NOW()
      WHERE id = ${local.id}
    `;
    updated++;
    console.log(`Updated #${local.id} → version ${newVersion}`);
  }

  console.log(`Done: ${updated} updated, ${skipped} skipped`);
}

main().catch(console.error).finally(() => process.exit());
```

**Step 2: 测试**

手动修改一个 `data/faq-sync/X.json` 的 answer 字段，运行 `npm run faq:push`，验证 DB 中 `faq_versions` 有新记录且 `faq_items.current_version` 递增。

**Step 3: Commit**

```bash
git add tools/faq-sync/push.ts
git commit -m "feat(sync): add push.ts for local-to-DB sync with versioning"
```

---

## Task 8: 本地同步工具 — evaluate.ts

**Files:**
- Create: `tools/faq-sync/evaluate.ts`

**Step 1: 创建 evaluate.ts**

调用 AI API（与 `lib/ai.ts` 中的模式一致），按 faq-judge skill 的评分标准批量评估。

```typescript
import * as fs from "fs";
import * as path from "path";

const SYNC_DIR = path.resolve(__dirname, "../../data/faq-sync");
const API_BASE = process.env.AI_API_BASE_URL ?? "https://api.openai.com/v1";
const API_KEY = process.env.AI_API_KEY!;
const MODEL = process.env.AI_MODEL ?? "gpt-4o";

async function main() {
  const files = fs.readdirSync(SYNC_DIR).filter(f => f.endsWith(".json") && !f.startsWith("_"));
  const results: any[] = [];

  for (const file of files) {
    const qa = JSON.parse(fs.readFileSync(path.join(SYNC_DIR, file), "utf-8"));
    const score = await judgeQA(qa.question, qa.answer);
    results.push({ id: qa.id, file, ...score });
  }

  // Write report
  const report = {
    evaluated_at: new Date().toISOString(),
    total: results.length,
    passed: results.filter(r => r.verdict === "pass").length,
    failed: results.filter(r => r.verdict === "fail").length,
    results,
  };
  fs.writeFileSync(path.join(SYNC_DIR, "_report.json"), JSON.stringify(report, null, 2));
  console.log(`Evaluated ${report.total}: ${report.passed} passed, ${report.failed} failed`);
  console.log(`Report: data/faq-sync/_report.json`);
}
```

`judgeQA` 函数使用 faq-judge skill 中定义的 system prompt template 调用 AI API。

**Step 2: 测试**

Run: `npm run faq:evaluate`
Expected: `data/faq-sync/_report.json` 生成，包含每条 QA 的 10 维度评分

**Step 3: Commit**

```bash
git add tools/faq-sync/evaluate.ts
git commit -m "feat(sync): add evaluate.ts for batch FAQ quality assessment"
```

---

## Task 9: 工作流文档 — README.md

**Files:**
- Create: `tools/faq-sync/README.md`

**Step 1: 编写 README**

内容包括：
1. 概述：双向同步工作流
2. 前置条件：`.env.local` 配置 `POSTGRES_URL`、`AI_API_KEY` 等
3. 命令说明：`npm run faq:pull`、`npm run faq:push`、`npm run faq:evaluate`
4. 完整工作流示例（4 步）
5. JSON 文件格式说明
6. 与 Claude Code Skills 配合使用说明（`/faq-judge` 批量评估、`/faq-generator` 改写模式）
7. 注意事项：push 会自动创建版本、清空当前版本投票等

**Step 2: Commit**

```bash
git add tools/faq-sync/README.md
git commit -m "docs: add faq-sync workflow README"
```

---

## Task 10: Skills 增强 — faq-judge 批量模式 + faq-generator 改写模式

**Files:**
- Modify: `.claude/skills/faq-judge/SKILL.md`
- Modify: `.claude/skills/faq-generator/SKILL.md`

**Step 1: faq-judge 添加批量模式说明**

在 SKILL.md 中添加 `## Batch Mode` 章节：
- 当用户指定 `data/faq-sync/` 目录时，自动读取所有 JSON 文件
- 逐条评分，输出汇总报告
- 标记 fail 的条目，给出改进建议

**Step 2: faq-generator 添加改写模式说明**

在 SKILL.md 中添加 `## Rewrite Mode` 章节：
- 输入：一条现有 QA 的 JSON 文件路径 + judge 的改进建议
- 输出：改进后的 QA，直接写回 JSON 文件
- 保留原始 question（除非 scenario_completeness 不达标需要补充场景）

**Step 3: Commit**

```bash
git add .claude/skills/faq-judge/SKILL.md .claude/skills/faq-generator/SKILL.md
git commit -m "feat(skills): add batch mode to faq-judge and rewrite mode to faq-generator"
```

---

## Task 11: 前端 — 30 天更新标记 + 版本历史按钮

**Files:**
- Modify: `src/types/faq.ts` (FAQItem 接口添加 currentVersion, lastUpdatedAt)
- Modify: `components/FAQItem.tsx` (添加更新标记 + 查看历史按钮)
- Modify: `lib/db.ts:257-286` (rowToFaqItem 映射到前端类型时包含新字段)

**Step 1: 扩展 FAQItem 类型**

`src/types/faq.ts` 添加：
```typescript
  currentVersion?: number;
  lastUpdatedAt?: string;  // ISO string
```

**Step 2: 在 FAQItem 组件中添加更新标记**

在 `components/FAQItem.tsx` 的问题标题区域（约 line 163-212），添加：
- 判断 `lastUpdatedAt` 是否在 30 天内且 `currentVersion > 1`
- 显示"已更新"小标记
- 添加"查看历史版本"按钮
- Free 用户点击弹出升级提示
- Premium 用户点击展开版本选择器（调用 `/api/faq/[id]/versions`）

**Step 3: Commit**

```bash
git add src/types/faq.ts components/FAQItem.tsx lib/db.ts
git commit -m "feat(ui): add 30-day update badge and version history button"
```

---

## Task 12: Admin 后台 — 版本历史管理面板

**Files:**
- Modify: admin FAQ 管理页面（具体路径需确认）

**Step 1: 在 admin FAQ 详情中添加版本历史 tab**

显示：
- 所有版本列表（版本号、创建时间、change_reason）
- 每个版本的投票分布（upvote/downvote 数量）
- downvote 原因统计
- 可展开查看该版本的完整答案内容

**Step 2: Commit**

```bash
git add app/admin/
git commit -m "feat(admin): add version history panel with vote distribution"
```
