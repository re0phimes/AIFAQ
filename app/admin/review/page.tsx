"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import SyncMarkdownContent from "@/components/SyncMarkdownContent";

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
  reviewed_at: string | null;
  reviewed_by: string | null;
  current_version: number;
}

const STATUS_LABELS: Record<FaqStatus, string> = {
  pending: "等待中",
  processing: "分析中",
  review: "待审核",
  published: "已发布",
  ready: "已发布",
  rejected: "已退回",
  failed: "失败",
};

const STATUS_COLORS: Record<FaqStatus, string> = {
  pending: "bg-gray-400",
  processing: "bg-blue-400 animate-pulse",
  review: "bg-amber-400",
  published: "bg-green-500",
  ready: "bg-green-500",
  rejected: "bg-red-400",
  failed: "bg-red-500",
};

const STATUS_BADGE_STYLES: Record<FaqStatus, string> = {
  published: "bg-green-100 text-green-700",
  ready: "bg-green-100 text-green-700",
  review: "bg-amber-100 text-amber-700",
  rejected: "bg-red-50 text-red-500",
  failed: "bg-red-100 text-red-600",
  processing: "bg-blue-100 text-blue-600 animate-pulse",
  pending: "bg-gray-100 text-gray-600",
};

const FILTER_TABS = [
  { key: "all", label: "全部" },
  { key: "review", label: "待审核" },
  { key: "published", label: "已发布" },
  { key: "rejected", label: "已退回" },
  { key: "failed", label: "失败" },
] as const;

interface VersionItem {
  id: number;
  faq_id: number;
  version_number: number;
  answer: string | null;
  answer_brief: string | null;
  answer_en: string | null;
  change_reason: string | null;
  upvote_count: number;
  downvote_count: number;
  created_at: string;
}

export default function ReviewPage() {
  const [items, setItems] = useState<FaqItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewTab, setPreviewTab] = useState<"raw" | "brief" | "detailed" | "en">("detailed");
  const [actionLoading, setActionLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);

  const fetchItems = useCallback(async () => {
    const res = await fetch("/api/admin/faq");
    if (res.ok) {
      const data = await res.json();
      setItems(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const shouldPoll = items.some((i) => i.status === "pending" || i.status === "processing");

  useEffect(() => {
    if (!shouldPoll) return;
    const timer = setInterval(fetchItems, 5000);
    return () => clearInterval(timer);
  }, [shouldPoll, fetchItems]);

  const stats = useMemo(() => {
    const counts: Record<string, number> = { all: items.length };
    for (const item of items) {
      const key = item.status === "ready" ? "published" : item.status;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [items]);

  const filteredItems = useMemo(() => {
    let result = items;
    if (statusFilter !== "all") {
      result = result.filter((i) =>
        statusFilter === "published"
          ? i.status === "published" || i.status === "ready"
          : i.status === statusFilter
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (i) => i.question.toLowerCase().includes(q) || i.question_en?.toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [items, statusFilter, searchQuery]);

  const selectedItem = useMemo(
    () => items.find((i) => i.id === selectedId) ?? null,
    [items, selectedId]
  );

  // Reset version panel when selection changes
  useEffect(() => {
    setVersionsOpen(false);
    setVersions([]);
    setExpandedVersion(null);
  }, [selectedId]);

  async function handleAction(id: number, action: "publish" | "reject" | "unpublish" | "retry") {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/faq/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error ?? `操作失败 (${res.status})`);
      }
    } catch {
      alert("网络错误，请重试");
    } finally {
      setActionLoading(false);
      fetchItems();
    }
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  async function fetchVersions(faqId: number) {
    setVersionsLoading(true);
    try {
      const res = await fetch(`/api/faq/${faqId}/versions`);
      if (res.ok) {
        setVersions(await res.json());
      }
    } catch {
      // silently fail
    } finally {
      setVersionsLoading(false);
    }
  }

  function toggleVersions(faqId: number) {
    if (versionsOpen) {
      setVersionsOpen(false);
      setVersions([]);
      setExpandedVersion(null);
    } else {
      setVersionsOpen(true);
      fetchVersions(faqId);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Stats bar */}
      <div className="mb-4 flex gap-2">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
              statusFilter === tab.key
                ? "bg-[var(--color-text)] text-white"
                : "bg-[var(--color-panel)] text-[var(--color-subtext)] hover:bg-[var(--color-border)]"
            }`}
          >
            {tab.label} ({stats[tab.key] ?? 0})
          </button>
        ))}
      </div>

      {/* Master-Detail split */}
      <div className="flex min-h-0 flex-1 gap-4">
        {/* Left: List panel */}
        <div className="flex w-[35%] flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]">
          <div className="border-b border-[var(--color-border)] p-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索问题..."
              className="w-full rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm focus:border-[var(--color-primary)] focus:outline-none"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <p className="p-4 text-center text-sm text-[var(--color-subtext)]">加载中...</p>
            )}
            {!loading && filteredItems.length === 0 && (
              <p className="p-4 text-center text-sm text-[var(--color-subtext)]">暂无匹配项</p>
            )}
            {filteredItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => { setSelectedId(item.id); setPreviewTab("detailed"); }}
                className={`flex w-full items-start gap-2.5 border-b border-[var(--color-border)] px-3 py-3 text-left transition-colors ${
                  selectedId === item.id
                    ? "bg-[var(--color-surface)]"
                    : "hover:bg-[var(--color-surface)]/50"
                }`}
              >
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${STATUS_COLORS[item.status]}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--color-text)]">
                    {item.question}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-[var(--color-subtext)]">
                    <span>{formatDate(item.created_at)}</span>
                    <span className="rounded bg-[var(--color-surface)] px-1.5 py-0.5 font-mono text-[10px]">v{item.current_version ?? 1}</span>
                    {item.tags.length > 0 && <span>{item.tags.length} tags</span>}
                    {item.reviewed_at && <span>审批: {formatDate(item.reviewed_at)}</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Detail panel */}
        <div className="flex w-[65%] flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]">
          {!selectedItem ? (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-[var(--color-subtext)]">选择一个 FAQ 查看详情</p>
            </div>
          ) : (
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* Header + actions */}
              <div className="border-b border-[var(--color-border)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-[var(--color-text)]">
                      {selectedItem.question}
                    </h2>
                    {selectedItem.question_en && (
                      <p className="mt-0.5 text-sm text-[var(--color-subtext)]">
                        {selectedItem.question_en}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded bg-[var(--color-surface)] px-2 py-0.5 font-mono text-xs text-[var(--color-subtext)]">
                      v{selectedItem.current_version ?? 1}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE_STYLES[selectedItem.status]}`}>
                      {STATUS_LABELS[selectedItem.status]}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedItem.status === "review" && (
                    <>
                      <button onClick={() => handleAction(selectedItem.id, "publish")} disabled={actionLoading}
                        className="rounded-lg bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700">
                        发布
                      </button>
                      <button onClick={() => handleAction(selectedItem.id, "reject")} disabled={actionLoading}
                        className="rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-600 hover:bg-red-100">
                        退回
                      </button>
                    </>
                  )}
                  {(selectedItem.status === "published" || selectedItem.status === "ready") && (
                    <button onClick={() => handleAction(selectedItem.id, "unpublish")} disabled={actionLoading}
                      className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-100">
                      下架
                    </button>
                  )}
                  {(selectedItem.status === "failed" || selectedItem.status === "rejected") && (
                    <button onClick={() => handleAction(selectedItem.id, "retry")} disabled={actionLoading}
                      className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-100">
                      重新分析
                    </button>
                  )}
                </div>
                {selectedItem.status === "failed" && selectedItem.error_message && (
                  <p className="mt-2 text-sm text-red-500">{selectedItem.error_message}</p>
                )}
              </div>

              {/* Content tabs */}
              <div className="border-b border-[var(--color-border)] px-4 py-2">
                <div className="flex gap-1">
                  {(["raw", "detailed", "brief", "en"] as const).map((tab) => (
                    <button key={tab} onClick={() => setPreviewTab(tab)}
                      className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                        previewTab === tab
                          ? "bg-[var(--color-text)] text-white"
                          : "bg-[var(--color-surface)] text-[var(--color-subtext)] hover:bg-[var(--color-border)]"
                      }`}>
                      {tab === "raw" ? "原始" : tab === "detailed" ? "AI 详细" : tab === "brief" ? "精简" : "English"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="prose prose-sm max-w-none">
                  {previewTab === "raw" ? (
                    <pre className="whitespace-pre-wrap rounded-lg bg-[var(--color-surface)] p-3 text-xs">
                      {selectedItem.answer_raw}
                    </pre>
                  ) : (
                    <SyncMarkdownContent
                      content={
                        previewTab === "detailed" ? selectedItem.answer ?? "暂无 AI 增强版"
                          : previewTab === "brief" ? selectedItem.answer_brief ?? "暂无精简版"
                          : selectedItem.answer_en ?? "暂无英文版"
                      }
                      className="markdown-body"
                    />
                  )}
                </div>

                {/* Metadata */}
                <div className="mt-6 space-y-3 border-t border-[var(--color-border)] pt-4">
                  {selectedItem.tags.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-medium text-[var(--color-subtext)]">标签</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedItem.tags.map((tag) => (
                          <span key={tag} className="rounded-full bg-[var(--color-surface)] px-2 py-0.5 text-xs text-[var(--color-subtext)]">{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedItem.categories.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-medium text-[var(--color-subtext)]">分类</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedItem.categories.map((cat) => (
                          <span key={cat} className="rounded-full bg-[var(--color-surface)] px-2 py-0.5 text-xs text-[var(--color-subtext)]">{cat}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedItem.references.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-medium text-[var(--color-subtext)]">参考文献</p>
                      <ul className="space-y-1">
                        {selectedItem.references.map((ref, i) => (
                          <li key={i} className="text-xs">
                            <span className="text-[var(--color-subtext)]">[{ref.type}]</span>{" "}
                            {ref.url ? (
                              <a href={ref.url} target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] hover:underline">{ref.title}</a>
                            ) : ref.title}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {selectedItem.images && selectedItem.images.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-medium text-[var(--color-subtext)]">图片 ({selectedItem.images.length})</p>
                      <div className="grid grid-cols-2 gap-2">
                        {selectedItem.images.map((img, i) => (
                          <div key={i} className="overflow-hidden rounded-lg border border-[var(--color-border)] p-1">
                            <img src={img.url} alt={img.caption} className="w-full rounded" loading="lazy" />
                            <p className="mt-1 text-xs text-[var(--color-subtext)]">{img.caption}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedItem.reviewed_at && (
                    <div className="text-xs text-[var(--color-subtext)]">
                      审批时间: {new Date(selectedItem.reviewed_at).toLocaleString("zh-CN")}
                      {selectedItem.reviewed_by && ` · ${selectedItem.reviewed_by}`}
                    </div>
                  )}

                  {/* Version History */}
                  <div className="border-t border-[var(--color-border)] pt-3">
                    <button
                      type="button"
                      onClick={() => toggleVersions(selectedItem.id)}
                      className="flex w-full items-center justify-between text-left"
                    >
                      <p className="text-xs font-medium text-[var(--color-subtext)]">
                        版本历史 (v{selectedItem.current_version ?? 1})
                      </p>
                      <svg
                        className={`h-3.5 w-3.5 text-[var(--color-subtext)] transition-transform ${versionsOpen ? "rotate-180" : ""}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {versionsOpen && (
                      <div className="mt-2 space-y-2">
                        {versionsLoading && (
                          <p className="text-xs text-[var(--color-subtext)]">加载中...</p>
                        )}
                        {!versionsLoading && versions.length === 0 && (
                          <p className="text-xs text-[var(--color-subtext)]">暂无版本记录</p>
                        )}
                        {versions.map((ver) => (
                          <div
                            key={ver.id}
                            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5"
                          >
                            <button
                              type="button"
                              onClick={() => setExpandedVersion(expandedVersion === ver.id ? null : ver.id)}
                              className="flex w-full items-center justify-between text-left"
                            >
                              <div className="flex items-center gap-2">
                                <span className="rounded bg-[var(--color-panel)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-text)]">
                                  v{ver.version_number}
                                </span>
                                <span className="text-xs text-[var(--color-subtext)]">
                                  {new Date(ver.created_at).toLocaleDateString("zh-CN")}
                                </span>
                                {ver.change_reason && (
                                  <span className="truncate text-xs text-[var(--color-subtext)]">
                                    — {ver.change_reason}
                                  </span>
                                )}
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <span className="text-xs text-green-600" title="赞同">
                                  +{ver.upvote_count}
                                </span>
                                <span className="text-xs text-red-500" title="反对">
                                  -{ver.downvote_count}
                                </span>
                                <svg
                                  className={`h-3 w-3 text-[var(--color-subtext)] transition-transform ${expandedVersion === ver.id ? "rotate-180" : ""}`}
                                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </button>

                            {expandedVersion === ver.id && ver.answer && (
                              <div className="mt-2 border-t border-[var(--color-border)] pt-2">
                                <SyncMarkdownContent
                                  content={ver.answer}
                                  className="markdown-body prose-xs"
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}