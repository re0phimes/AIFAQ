"use client";

import { useState, useEffect, useCallback } from "react";

interface FaqItem {
  id: number;
  question: string;
  answer_raw: string;
  answer: string | null;
  tags: string[];
  references: { type: string; title: string; url?: string }[];
  status: "pending" | "processing" | "ready" | "failed";
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_STYLES: Record<FaqItem["status"], string> = {
  pending: "bg-gray-100 text-gray-600",
  processing: "bg-blue-100 text-blue-600 animate-pulse",
  ready: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-600",
};

const STATUS_LABELS: Record<FaqItem["status"], string> = {
  pending: "等待中",
  processing: "分析中",
  ready: "已完成",
  failed: "失败",
};

export default function AdminDashboard() {
  const [items, setItems] = useState<FaqItem[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchItems = useCallback(async () => {
    const res = await fetch("/api/admin/faq");
    if (res.ok) setItems(await res.json());
  }, []);

  // Initial load + polling when there are pending/processing items
  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    const hasPending = items.some((i) => i.status === "pending" || i.status === "processing");
    if (!hasPending) return;
    const timer = setInterval(fetchItems, 5000);
    return () => clearInterval(timer);
  }, [items, fetchItems]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return;
    setSubmitting(true);

    const res = await fetch("/api/admin/faq", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: question.trim(), answer: answer.trim() }),
    });

    if (res.ok) {
      const newItem = await res.json();
      setItems((prev) => [newItem, ...prev]);
      setQuestion("");
      setAnswer("");
    }
    setSubmitting(false);
  }

  async function handleRetry(id: number) {
    await fetch(`/api/admin/faq/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "retry" }),
    });
    fetchItems();
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold text-deep-ink">FAQ 管理后台</h1>
        <button
          onClick={handleLogout}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-slate-secondary transition-colors hover:bg-gray-50"
        >
          登出
        </button>
      </div>

      {/* Submit form */}
      <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="font-serif text-lg font-semibold text-deep-ink">提交新 FAQ</h2>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="输入问题..."
          rows={2}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
        />
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="输入答案 (支持 Markdown)..."
          rows={6}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:border-blue-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={submitting || !question.trim() || !answer.trim()}
          className="rounded-lg bg-deep-ink px-4 py-2 text-sm text-white transition-colors hover:bg-deep-ink/90 disabled:opacity-50"
        >
          {submitting ? "提交中..." : "提交并分析"}
        </button>
      </form>

      {/* FAQ list */}
      <div className="space-y-3">
        <h2 className="font-serif text-lg font-semibold text-deep-ink">
          已提交 ({items.length})
        </h2>
        {items.length === 0 && (
          <p className="text-sm text-slate-secondary">暂无提交的 FAQ</p>
        )}
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border border-gray-200 bg-white">
            <button
              type="button"
              onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
              className="flex w-full items-start justify-between gap-3 p-4 text-left"
            >
              <span className="text-sm font-medium text-deep-ink">{item.question}</span>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[item.status]}`}>
                {STATUS_LABELS[item.status]}
              </span>
            </button>

            {expandedId === item.id && (
              <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
                {item.status === "failed" && (
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-red-500">{item.error_message}</p>
                    <button
                      onClick={() => handleRetry(item.id)}
                      className="shrink-0 rounded-lg bg-red-50 px-3 py-1 text-xs text-red-600 hover:bg-red-100"
                    >
                      重试
                    </button>
                  </div>
                )}
                {item.answer && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-slate-secondary">AI 润色答案:</p>
                    <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-code-bg p-3 text-xs">
                      {item.answer}
                    </pre>
                  </div>
                )}
                {item.tags.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-slate-secondary">标签:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {item.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {item.references.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-slate-secondary">参考文献:</p>
                    <ul className="space-y-1">
                      {item.references.map((ref, i) => (
                        <li key={i} className="text-xs">
                          <span className="text-slate-secondary">[{ref.type}]</span>{" "}
                          {ref.url ? (
                            <a href={ref.url} target="_blank" rel="noopener noreferrer" className="text-copper hover:underline">
                              {ref.title}
                            </a>
                          ) : (
                            ref.title
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="text-xs text-slate-secondary">
                  原始答案: {item.answer_raw.slice(0, 200)}{item.answer_raw.length > 200 ? "..." : ""}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
