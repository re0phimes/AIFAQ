# User Preferences Unification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 统一偏好来源（未登录 localStorage、登录 DB）、新增“我的关注（大标签）”过滤、并实现登录导入本地偏好且避免重复提示覆盖。

**Architecture:** 新增 `user_preferences` 作为偏好真相层，保留 `users` 仅存账号基础信息。客户端通过统一偏好模型 `aifaq-prefs-v2` + `aifaq-prefs-sync-v2` 执行登录对齐与冲突检测。主页把“我的收藏”改为“我的关注”，按关注大标签与手动筛选取交集；关注为空时引导跳转 profile 设置。

**Tech Stack:** Next.js 16, React 19, TypeScript, @vercel/postgres, node:test, ESLint

---

### Task 1: 建立偏好同步规则单测（先红）

**Files:**
- Create: `lib/preferences-sync.ts`
- Create: `lib/preferences-sync.test.ts`
- Test: `lib/preferences-sync.test.ts`

**Step 1: Write the failing test**

在 `lib/preferences-sync.test.ts` 增加以下测试（先引用未实现函数）：

```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPrefsHash,
  buildConflictKey,
  mergePreferences,
  shouldPromptImport,
} from "./preferences-sync";

test("mergePreferences unions focus categories and dedupes", () => {
  const merged = mergePreferences(
    { focusCategories: ["深度学习", "生成式 AI / LLM"], updatedAt: "2026-03-03T00:00:00.000Z" },
    { focusCategories: ["深度学习", "机器学习基础"], updatedAt: "2026-03-02T00:00:00.000Z" }
  );
  assert.deepEqual(merged.focusCategories.sort(), ["生成式 AI / LLM", "机器学习基础", "深度学习"].sort());
});
```

**Step 2: Run test to verify it fails**

Run: `npx tsx --test lib/preferences-sync.test.ts`

Expected: FAIL（模块或函数不存在）。

**Step 3: Write minimal implementation**

在 `lib/preferences-sync.ts` 先实现最小类型与函数壳：

```ts
export function mergePreferences(local: PartialPrefs, server: PartialPrefs): PartialPrefs {
  const union = Array.from(new Set([...(local.focusCategories ?? []), ...(server.focusCategories ?? [])]));
  return { ...server, ...local, focusCategories: union };
}
```

并补 `buildPrefsHash` / `buildConflictKey` / `shouldPromptImport` 的最小实现。

**Step 4: Run test to verify it passes**

Run: `npx tsx --test lib/preferences-sync.test.ts`

Expected: PASS。

**Step 5: Commit**

```bash
git add lib/preferences-sync.ts lib/preferences-sync.test.ts
git commit -m "test: add preference sync conflict and merge rules"
```

### Task 2: 扩展 DB schema 与偏好访问层

**Files:**
- Modify: `lib/db.ts`
- Test: `lib/db.ts`

**Step 1: Write the failing test**

先执行 schema smoke（应因表/字段未就绪失败）：

```bash
@'
import { sql } from "@vercel/postgres";
const r = await sql.query("SELECT focus_categories FROM user_preferences LIMIT 1");
console.log(r.rows.length);
'@ | npx tsx -r ./scripts/env-loader.js
```

Expected: FAIL（`relation "user_preferences" does not exist`）。

**Step 2: Write minimal implementation**

在 `initDB()` 中添加：

```ts
await sql`
  CREATE TABLE IF NOT EXISTS user_preferences (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    language VARCHAR(5),
    page_size INTEGER,
    default_detailed BOOLEAN,
    focus_categories TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )
`;
```

并新增 DB helpers：

```ts
export async function getUserPreferences(userId: string): Promise<UserPreferencesDB | null> { ... }
export async function upsertUserPreferences(userId: string, patch: UserPreferencesPatch): Promise<UserPreferencesDB> { ... }
export async function importUserPreferences(userId: string, local: UserPreferencesPatch): Promise<UserPreferencesDB> { ... }
```

**Step 3: Run smoke to verify it passes**

Run:

```bash
@'
import { initDB, upsertUserPreferences, getUserPreferences } from "./lib/db";
await initDB();
await upsertUserPreferences("44431261", { language: "zh", page_size: 20, default_detailed: false, focus_categories: ["深度学习"] });
console.log(await getUserPreferences("44431261"));
'@ | npx tsx -r ./scripts/env-loader.js
```

Expected: 输出包含 `focus_categories` 与 `updated_at`。

**Step 4: Run targeted lint**

Run: `npx eslint lib/db.ts`

Expected: PASS（无 error）。

**Step 5: Commit**

```bash
git add lib/db.ts
git commit -m "feat: add user_preferences schema and db accessors"
```

### Task 3: 新增用户偏好读取/更新 API

**Files:**
- Create: `app/api/user/preferences/route.ts`
- Test: `app/api/user/preferences/route.ts`

**Step 1: Write the failing test**

调用不存在接口：

Run: `curl -i http://localhost:3000/api/user/preferences`

Expected: FAIL（404）。

**Step 2: Write minimal implementation**

实现 `GET` + `PATCH`：

```ts
export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const prefs = await getUserPreferences(session.user.id);
  return NextResponse.json(normalizePrefs(prefs));
}
```

```ts
export async function PATCH(req: Request) {
  // validate language/page_size/default_detailed/focus_categories
  // whitelist focus_categories against data/tag-taxonomy.json
}
```

**Step 3: Run route checks**

Run:

```bash
npm run dev
curl -i http://localhost:3000/api/user/preferences
```

Expected: 未登录返回 401；登录后返回 JSON 偏好。

**Step 4: Run targeted lint**

Run: `npx eslint app/api/user/preferences/route.ts`

Expected: PASS。

**Step 5: Commit**

```bash
git add app/api/user/preferences/route.ts
git commit -m "feat: add user preferences get and patch api"
```

### Task 4: 新增导入 API（防重复冲突提示）

**Files:**
- Create: `app/api/user/preferences/import/route.ts`
- Modify: `lib/preferences-sync.ts`
- Test: `lib/preferences-sync.test.ts`

**Step 1: Write the failing test**

在 `lib/preferences-sync.test.ts` 新增：

```ts
test("shouldPromptImport suppresses same dismissed conflict key", () => {
  const localHash = "L1";
  const serverHash = "S1";
  const key = buildConflictKey("u1", localHash, serverHash);
  const should = shouldPromptImport({
    hasLocalPrefs: true,
    localHash,
    serverHash,
    dismissedConflictKey: key,
    localHasUnsyncedChanges: true,
  });
  assert.equal(should, false);
});
```

**Step 2: Run test to verify it fails**

Run: `npx tsx --test lib/preferences-sync.test.ts`

Expected: FAIL。

**Step 3: Write minimal implementation**

1. 完善 `shouldPromptImport()` 规则。  
2. 实现 `POST /api/user/preferences/import`：读取 local snapshot，调用 DB import merge，返回 merged prefs。

**Step 4: Run tests**

Run:

```bash
npx tsx --test lib/preferences-sync.test.ts
npx eslint app/api/user/preferences/import/route.ts lib/preferences-sync.ts
```

Expected: PASS。

**Step 5: Commit**

```bash
git add app/api/user/preferences/import/route.ts lib/preferences-sync.ts lib/preferences-sync.test.ts
git commit -m "feat: add preference import api with conflict suppression rules"
```

### Task 5: 主页偏好统一 + 登录导入流

**Files:**
- Modify: `app/FAQPage.tsx`
- Modify: `lib/i18n.ts`
- Test: `app/FAQPage.tsx`

**Step 1: Write the failing test**

启动后手动验证（先失败场景）：

1. 未登录修改本地偏好；
2. 登录后没有导入提示或反复提示；
3. 偏好未按 DB 对齐。

Expected: 当前行为不满足。

**Step 2: Write minimal implementation**

在 `FAQPage` 中加入：

```ts
const LS_PREFS = "aifaq-prefs-v2";
const LS_PREFS_SYNC = "aifaq-prefs-sync-v2";
```

并实现：

1. 未登录读取/写入本地偏好；
2. 登录后 `GET /api/user/preferences`；
3. 使用 `shouldPromptImport` 决定是否 `window.confirm`；
4. 确认导入时 `POST /api/user/preferences/import`；
5. 更新 `aifaq-prefs-sync-v2`，避免同冲突反复弹；
6. 传递 `focusCategories` 给 `FAQList`。

**Step 3: Run lint**

Run: `npx eslint app/FAQPage.tsx`

Expected: PASS。

**Step 4: Manual verification**

Run: `npm run dev`

Expected:
1. 登录时只在新冲突弹导入；
2. “暂不导入”后同冲突不再弹；
3. 改本地后再登录可再次提示。

**Step 5: Commit**

```bash
git add app/FAQPage.tsx
git commit -m "feat: unify home preference flow with login import prompt"
```

### Task 6: FAQ 列表改“我的关注”并实现交集过滤

**Files:**
- Modify: `components/FAQList.tsx`
- Modify: `lib/i18n.ts`
- Test: `components/FAQList.tsx`

**Step 1: Write the failing test**

手动构造场景：
1. 有 focus categories；
2. 开启“我的关注”；
3. 再加手动 category/tag 筛选。

Expected: 当前不是完整交集行为（且文案为“我的收藏”）。

**Step 2: Write minimal implementation**

1. `showFavoritesOnly` 重命名为 `showFocusOnly`。  
2. 接收 `focusCategories: string[]`（来自父组件）。  
3. 过滤逻辑：

```ts
if (showFocusOnly) {
  result = result.filter((item) => item.categories?.some((c) => focusCategoriesSet.has(c)));
}
```

4. 与现有搜索/标签/分类保持同一管道（自然形成交集）。
5. 关注为空点击时提示并跳转 `/profile`。
6. 文案替换：`myFavorites` -> `myFocus`。

**Step 3: Run lint**

Run:

```bash
npx eslint components/FAQList.tsx lib/i18n.ts
```

Expected: PASS。

**Step 4: Manual verification**

Run: `npm run dev`

Expected:
1. 按钮文案为“我的关注”；
2. 关注为空时给出跳转；
3. 开启后与手动筛选是交集。

**Step 5: Commit**

```bash
git add components/FAQList.tsx lib/i18n.ts
git commit -m "feat: replace favorites filter with focus filter intersection"
```

### Task 7: Profile 设置页支持大标签关注

**Files:**
- Modify: `app/profile/ProfileClient.tsx`
- Modify: `app/profile/page.tsx`
- Modify: `data/tag-taxonomy.json` (read-only import)
- Test: `app/profile/ProfileClient.tsx`

**Step 1: Write the failing test**

手动验证当前 `/profile` 设置页：无“大标签关注”编辑能力。

Expected: FAIL（缺失功能）。

**Step 2: Write minimal implementation**

1. 在 `SettingsTab` 引入 taxonomy categories 多选 UI。  
2. 登录态初始化时从 `GET /api/user/preferences` 拉取 focus categories。  
3. 变更时调用 `PATCH /api/user/preferences`。  
4. 同步写入 `aifaq-prefs-v2`，保持登录/退出行为一致。

示例更新：

```ts
await fetch("/api/user/preferences", {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ focus_categories: nextCategories }),
});
```

**Step 3: Run lint**

Run: `npx eslint app/profile/ProfileClient.tsx app/profile/page.tsx`

Expected: PASS。

**Step 4: Manual verification**

Run: `npm run dev`

Expected: 在 profile 设置中可选择并保存大标签关注，刷新后仍保留。

**Step 5: Commit**

```bash
git add app/profile/ProfileClient.tsx app/profile/page.tsx
git commit -m "feat: add profile focus category preferences"
```

### Task 8: 语言偏好统一与兼容迁移

**Files:**
- Modify: `app/FAQPage.tsx`
- Modify: `app/profile/page.tsx`
- Modify: `app/faq/[id]/page.tsx`
- Test: `app/profile/page.tsx`

**Step 1: Write the failing test**

当前登录用户语言仍依赖 cookie，和 DB 偏好不一致。

Expected: FAIL（不符合“登录用 DB 偏好”）。

**Step 2: Write minimal implementation**

1. 登录用户优先读 `user_preferences.language`。  
2. 未登录继续读 local/cookie fallback。  
3. 保留旧 key 兼容读取并迁移进 `aifaq-prefs-v2`。  
4. 不再依赖 `aifaq-lang` cookie 作为登录用户主来源。

**Step 3: Run checks**

Run:

```bash
npx eslint app/FAQPage.tsx app/profile/page.tsx app/faq/[id]/page.tsx
npm run lint
npm run build
```

Expected: 全部通过。

**Step 4: Final manual checklist**

Run: `npm run dev`

Expected:
1. 未登录：localStorage 偏好生效；
2. 登录：DB 偏好生效；
3. 退出后本地偏好继续生效；
4. 登录导入流程无重复提示。

**Step 5: Commit**

```bash
git add app/FAQPage.tsx app/profile/page.tsx app/faq/[id]/page.tsx
git commit -m "fix: align language preference source with authenticated db settings"
```

---

## Notes For Execution

1. 全流程按 @test-driven-development 执行：先失败，再最小实现，再通过。
2. 任一步出现异常行为先走 @systematic-debugging，不要直接猜改。
3. 完成前按 @verification-before-completion 复核所有命令输出后再宣告完成。
4. 如需在本会话执行，使用 @subagent-driven-development；如开新会话批量执行，使用 @executing-plans。
