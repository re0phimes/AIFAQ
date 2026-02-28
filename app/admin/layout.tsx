"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

const NAV_ITEMS = [
  { href: "/admin/review", label: "审批管理" },
  { href: "/admin/submit", label: "提交新 FAQ" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/admin/login") {
      setAuthed(true);
      return;
    }
    fetch("/api/admin/faq", { method: "HEAD" })
      .then((res) => {
        if (res.ok) setAuthed(true);
        else throw new Error("Unauthorized");
      })
      .catch(() => {
        setAuthed(false);
        router.replace("/admin/login");
      });
  }, [pathname, router]);

  if (pathname === "/admin/login") return <>{children}</>;

  if (authed === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-[var(--color-subtext)]">验证中...</p>
      </div>
    );
  }

  if (!authed) return null;

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/admin/login");
  }

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
          <button
            onClick={handleLogout}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-subtext)] transition-colors hover:bg-[var(--color-surface)]"
          >
            登出
          </button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 overflow-hidden px-4 py-4">
        {children}
      </main>
    </div>
  );
}
