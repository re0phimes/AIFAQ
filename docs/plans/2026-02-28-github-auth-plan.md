# GitHub Auth Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace password-based admin auth with NextAuth.js v5 GitHub OAuth, add weighted voting for logged-in users, and add favorites functionality.

**Architecture:** NextAuth.js v5 with GitHub provider in JWT mode. Middleware protects admin routes server-side. Logged-in users get weight-5 votes with subtle verified badge. Favorites stored in new DB table.

**Tech Stack:** NextAuth.js v5 (next-auth@5), GitHub OAuth, Vercel Postgres, Next.js 16 App Router

---

### Task 1: Install next-auth and set up environment

**Files:**
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `.env.local`

**Step 1: Install next-auth**

Run: `cd C:/Users/re0ph/Code/AIFAQ && npm install next-auth@beta`

**Step 2: Update .env.example**

Replace the admin auth section in `.env.example`:

```env
# Auth (NextAuth.js + GitHub OAuth)
AUTH_SECRET=generate-with-npx-auth-secret
AUTH_GITHUB_ID=your-github-oauth-app-client-id
AUTH_GITHUB_SECRET=your-github-oauth-app-client-secret
ADMIN_GITHUB_IDS=your-github-user-id

# Vercel Postgres (auto-injected by Vercel when linked)
POSTGRES_URL=

# AI API (OpenAI-compatible)
AI_API_BASE_URL=https://api.openai.com/v1
AI_API_KEY=sk-xxx
AI_MODEL=gpt-4o
```

**Step 3: Generate AUTH_SECRET and update .env.local**

Run: `cd C:/Users/re0ph/Code/AIFAQ && npx auth secret`

Then manually add to `.env.local`:

```env
AUTH_GITHUB_ID=<from GitHub OAuth App>
AUTH_GITHUB_SECRET=<from GitHub OAuth App>
ADMIN_GITHUB_IDS=<your GitHub numeric user ID>
```

> Note: Create GitHub OAuth App at https://github.com/settings/developers
> Homepage URL: `http://localhost:3000`
> Callback URL: `http://localhost:3000/api/auth/callback/github`

**Step 4: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "chore: install next-auth and update env template"
```

---

### Task 2: Create NextAuth configuration

**Files:**
- Create: `auth.ts` (project root)
- Create: `app/api/auth/[...nextauth]/route.ts`

**Step 1: Create `auth.ts` in project root**

```ts
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

const adminIds = (process.env.ADMIN_GITHUB_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub],
  callbacks: {
    jwt({ token, profile }) {
      if (profile?.id) {
        token.githubId = String(profile.id);
        token.role = adminIds.includes(String(profile.id)) ? "admin" : "user";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.githubId as string;
        (session.user as Record<string, unknown>).role = token.role;
      }
      return session;
    },
  },
});
```

**Step 2: Create route handler `app/api/auth/[...nextauth]/route.ts`**

```ts
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
```

**Step 3: Run build to verify no errors**

Run: `cd C:/Users/re0ph/Code/AIFAQ && npx next build 2>&1 | head -30`

**Step 4: Commit**

```bash
git add auth.ts app/api/auth/\[...nextauth\]/route.ts
git commit -m "feat: add NextAuth.js v5 config with GitHub provider"
```

---

### Task 3: Create middleware for route protection

**Files:**
- Create: `middleware.ts` (project root)

**Step 1: Create `middleware.ts`**

```ts
import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Protect admin routes
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin") || pathname === "/api/seed") {
    const role = (req.auth?.user as Record<string, unknown> | undefined)?.role;
    if (role !== "admin") {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/api/seed"],
};
```

**Step 2: Run build to verify**

Run: `cd C:/Users/re0ph/Code/AIFAQ && npx next build 2>&1 | head -30`

**Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat: add middleware to protect admin and seed routes"
```

---

### Task 4: Database schema changes (weight + user_id + favorites)

**Files:**
- Modify: `lib/db.ts`

**Step 1: Add columns to `faq_votes` and create `user_favorites` table**

In `lib/db.ts`, add these lines inside `initDB()` after the existing `faq_votes` ALTER statements (after line 123):

```ts
  // Auth: weight and user_id for logged-in user votes
  await sql`ALTER TABLE faq_votes ADD COLUMN IF NOT EXISTS weight INTEGER DEFAULT 1`;
  await sql`ALTER TABLE faq_votes ADD COLUMN IF NOT EXISTS user_id TEXT`;

  // Partial unique: one vote per GitHub user per FAQ
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'faq_votes_user_faq_unique'
      ) THEN
        CREATE UNIQUE INDEX faq_votes_user_faq_unique
        ON faq_votes (faq_id, user_id) WHERE user_id IS NOT NULL;
      END IF;
    END $$
  `;

  // Favorites table
  await sql`
    CREATE TABLE IF NOT EXISTS user_favorites (
      id         SERIAL PRIMARY KEY,
      user_id    TEXT NOT NULL,
      faq_id     INTEGER NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, faq_id)
    )
  `;
```

**Step 2: Add `castVoteAuth` function for logged-in users**

After the existing `castVote` function, add:

```ts
export async function castVoteAuth(
  faqId: number,
  voteType: string,
  userId: string,
  weight: number
): Promise<{ inserted: boolean; switched: boolean }> {
  const column = VALID_VOTE_COLUMNS[voteType];
  if (!column) throw new Error(`Invalid vote type: ${voteType}`);

  const existing = await sql`
    SELECT vote_type, weight FROM faq_votes
    WHERE faq_id = ${faqId} AND user_id = ${userId}
  `;

  if (existing.rows.length > 0) {
    const oldType = existing.rows[0].vote_type as string;
    if (oldType === voteType) return { inserted: false, switched: false };
    const oldColumn = VALID_VOTE_COLUMNS[oldType];
    const oldWeight = existing.rows[0].weight as number;
    if (oldColumn) {
      await sql.query(
        `UPDATE faq_items SET ${oldColumn} = GREATEST(${oldColumn} - $1, 0) WHERE id = $2`,
        [oldWeight, faqId]
      );
    }
    await sql`DELETE FROM faq_votes WHERE faq_id = ${faqId} AND user_id = ${userId}`;
  }

  await sql`
    INSERT INTO faq_votes (faq_id, vote_type, fingerprint, user_id, weight)
    VALUES (${faqId}, ${voteType}, ${userId}, ${userId}, ${weight})
  `;
  await sql.query(
    `UPDATE faq_items SET ${column} = ${column} + $1 WHERE id = $2`,
    [weight, faqId]
  );

  return { inserted: true, switched: existing.rows.length > 0 };
}
```

**Step 3: Add favorites CRUD functions**

```ts
export async function toggleFavorite(
  userId: string,
  faqId: number
): Promise<boolean> {
  await ensureSchema();
  const existing = await sql`
    SELECT id FROM user_favorites WHERE user_id = ${userId} AND faq_id = ${faqId}
  `;
  if (existing.rows.length > 0) {
    await sql`DELETE FROM user_favorites WHERE user_id = ${userId} AND faq_id = ${faqId}`;
    return false; // unfavorited
  }
  await sql`INSERT INTO user_favorites (user_id, faq_id) VALUES (${userId}, ${faqId})`;
  return true; // favorited
}

export async function getUserFavorites(userId: string): Promise<number[]> {
  await ensureSchema();
  const result = await sql`
    SELECT faq_id FROM user_favorites WHERE user_id = ${userId} ORDER BY created_at DESC
  `;
  return result.rows.map((r) => r.faq_id as number);
}
```

**Step 4: Add `revokeVoteAuth` function**

```ts
export async function revokeVoteAuth(
  faqId: number,
  userId: string
): Promise<boolean> {
  const existing = await sql`
    SELECT vote_type, weight FROM faq_votes
    WHERE faq_id = ${faqId} AND user_id = ${userId}
  `;
  if (existing.rows.length === 0) return false;

  const voteType = existing.rows[0].vote_type as string;
  const weight = existing.rows[0].weight as number;
  const column = VALID_VOTE_COLUMNS[voteType];

  await sql`DELETE FROM faq_votes WHERE faq_id = ${faqId} AND user_id = ${userId}`;
  if (column) {
    await sql.query(
      `UPDATE faq_items SET ${column} = GREATEST(${column} - $1, 0) WHERE id = $2`,
      [weight, faqId]
    );
  }
  return true;
}
```

**Step 5: Commit**

```bash
git add lib/db.ts
git commit -m "feat: add weight/user_id columns, favorites table, auth vote functions"
```

---

### Task 5: Update vote API to support authenticated users

**Files:**
- Modify: `app/api/faq/[id]/vote/route.ts`

**Step 1: Update POST handler**

Replace the entire `POST` function. Key changes:
- Import `auth` from `@/auth`
- Check session: if logged in, use `castVoteAuth(faqId, type, userId, 5)`
- If not logged in, use existing `castVote(faqId, type, fingerprint, ip, reason, detail)`
- Logged-in users don't need fingerprint

```ts
import { NextResponse } from "next/server";
import { initDB, castVote, castVoteAuth, revokeVote, revokeVoteAuth } from "@/lib/db";
import { auth } from "@/auth";

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

  try {
    await initDB();
    const session = await auth();
    const userId = session?.user?.id;

    if (userId) {
      // Authenticated user: weight-5 vote
      const result = await castVoteAuth(faqId, type, userId, 5);
      if (!result.inserted) {
        return NextResponse.json({ error: "Already voted" }, { status: 409 });
      }
      return NextResponse.json({ success: true, switched: result.switched, authenticated: true });
    }

    // Anonymous: require fingerprint
    if (!fingerprint || typeof fingerprint !== "string") {
      return NextResponse.json({ error: "fingerprint is required" }, { status: 400 });
    }
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      null;
    const result = await castVote(faqId, type, fingerprint, ip, reason, detail);
    if (!result.inserted) {
      return NextResponse.json({ error: "Already voted" }, { status: 409 });
    }
    return NextResponse.json({ success: true, switched: result.switched, authenticated: false });
  } catch (err) {
    console.error("Vote error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Step 2: Update DELETE handler**

```ts
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const faqId = Number(id);
  if (!Number.isInteger(faqId) || faqId <= 0) {
    return NextResponse.json({ error: "Invalid FAQ ID" }, { status: 400 });
  }

  try {
    await initDB();
    const session = await auth();
    const userId = session?.user?.id;

    if (userId) {
      const success = await revokeVoteAuth(faqId, userId);
      if (!success) return NextResponse.json({ error: "No vote found" }, { status: 404 });
      return NextResponse.json({ success: true });
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
    const success = await revokeVote(faqId, fingerprint);
    if (!success) return NextResponse.json({ error: "No vote found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Revoke vote error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Step 3: Commit**

```bash
git add app/api/faq/\[id\]/vote/route.ts
git commit -m "feat: vote API supports authenticated users with weight-5"
```

---

### Task 6: Create favorites API routes

**Files:**
- Create: `app/api/faq/[id]/favorite/route.ts`
- Create: `app/api/user/favorites/route.ts`

**Step 1: Create toggle favorite endpoint**

`app/api/faq/[id]/favorite/route.ts`:

```ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { initDB, toggleFavorite } from "@/lib/db";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const faqId = Number(id);
  if (!Number.isInteger(faqId) || faqId <= 0) {
    return NextResponse.json({ error: "Invalid FAQ ID" }, { status: 400 });
  }

  try {
    await initDB();
    const isFavorited = await toggleFavorite(session.user.id, faqId);
    return NextResponse.json({ favorited: isFavorited });
  } catch (err) {
    console.error("Favorite error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Step 2: Create get user favorites endpoint**

`app/api/user/favorites/route.ts`:

```ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { initDB, getUserFavorites } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await initDB();
    const faqIds = await getUserFavorites(session.user.id);
    return NextResponse.json({ favorites: faqIds });
  } catch (err) {
    console.error("Get favorites error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Step 3: Commit**

```bash
git add app/api/faq/\[id\]/favorite/route.ts app/api/user/favorites/route.ts
git commit -m "feat: add favorites toggle and list API endpoints"
```

---

### Task 7: Rewrite admin layout with NextAuth session

**Files:**
- Modify: `app/admin/layout.tsx`
- Delete: `app/admin/login/page.tsx`

**Step 1: Rewrite `app/admin/layout.tsx`**

Replace entire file. Key changes:
- Remove client-side auth check (middleware handles it now)
- Use `SessionProvider` from `next-auth/react`
- Show user avatar + name from session
- Logout via `signOut()` from `next-auth/react`
- Remove `/admin/login` route handling

```tsx
"use client";

import { SessionProvider, useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

const NAV_ITEMS = [
  { href: "/admin/review", label: "审批管理" },
  { href: "/admin/submit", label: "提交新 FAQ" },
];

function AdminNav({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();

  return (
    <div className="flex h-screen flex-col bg-[var(--color-surface)]">
      <header className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-panel)]">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="font-serif text-lg font-bold text-[var(--color-text)]">
              FAQ Admin
            </Link>
            <nav className="flex gap-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    pathname === item.href
                      ? "bg-[var(--color-text)] text-white"
                      : "text-[var(--color-subtext)] hover:bg-[var(--color-surface)]"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {session?.user?.image && (
              <Image
                src={session.user.image}
                alt=""
                width={28}
                height={28}
                className="rounded-full"
              />
            )}
            <span className="text-sm text-[var(--color-subtext)]">
              {session?.user?.name}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-subtext)] transition-colors hover:bg-[var(--color-surface)]"
            >
              登出
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 overflow-hidden px-4 py-4">
        {children}
      </main>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AdminNav>{children}</AdminNav>
    </SessionProvider>
  );
}
```

**Step 2: Delete old login page**

Run: `rm app/admin/login/page.tsx`

If the `app/admin/login/` directory is now empty, remove it too:
Run: `rmdir app/admin/login`

**Step 3: Commit**

```bash
git add app/admin/layout.tsx
git rm app/admin/login/page.tsx
git commit -m "feat: rewrite admin layout with NextAuth session, remove password login"
```

---

### Task 8: Add login button, favorites, and vote badge to FAQPage

**Files:**
- Modify: `app/FAQPage.tsx`
- Modify: `components/FAQItem.tsx`
- Modify: `components/FAQList.tsx`
- Modify: `lib/i18n.ts`

**Step 1: Wrap FAQPage with SessionProvider and add login UI**

In `app/FAQPage.tsx`:
- Import `SessionProvider`, `useSession`, `signIn`, `signOut` from `next-auth/react`
- Add login/avatar button in the header area (pass to FAQList or render above it)
- Load favorites from `/api/user/favorites` when session exists
- Pass `session`, `favorites`, `onToggleFavorite` to FAQList

Add state:
```ts
const { data: session } = useSession();
const [favorites, setFavorites] = useState<Set<number>>(new Set());

// Load favorites when logged in
useEffect(() => {
  if (!session?.user) return;
  fetch("/api/user/favorites")
    .then((res) => res.ok ? res.json() : null)
    .then((data) => {
      if (data?.favorites) setFavorites(new Set(data.favorites));
    })
    .catch(() => {});
}, [session]);

const handleToggleFavorite = useCallback(async (faqId: number) => {
  const res = await fetch(`/api/faq/${faqId}/favorite`, { method: "POST" });
  if (res.ok) {
    const { favorited } = await res.json();
    setFavorites((prev) => {
      const next = new Set(prev);
      if (favorited) next.add(faqId);
      else next.delete(faqId);
      return next;
    });
  }
}, []);
```

Wrap the return with `<SessionProvider>`.

**Step 2: Add favorite star button to FAQItem**

In `components/FAQItem.tsx`:
- Add props: `isFavorited?: boolean`, `onToggleFavorite?: (id: number) => void`, `isAuthenticated?: boolean`
- Add a star icon button next to the vote buttons (only visible when `isAuthenticated`)
- Star is filled yellow when `isFavorited`, outline when not

```tsx
{isAuthenticated && (
  <button
    onClick={(e) => {
      e.stopPropagation();
      onToggleFavorite?.(item.id);
    }}
    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1
      text-xs transition-colors ${
        isFavorited
          ? "bg-amber-50 text-amber-600"
          : "text-subtext hover:bg-surface"
      }`}
    title={isFavorited ? "取消收藏" : "收藏"}
  >
    <svg className="h-3.5 w-3.5" fill={isFavorited ? "currentColor" : "none"}
      stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  </button>
)}
```

**Step 3: Add verified badge next to authenticated user votes**

In the vote response, when `authenticated: true` is returned, show a small shield/checkmark next to the vote count. This is a visual-only indicator — the vote count displayed is still the raw count (not weighted).

Add to the upvote/downvote button area in `FAQItem.tsx`, after the count span:

```tsx
{/* Show verified badge if this user is authenticated and voted */}
{isAuthenticated && currentVote === "upvote" && (
  <svg className="h-3 w-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M16.403 12.652a3 3 0 010-5.304 3 3 0 00-2.108-2.108 3 3 0 01-5.304 0 3 3 0 00-2.108 2.108 3 3 0 010 5.304 3 3 0 002.108 2.108 3 3 0 015.304 0 3 3 0 002.108-2.108zM11 12.5l-2-2 1-1 1 1 3-3 1 1-4 4z" clipRule="evenodd" />
  </svg>
)}
```

**Step 4: Add i18n keys**

In `lib/i18n.ts`, add:

```ts
login: { zh: "登录", en: "Login" },
loginWithGithub: { zh: "使用 GitHub 登录", en: "Sign in with GitHub" },
logout: { zh: "登出", en: "Logout" },
favorite: { zh: "收藏", en: "Favorite" },
unfavorite: { zh: "取消收藏", en: "Unfavorite" },
myFavorites: { zh: "我的收藏", en: "My Favorites" },
verifiedVote: { zh: "已认证用户投票", en: "Verified user vote" },
```

**Step 5: Commit**

```bash
git add app/FAQPage.tsx components/FAQItem.tsx components/FAQList.tsx lib/i18n.ts
git commit -m "feat: add login button, favorites star, verified vote badge"
```

---

### Task 9: Cleanup old auth files and add TypeScript types

**Files:**
- Delete: `app/api/auth/login/route.ts`
- Delete: `app/api/auth/logout/route.ts`
- Modify: `lib/auth.ts` (rewrite or delete)
- Create: `types/next-auth.d.ts`

**Step 1: Extend NextAuth types**

Create `types/next-auth.d.ts`:

```ts
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: "admin" | "user";
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    githubId?: string;
    role?: "admin" | "user";
  }
}
```

**Step 2: Delete old auth routes**

```bash
git rm app/api/auth/login/route.ts
git rm app/api/auth/logout/route.ts
```

**Step 3: Rewrite `lib/auth.ts`**

Replace entire file with a thin re-export (keep backward compat for any admin API routes that import `verifyAdmin`):

```ts
import { auth } from "@/auth";

/** Check if current request is from an admin user */
export async function verifyAdmin(): Promise<boolean> {
  const session = await auth();
  return (session?.user as Record<string, unknown> | undefined)?.role === "admin";
}
```

**Step 4: Remove old env vars from `.env.local`**

Manually remove `ADMIN_PASSWORD` and `ADMIN_SECRET` from `.env.local` (do not commit this file).

**Step 5: Run full build**

Run: `cd C:/Users/re0ph/Code/AIFAQ && npx next build`

Expected: Build succeeds with no type errors.

**Step 6: Commit**

```bash
git add types/next-auth.d.ts lib/auth.ts
git commit -m "chore: cleanup old auth, add NextAuth type declarations"
```

---

### Task 10: Protect seed route and update admin API auth checks

**Files:**
- Modify: `app/api/seed/route.ts`
- Modify: any `app/api/admin/**` routes that use old `verifyAdmin`

**Step 1: Add auth check to seed route**

At the top of the `POST` function in `app/api/seed/route.ts`:

```ts
import { verifyAdmin } from "@/lib/auth";

export async function POST(): Promise<NextResponse> {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // ... existing seed logic
}
```

> Note: Middleware already blocks non-admin access to `/api/seed`, but defense-in-depth is good practice.

**Step 2: Verify all admin API routes use new `verifyAdmin`**

Search for any imports of old auth functions (`getAuthStatus`, `createToken`, `verifyPassword`, `COOKIE_NAME`) and replace with the new `verifyAdmin` from `lib/auth.ts`.

Run: `grep -r "getAuthStatus\|createToken\|verifyPassword\|COOKIE_NAME" app/ lib/ --include="*.ts" --include="*.tsx"`

Fix any remaining references.

**Step 3: Final build + manual test**

Run: `cd C:/Users/re0ph/Code/AIFAQ && npx next build`

Manual test checklist:
- [ ] Visit `/` — FAQ page loads, login button visible
- [ ] Click "使用 GitHub 登录" — redirects to GitHub OAuth
- [ ] After login — avatar + name shown, star buttons visible
- [ ] Vote as logged-in user — verified badge appears
- [ ] Toggle favorite — star fills/unfills
- [ ] Visit `/admin` — accessible if admin, redirected if not
- [ ] Visit `/api/seed` — returns 401 for non-admin

**Step 4: Commit**

```bash
git add app/api/seed/route.ts
git commit -m "feat: add defense-in-depth auth check to seed route"
```
