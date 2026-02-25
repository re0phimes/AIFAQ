"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push("/admin");
    } else {
      setError("密码错误");
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="font-serif text-2xl font-bold text-deep-ink">
          管理员登录
        </h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="输入管理密码"
          className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm focus:border-blue-400 focus:outline-none"
          autoFocus
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={loading || !password}
          className="w-full rounded-lg bg-deep-ink px-4 py-2 text-sm text-white transition-colors hover:bg-deep-ink/90 disabled:opacity-50"
        >
          {loading ? "登录中..." : "登录"}
        </button>
      </form>
    </div>
  );
}
