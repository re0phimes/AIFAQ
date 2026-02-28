"use client";

import { SessionProvider, useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";

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
              <img
                src={session.user.image}
                alt=""
                className="h-7 w-7 rounded-full"
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
