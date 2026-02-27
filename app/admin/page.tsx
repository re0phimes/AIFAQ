"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

type FaqStatus = "pending" | "processing" | "review" | "published" | "rejected" | "ready" | "failed";

interface FaqItem {
  id: number;
  question: string;
  question_en: string | null;
  answer_raw: string;
  answer: string | null;
  answer_brief: string | null;
  answer_en: string | null;
  answer_brief_en: string | null;
  tags: string[];
  categories: string[];
  references: { type: string; title: string; url?: string }[];
  images: Array<{ url: string; caption: string; source: string }>;
  upvote_count: number;
  downvote_count: number;
  status: FaqStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_STYLES: Record<FaqStatus, string> = {
  pending: "bg-gray-100 text-gray-600",
  processing: "bg-blue-100 text-blue-600 animate-pulse",
  review: "bg-amber-100 text-amber-700",
  published: "bg-green-100 text-green-700",
  ready: "bg-green-100 text-green-700",
  rejected: "bg-red-50 text-red-500",
  failed: "bg-red-100 text-red-600",
};

const STATUS_LABELS: Record<FaqStatus, string> = {
  pending: "等待中",
  processing: "分析中",
  review: "待审核",
  published: "已发布",
  ready: "已发布",
  rejected: "已退回",
  failed: "失败",
};

export default function AdminDashboard() {
  const [items, setItems] = useState<FaqItem[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"newest" | "votes" | "downvotes">("newest");
  const [previewTab, setPreviewTab] = useState<"raw" | "brief" | "detailed" | "en">("raw");

  const fetchItems = useCallback(async () => {
    const res = await fetch("/api/admin/faq");
    if (res.ok) {
      const data = await res.json();
      setItems(data);
    }
  }, []);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/faq")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (!cancelled && data) setItems(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Polling when there are pending/processing items
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

  async function handleAction(id: number, action: "publish" | "reject" | "unpublish") {
    await fetch(`/api/admin/faq/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    fetchItems();
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  const stats = useMemo(() => {
    const published = items.filter(i => i.status === "published" || i.status === "ready").length;
    const review = items.filter(i => i.status === "review").length;
    const failed = items.filter(i => i.status === "failed").length;
    const rejected = items.filter(i => i.status === "rejected").length;
    const totalUp = items.reduce((s, i) => s + (i.upvote_count ?? 0), 0);
    const totalDown = items.reduce((s, i) => s + (i.downvote_count ?? 0), 0);
    return { total: items.length, published, review, failed, rejected, totalUp, totalDown };
  }, [items]);

  const filteredItems = useMemo(() => {
    let result = items;
    if (statusFilter !== "all") {
      result = result.filter(i =>
        statusFilter === "published" ? (i.status === "published" || i.status === "ready") : i.status === statusFilter
      );
    }
    if (sortBy === "votes") {
      result = [...result].sort((a, b) => (b.upvote_count ?? 0) - (a.upvote_count ?? 0));
    } else if (sortBy === "downvotes") {
      result = [...result].sort((a, b) => (b.downvote_count ?? 0) - (a.downvote_count ?? 0));
    } else {
      result = [...result].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return result;
  }, [items, statusFilter, sortBy]);

  return (
    <div className="space-y-6">
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

      {/* Overview Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {[
          { label: "总计", value: stats.total, color: "text-gray-700" },
          { label: "已发布", value: stats.published, color: "text-green-700" },
          { label: "待审核", value: stats.review, color: "text-amber-700" },
          { label: "已退回", value: stats.rejected, color: "text-red-500" },
          { label: "失败", value: stats.failed, color: "text-red-600" },
          { label: "总赞", value: stats.totalUp, color: "text-green-600" },
          { label: "总踩", value: stats.totalDown, color: "text-orange-600" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-3 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-secondary">{s.label}</p>
          </div>
        ))}
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

      {/* Filter & Sort */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-secondary">筛选:</span>
        {["all", "review", "published", "rejected", "failed", "pending"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
              statusFilter === s ? "bg-deep-ink text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {s === "all" ? "全部" : STATUS_LABELS[s as FaqStatus] ?? s}
          </button>
        ))}
        <span className="ml-3 text-xs text-slate-secondary">排序:</span>
        {([["newest", "最新"], ["votes", "赞数"], ["downvotes", "踩数"]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSortBy(key)}
            className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
              sortBy === key ? "bg-deep-ink text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* FAQ list */}
      <div className="space-y-3">
        <h2 className="font-serif text-lg font-semibold text-deep-ink">
          {statusFilter === "all" ? "全部" : STATUS_LABELS[statusFilter as FaqStatus]} ({filteredItems.length})
        </h2>
        {filteredItems.length === 0 && (
          <p className="text-sm text-slate-secondary">暂无匹配的 FAQ</p>
        )}
        {filteredItems.map((item) => (
          <div key={item.id} className="rounded-xl border border-gray-200 bg-white">
            <button
              type="button"
              onClick={() => { setExpandedId(expandedId === item.id ? null : item.id); setPreviewTab("raw"); }}
              className="flex w-full items-start justify-between gap-3 p-4 text-left"
            >
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium text-deep-ink">{item.question}</span>
                {item.question_en && (
                  <span className="ml-2 text-xs text-slate-secondary">{item.question_en}</span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {(item.upvote_count > 0 || item.downvote_count > 0) && (
                  <span className="text-xs text-slate-secondary">
                    +{item.upvote_count ?? 0} / -{item.downvote_count ?? 0}
                  </span>
                )}
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[item.status]}`}>
                  {STATUS_LABELS[item.status]}
                </span>
              </div>
            </button>

            {expandedId === item.id && (
              <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
                {/* Action buttons */}
                <div className="flex flex-wrap gap-2">
                  {item.status === "review" && (
                    <>
                      <button onClick={() => handleAction(item.id, "publish")}
                        className="rounded-lg bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700">
                        发布
                      </button>
                      <button onClick={() => handleAction(item.id, "reject")}
                        className="rounded-lg bg-red-50 px-3 py-1 text-xs text-red-600 hover:bg-red-100">
                        退回
                      </button>
                    </>
                  )}
                  {(item.status === "published" || item.status === "ready") && (
                    <button onClick={() => handleAction(item.id, "unpublish")}
                      className="rounded-lg bg-amber-50 px-3 py-1 text-xs text-amber-700 hover:bg-amber-100">
                      下架
                    </button>
                  )}
                  {(item.status === "failed" || item.status === "rejected") && (
                    <button onClick={() => handleRetry(item.id)}
                      className="rounded-lg bg-blue-50 px-3 py-1 text-xs text-blue-600 hover:bg-blue-100">
                      重新分析
                    </button>
                  )}
                </div>

                {item.status === "failed" && item.error_message && (
                  <p className="text-sm text-red-500">{item.error_message}</p>
                )}

                {/* Answer preview tabs */}
                {item.answer && (
                  <div>
                    <div className="mb-2 flex gap-1">
                      {(["raw", "brief", "detailed", "en"] as const).map((tab) => (
                        <button key={tab} onClick={() => setPreviewTab(tab)}
                          className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                            previewTab === tab ? "bg-deep-ink text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}>
                          {tab === "raw" ? "原始" : tab === "brief" ? "精简" : tab === "detailed" ? "详细" : "English"}
                        </button>
                      ))}
                    </div>
                    <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs">
                      {previewTab === "raw" ? item.answer_raw
                        : previewTab === "brief" ? (item.answer_brief ?? "暂无精简版")
                        : previewTab === "detailed" ? item.answer
                        : (item.answer_en ?? "暂无英文版")}
                    </pre>
                  </div>
                )}

                {/* Images */}
                {item.images && item.images.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-slate-secondary">关联图片 ({item.images.length}):</p>
                    <div className="grid grid-cols-2 gap-2">
                      {item.images.map((img, i) => (
                        <div key={i} className="overflow-hidden rounded border border-gray-200 p-1">
                          <img src={img.url} alt={img.caption} className="w-full rounded" loading="lazy" />
                          <p className="mt-1 text-xs text-gray-500">{img.caption} [{img.source}]</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tags */}
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

                {/* References */}
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
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
