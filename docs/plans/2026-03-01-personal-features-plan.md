# Personal Features (Phase 1) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add learning progress tracking and personal profile page to AIFAQ

**Architecture:** Extend user_favorites table with learning status fields, create /profile page with grouped favorites list, add /faq/[id] detail page with auto-status tracking

**Tech Stack:** Next.js 14 App Router, PostgreSQL (Vercel Postgres), NextAuth.js, TypeScript, Tailwind CSS

---

## Task 1: Database Migration

**Files:**
- Modify: `lib/db.ts` (add migration in initDB function)

**Step 1: Add migration SQL to initDB**

Add after line 146 (after user_favorites table creation):

```typescript
// Learning progress tracking columns
await sql`ALTER TABLE user_favorites ADD COLUMN IF NOT EXISTS learning_status VARCHAR(20) DEFAULT 'unread'`;
await sql`ALTER TABLE user_favorites ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ`;
await sql`ALTER TABLE user_favorites ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`;
```

**Step 2: Test migration locally**

Run: `npm run dev`
Expected: Server starts without errors, migration runs successfully

**Step 3: Commit**

```bash
git add lib/db.ts
git commit -m "feat(db): add learning status fields to user_favorites"
```

---

## Task 2: API - Get User Favorites with Stats

**Files:**
- Create: `app/api/user/favorites/route.ts`

**Step 1: Create API route file**

```typescript
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { sql } from "@vercel/postgres";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sql`
      SELECT
        uf.faq_id,
        uf.learning_status,
        uf.created_at,
        uf.last_viewed_at,
        uf.updated_at,
        fi.question,
        fi.question_en,
        fi.answer,
        fi.answer_brief,
        fi.answer_en,
        fi.answer_brief_en,
        fi.tags,
        fi.difficulty,
        fi.date
      FROM user_favorites uf
      LEFT JOIN faq_items fi ON uf.faq_id = fi.id
      WHERE uf.user_id = ${session.user.id}
      ORDER BY uf.created_at DESC
    `;

    const favorites = result.rows.map(row => ({
      faq_id: row.faq_id,
      learning_status: row.learning_status,
      created_at: row.created_at,
      last_viewed_at: row.last_viewed_at,
      faq: {
        id: row.faq_id,
        question: row.question,
        questionEn: row.question_en,
        answer: row.answer,
        answerBrief: row.answer_brief,
        answerEn: row.answer_en,
        answerBriefEn: row.answer_brief_en,
        tags: row.tags,
        difficulty: row.difficulty,
        date: row.date,
      }
    }));

    // Calculate stats
    const total = favorites.length;
    const unread = favorites.filter(f => f.learning_status === 'unread').length;
    const learning = favorites.filter(f => f.learning_status === 'learning').length;
    const mastered = favorites.filter(f => f.learning_status === 'mastered').length;

    // Calculate stale (90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const stale = favorites.filter(f =>
      f.learning_status === 'unread' &&
      new Date(f.created_at) < ninetyDaysAgo
    ).length;

    return NextResponse.json({
      favorites,
      stats: { total, unread, learning, mastered, stale }
    });
  } catch (error) {
    console.error("Failed to fetch favorites:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Step 2: Test API endpoint**

Run: `npm run dev`
Test: `curl http://localhost:3000/api/user/favorites` (should return 401 if not logged in)

**Step 3: Commit**

```bash
git add app/api/user/favorites/route.ts
git commit -m "feat(api): add endpoint to get user favorites with stats"
```

---

## Task 3: API - Update Learning Status

**Files:**
- Create: `app/api/favorites/[id]/status/route.ts`

**Step 1: Create API route file**

```typescript
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { sql } from "@vercel/postgres";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const faqId = parseInt(params.id);
  if (isNaN(faqId)) {
    return NextResponse.json({ error: "Invalid FAQ ID" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { status } = body;

    if (!['learning', 'mastered'].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const updateFields: string[] = [`learning_status = '${status}'`, `updated_at = NOW()`];
    if (status === 'learning') {
      updateFields.push(`last_viewed_at = NOW()`);
    }

    await sql.query(
      `UPDATE user_favorites
       SET ${updateFields.join(', ')}
       WHERE user_id = $1 AND faq_id = $2`,
      [session.user.id, faqId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update status:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Step 2: Test API endpoint**

Run: `npm run dev`
Test: `curl -X PATCH http://localhost:3000/api/favorites/1/status -d '{"status":"learning"}'`

**Step 3: Commit**

```bash
git add app/api/favorites/[id]/status/route.ts
git commit -m "feat(api): add endpoint to update learning status"
```

---

## Task 4: Profile Page - Server Component

**Files:**
- Create: `app/profile/page.tsx`

**Step 1: Create profile page**

```typescript
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import ProfileClient from "./ProfileClient";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/');
  }

  // Fetch favorites on server
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/user/favorites`, {
    headers: {
      cookie: `next-auth.session-token=${session.user.id}` // Simplified for demo
    },
    cache: 'no-store'
  });

  const data = await res.json();

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 md:max-w-4xl md:px-8 md:py-8">
      <ProfileClient
        favorites={data.favorites || []}
        stats={data.stats || { total: 0, unread: 0, learning: 0, mastered: 0, stale: 0 }}
      />
    </main>
  );
}
```

**Step 2: Test page renders**

Run: `npm run dev`
Navigate to: `http://localhost:3000/profile` (should redirect if not logged in)

**Step 3: Commit**

```bash
git add app/profile/page.tsx
git commit -m "feat(profile): add profile page server component"
```

---

## Task 5: Profile Page - Client Component (Part 1: Stats)

**Files:**
- Create: `app/profile/ProfileClient.tsx`

**Step 1: Create client component with stats cards**

```typescript
"use client";

import { useState } from "react";
import type { FAQItem } from "@/src/types/faq";

interface FavoriteItem {
  faq_id: number;
  learning_status: 'unread' | 'learning' | 'mastered';
  created_at: string;
  last_viewed_at: string | null;
  faq: FAQItem;
}

interface Stats {
  total: number;
  unread: number;
  learning: number;
  mastered: number;
  stale: number;
}

interface ProfileClientProps {
  favorites: FavoriteItem[];
  stats: Stats;
}

export default function ProfileClient({ favorites, stats }: ProfileClientProps) {
  const [showStaleReminder, setShowStaleReminder] = useState(stats.stale > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-brand text-3xl font-bold text-text">我的学习</h1>
        <p className="mt-1 text-sm text-subtext">追踪你的学习进度</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-2xl font-bold text-text">{stats.total}</div>
          <div className="text-xs text-subtext">总收藏</div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-2xl font-bold text-blue-600">{stats.learning}</div>
          <div className="text-xs text-subtext">学习中</div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-2xl font-bold text-green-600">{stats.mastered}</div>
          <div className="text-xs text-subtext">已内化</div>
        </div>
      </div>

      {/* Stale Reminder */}
      {showStaleReminder && stats.stale > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-center gap-2">
            <span className="text-amber-600">⚠️</span>
            <span className="text-sm text-amber-900">
              你有 {stats.stale} 个收藏超过90天未查看，建议删除
            </span>
          </div>
          <button
            onClick={() => setShowStaleReminder(false)}
            className="text-xs text-amber-600 hover:text-amber-800"
          >
            忽略
          </button>
        </div>
      )}

      {/* Placeholder for favorites list */}
      <div className="text-sm text-subtext">收藏列表将在下一步实现</div>
    </div>
  );
}
```

**Step 2: Test stats display**

Run: `npm run dev`
Navigate to: `http://localhost:3000/profile`
Expected: Stats cards display correctly

**Step 3: Commit**

```bash
git add app/profile/ProfileClient.tsx
git commit -m "feat(profile): add stats cards and stale reminder"
```

---

## Task 6: Profile Page - Client Component (Part 2: Favorites List)

**Files:**
- Modify: `app/profile/ProfileClient.tsx`

**Step 1: Add favorites list component**

Replace the placeholder div with:

```typescript
{/* Favorites List */}
{favorites.length === 0 ? (
  <div className="py-16 text-center">
    <p className="text-subtext">开始收藏你感兴趣的 FAQ 吧！</p>
  </div>
) : (
  <div className="space-y-4">
    {/* Unread Section */}
    {stats.unread > 0 && (
      <FavoritesSection
        title="📚 未看"
        count={stats.unread}
        items={favorites.filter(f => f.learning_status === 'unread')}
        onUpdateStatus={handleUpdateStatus}
      />
    )}

    {/* Learning Section */}
    {stats.learning > 0 && (
      <FavoritesSection
        title="📖 学习中"
        count={stats.learning}
        items={favorites.filter(f => f.learning_status === 'learning')}
        onUpdateStatus={handleUpdateStatus}
        showMasterButton
      />
    )}

    {/* Mastered Section */}
    {stats.mastered > 0 && (
      <FavoritesSection
        title="✅ 已内化"
        count={stats.mastered}
        items={favorites.filter(f => f.learning_status === 'mastered')}
        onUpdateStatus={handleUpdateStatus}
      />
    )}
  </div>
)}
```

Add handler function before return:

```typescript
const handleUpdateStatus = async (faqId: number, status: 'learning' | 'mastered') => {
  try {
    const res = await fetch(`/api/favorites/${faqId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      window.location.reload(); // Simple refresh for now
    }
  } catch (error) {
    console.error('Failed to update status:', error);
  }
};
```

**Step 2: Create FavoritesSection component**

Add at the end of the file:

```typescript
interface FavoritesSectionProps {
  title: string;
  count: number;
  items: FavoriteItem[];
  onUpdateStatus: (faqId: number, status: 'learning' | 'mastered') => void;
  showMasterButton?: boolean;
}

function FavoritesSection({ title, count, items, onUpdateStatus, showMasterButton }: FavoritesSectionProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-lg border border-border bg-surface">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-4 text-left hover:bg-bg"
      >
        <span className="font-medium text-text">
          {title} ({count})
        </span>
        <span className="text-subtext">{expanded ? '▼' : '▶'}</span>
      </button>

      {expanded && (
        <div className="border-t border-border p-4 space-y-2">
          {items.map(item => (
            <div key={item.faq_id} className="flex items-center justify-between py-2">
              <a
                href={`/faq/${item.faq_id}`}
                className="flex-1 text-sm text-text hover:text-primary"
              >
                {item.faq.question}
              </a>
              {showMasterButton && (
                <button
                  onClick={() => onUpdateStatus(item.faq_id, 'mastered')}
                  className="ml-4 rounded-full border border-green-500 px-3 py-1 text-xs text-green-600 hover:bg-green-50"
                >
                  标记为已内化
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 3: Test favorites list**

Run: `npm run dev`
Navigate to: `http://localhost:3000/profile`
Expected: Favorites grouped by status, collapsible sections

**Step 4: Commit**

```bash
git add app/profile/ProfileClient.tsx
git commit -m "feat(profile): add favorites list with status grouping"
```

---

## Task 7: FAQ Detail Page

**Files:**
- Create: `app/faq/[id]/page.tsx`

**Step 1: Create detail page**

```typescript
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getFaqItemById } from "@/lib/db";
import { sql } from "@vercel/postgres";
import FAQDetailClient from "./FAQDetailClient";

export default async function FAQDetailPage({ params }: { params: { id: string } }) {
  const faqId = parseInt(params.id);
  if (isNaN(faqId)) {
    notFound();
  }

  const faqItem = await getFaqItemById(faqId);
  if (!faqItem) {
    notFound();
  }

  const session = await getServerSession(authOptions);
  let isFavorited = false;
  let learningStatus: string | null = null;

  if (session?.user?.id) {
    // Check if favorited and get status
    const result = await sql`
      SELECT learning_status FROM user_favorites
      WHERE user_id = ${session.user.id} AND faq_id = ${faqId}
    `;

    if (result.rows.length > 0) {
      isFavorited = true;
      learningStatus = result.rows[0].learning_status as string;

      // Auto-update to 'learning' if currently 'unread'
      if (learningStatus === 'unread') {
        await sql`
          UPDATE user_favorites
          SET learning_status = 'learning', last_viewed_at = NOW(), updated_at = NOW()
          WHERE user_id = ${session.user.id} AND faq_id = ${faqId}
        `;
        learningStatus = 'learning';
      }
    }
  }

  const faq = {
    id: faqItem.id,
    question: faqItem.question,
    questionEn: faqItem.question_en ?? undefined,
    answer: faqItem.answer ?? faqItem.answer_raw,
    answerBrief: faqItem.answer_brief ?? undefined,
    answerEn: faqItem.answer_en ?? undefined,
    answerBriefEn: faqItem.answer_brief_en ?? undefined,
    tags: faqItem.tags,
    difficulty: faqItem.difficulty,
    date: faqItem.date,
    references: faqItem.references,
    images: faqItem.images,
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 md:max-w-4xl md:px-8 md:py-8">
      <FAQDetailClient
        faq={faq}
        isFavorited={isFavorited}
        learningStatus={learningStatus}
      />
    </main>
  );
}
```

**Step 2: Create client component**

Create `app/faq/[id]/FAQDetailClient.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import MarkdownContent from "@/components/MarkdownContent";
import type { FAQItem } from "@/src/types/faq";

interface FAQDetailClientProps {
  faq: FAQItem;
  isFavorited: boolean;
  learningStatus: string | null;
}

export default function FAQDetailClient({ faq, isFavorited, learningStatus }: FAQDetailClientProps) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);

  const handleMarkMastered = async () => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/favorites/${faq.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'mastered' })
      });
      if (res.ok) {
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-text">{faq.question}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            {faq.tags.map(tag => (
              <span key={tag} className="rounded-full bg-surface px-2 py-1 text-xs text-subtext">
                {tag}
              </span>
            ))}
          </div>
        </div>

        {isFavorited && learningStatus === 'learning' && (
          <button
            onClick={handleMarkMastered}
            disabled={updating}
            className="ml-4 rounded-full border border-green-500 px-4 py-2 text-sm text-green-600 hover:bg-green-50 disabled:opacity-50"
          >
            {updating ? '更新中...' : '标记为已内化'}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="prose prose-sm max-w-none">
        <MarkdownContent content={faq.answer} />
      </div>

      {/* Back button */}
      <div className="pt-4">
        <button
          onClick={() => router.back()}
          className="text-sm text-primary hover:underline"
        >
          ← 返回
        </button>
      </div>
    </div>
  );
}
```

**Step 3: Test detail page**

Run: `npm run dev`
Navigate to: `http://localhost:3000/faq/1`
Expected: FAQ content displays, auto-updates status if favorited

**Step 4: Commit**

```bash
git add app/faq/[id]/page.tsx app/faq/[id]/FAQDetailClient.tsx
git commit -m "feat(faq): add detail page with auto status tracking"
```

---

## Task 8: Add Profile Link to Header

**Files:**
- Modify: `components/FAQList.tsx:359-380`

**Step 1: Add profile link**

After the GitHub login/logout section (around line 380), add:

```typescript
{session?.user && (
  <>
    <span className="h-4 border-l border-border" />
    <a
      href="/profile"
      className="flex items-center gap-1.5 rounded-full border-[0.5px] border-border px-3 py-1.5 text-xs text-subtext hover:bg-surface"
    >
      我的学习
    </a>
  </>
)}
```

**Step 2: Test navigation**

Run: `npm run dev`
Expected: "我的学习" link appears when logged in, navigates to profile page

**Step 3: Commit**

```bash
git add components/FAQList.tsx
git commit -m "feat(ui): add profile link to header"
```

---

## Task 9: Add i18n Support

**Files:**
- Modify: `lib/i18n.ts`

**Step 1: Add translations**

Add to the translations object:

```typescript
myLearning: { zh: "我的学习", en: "My Learning" },
totalFavorites: { zh: "总收藏", en: "Total" },
learningStatus: { zh: "学习中", en: "Learning" },
masteredStatus: { zh: "已内化", en: "Mastered" },
unreadStatus: { zh: "未看", en: "Unread" },
staleReminder: { zh: "你有 {count} 个收藏超过90天未查看，建议删除", en: "You have {count} favorites unread for 90+ days" },
ignore: { zh: "忽略", en: "Ignore" },
markAsMastered: { zh: "标记为已内化", en: "Mark as Mastered" },
startCollecting: { zh: "开始收藏你感兴趣的 FAQ 吧！", en: "Start collecting FAQs you're interested in!" },
trackProgress: { zh: "追踪你的学习进度", en: "Track your learning progress" },
```

**Step 2: Update components to use i18n**

Update ProfileClient.tsx and FAQDetailClient.tsx to use `t()` function

**Step 3: Test translations**

Run: `npm run dev`
Switch language, verify all text translates correctly

**Step 4: Commit**

```bash
git add lib/i18n.ts app/profile/ProfileClient.tsx app/faq/[id]/FAQDetailClient.tsx
git commit -m "feat(i18n): add translations for profile features"
```

---

## Task 10: Testing & Verification

**Step 1: Manual testing checklist**

- [ ] Login with GitHub
- [ ] Favorite a FAQ from main page
- [ ] Navigate to /profile
- [ ] Verify FAQ appears in "未看" section
- [ ] Click FAQ to open detail page
- [ ] Verify status auto-updates to "学习中"
- [ ] Return to /profile
- [ ] Verify FAQ moved to "学习中" section
- [ ] Click "标记为已内化"
- [ ] Verify FAQ moved to "已内化" section
- [ ] Test with 90+ day old favorite (manually update DB)
- [ ] Verify stale reminder appears

**Step 2: Edge case testing**

- [ ] Test with no favorites (empty state)
- [ ] Test with deleted FAQ (should not crash)
- [ ] Test without login (should redirect)
- [ ] Test API errors (network failure)

**Step 3: Document any issues found**

Create GitHub issues for bugs discovered

---

## Completion Checklist

- [ ] All tasks completed
- [ ] Manual testing passed
- [ ] No console errors
- [ ] i18n working for zh/en
- [ ] Code committed with clear messages
- [ ] Ready for Phase 2 (followed tags, settings)

---

## Phase 2 Preview

**Next steps after Phase 1:**
1. Add user_followed_tags table
2. Implement tag following UI
3. Add personalized homepage sorting
4. Create /settings page
5. Migrate localStorage preferences to DB
