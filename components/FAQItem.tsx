"use client";

import { useState, useEffect, useRef, memo } from "react";
import MarkdownContent from "./MarkdownContent";
import ReferenceList from "./ReferenceList";
import type { FAQItem as FAQItemType, VoteType } from "@/src/types/faq";
import { t, getDownvoteReasons, translateTag } from "@/lib/i18n";

interface FAQItemProps {
  item: FAQItemType;
  lang?: "zh" | "en";
  globalDetailed?: boolean;
  isOpen: boolean;
  isSelected: boolean;
  showCheckbox: boolean;
  onToggle: (id: number) => void;
  onSelect: (id: number) => void;
  onVote: (id: number, type: VoteType, reason?: string, detail?: string) => void;
  onRevokeVote: (id: number) => void;
  currentVote: VoteType | null;
  onOpenModal?: (item: FAQItemType) => void;
  isFavorited?: boolean;
  onToggleFavorite?: (id: number) => void;
  isAuthenticated?: boolean;
  userTier?: "free" | "premium";
}

interface VersionEntry {
  id: number;
  version: number;
  answer: string | null;
  answer_brief: string | null;
  change_reason: string | null;
  votes: { upvote_count: number; downvote_count: number };
  created_at: string;
}

function VersionPopover({
  faqId,
  lang = "zh",
  onClose,
}: {
  faqId: number;
  lang?: "zh" | "en";
  onClose: () => void;
}) {
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/faq/${faqId}/versions`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.versions) setVersions(data.versions.slice(0, 3));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [faqId]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      className="absolute left-0 top-full z-50 mt-1 w-72 rounded-xl border border-border bg-panel p-3 shadow-lg md:w-80"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-text">
          {lang === "en" ? "Version History" : "版本历史"}
        </span>
        <button onClick={onClose} className="text-subtext hover:text-text">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      {loading && (
        <p className="py-2 text-center text-xs text-subtext">
          {lang === "en" ? "Loading..." : "加载中..."}
        </p>
      )}
      {!loading && versions.length === 0 && (
        <p className="py-2 text-center text-xs text-subtext">
          {lang === "en" ? "No version history" : "暂无版本记录"}
        </p>
      )}
      <div className="max-h-60 space-y-1.5 overflow-y-auto">
        {versions.map((ver) => (
          <div key={ver.id} className="rounded-lg border border-border bg-surface/50 p-2">
            <button
              type="button"
              onClick={() => setExpanded(expanded === ver.id ? null : ver.id)}
              className="flex w-full items-center justify-between text-left"
            >
              <div className="flex items-center gap-1.5">
                <span className="rounded bg-panel px-1.5 py-0.5 font-mono text-[10px] text-text">
                  v{ver.version}
                </span>
                <span className="text-[10px] text-subtext">
                  {new Date(ver.created_at).toLocaleDateString("zh-CN")}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-green-600">+{ver.votes.upvote_count}</span>
                <span className="text-[10px] text-red-500">-{ver.votes.downvote_count}</span>
                <svg
                  className={`h-3 w-3 text-subtext transition-transform ${expanded === ver.id ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>
            {expanded === ver.id && ver.answer && (
              <div className="mt-1.5 max-h-40 overflow-y-auto border-t border-border pt-1.5">
                <MarkdownContent
                  content={ver.answer}
                  className="prose prose-xs max-w-none text-text"
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function DownvotePanel({
  onSubmit,
  onCancel,
  lang = "zh",
}: {
  onSubmit: (reason: string, detail: string) => void;
  onCancel: () => void;
  lang?: "zh" | "en";
}) {
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const reasons = getDownvoteReasons(lang);
  return (
    <div className="mt-2 rounded-xl border-[0.5px] border-border bg-surface/50 p-3"
      onClick={(e) => e.stopPropagation()}>
      <p className="mb-2 text-xs font-medium text-subtext">
        {t("feedbackPrompt", lang)}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {reasons.map((r) => (
          <button
            key={r.value}
            onClick={() => setReason(r.value)}
            className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
              reason === r.value
                ? "bg-primary text-white"
                : "bg-panel border-[0.5px] border-border text-text hover:bg-surface"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <textarea
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        placeholder={t("detailPlaceholder", lang)}
        className="mt-2 w-full rounded border border-border bg-panel px-2 py-1.5
          text-xs text-text placeholder:text-subtext/50
          focus:border-primary focus:outline-none"
        rows={2}
      />
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => reason && onSubmit(reason, detail)}
          disabled={!reason}
          className="rounded-full bg-primary px-3 py-1 text-xs text-white
            transition-colors hover:bg-primary-hover disabled:opacity-40"
        >
          {t("submit", lang)}
        </button>
        <button
          onClick={onCancel}
          className="rounded-full border-[0.5px] border-border px-3 py-1 text-xs
            text-subtext hover:bg-surface"
        >
          {t("cancel", lang)}
        </button>
      </div>
    </div>
  );
}

function FAQItem({
  item,
  lang = "zh",
  globalDetailed = false,
  isOpen,
  isSelected,
  showCheckbox,
  onToggle,
  onSelect,
  onVote,
  onRevokeVote,
  currentVote,
  onOpenModal,
  isFavorited,
  onToggleFavorite,
  isAuthenticated,
  userTier,
}: FAQItemProps) {
  const [showDownvotePanel, setShowDownvotePanel] = useState(false);
  const [detailedOverride, setDetailedOverride] = useState<boolean | null>(null);
  const [mounted, setMounted] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  // Lazy render: mount content on open, unmount after collapse animation
  const [shouldRender, setShouldRender] = useState(isOpen);
  const detailed = detailedOverride ?? globalDetailed;
  const hasTimelinessWarning = (item.downvoteCount ?? 0) >= 3;
  const isRecentlyUpdated = item.currentVersion && item.currentVersion > 1 && item.lastUpdatedAt &&
    (Date.now() - new Date(item.lastUpdatedAt).getTime()) < 30 * 24 * 60 * 60 * 1000;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
    } else {
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  return (
    <article
      className={`rounded-xl border-[0.5px] transition-all duration-200 ${
        isOpen
          ? "border-primary/30 bg-panel shadow-sm"
          : isSelected
            ? "border-primary/20 bg-primary/5"
            : "border-border bg-panel"
      }`}
    >
      <div className="flex items-start">
        {/* Checkbox - only in compare mode */}
        {showCheckbox && (
          <label
            className="flex shrink-0 cursor-pointer items-center
              self-stretch px-2 py-3 md:px-3 md:py-4"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onSelect(item.id)}
              className="h-4 w-4 cursor-pointer rounded border-border
                accent-primary"
            />
          </label>
        )}

        {/* Question button */}
        <button
          onClick={() => onToggle(item.id)}
          className={`flex min-w-0 flex-1 items-start gap-3 py-3 pr-4
            text-left hover:bg-surface/30 md:gap-4 md:py-4 md:pr-5 ${
              showCheckbox ? "" : "pl-4 md:pl-5"
            }`}
        >
          <span className="shrink-0 font-brand text-xl font-bold
            text-primary md:text-2xl">
            {item.id}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-medium leading-snug
              text-text md:text-base">
              {lang === "en" && item.questionEn ? item.questionEn : item.question}
              {hasTimelinessWarning && (
                <span className="ml-1.5 inline-block rounded bg-amber-100
                  px-1.5 py-0.5 align-middle text-[10px] text-amber-700"
                  title={lang === "en" ? "Multiple reports of outdated/inaccurate content" : "多人反馈此内容可能过期或不准确"}>
                  {t("pendingUpdate", lang)}
                </span>
              )}
              {isRecentlyUpdated && (
                <span className="ml-1.5 inline-block rounded bg-blue-100
                  px-1.5 py-0.5 align-middle text-[10px] text-blue-700
                  dark:bg-blue-900/30 dark:text-blue-300">
                  {t("updated", lang)}
                </span>
              )}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-subtext md:text-xs">
                {item.date}
              </span>
              {item.currentVersion && item.currentVersion > 1 && userTier === "premium" && (
                <span className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowVersions((v) => !v);
                    }}
                    className="text-[11px] text-subtext hover:text-primary md:text-xs"
                    title={t("viewHistory", lang)}
                  >
                    v{item.currentVersion}
                  </button>
                  {showVersions && (
                    <VersionPopover
                      faqId={item.id}
                      lang={lang}
                      onClose={() => setShowVersions(false)}
                    />
                  )}
                </span>
              )}
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className="hidden rounded-full border-[0.5px] border-border bg-panel px-1.5 py-0.5
                    text-xs font-medium text-primary
                    md:inline-block"
                >
                  {translateTag(tag, lang)}
                </span>
              ))}
            </div>
          </div>
          <svg
            className={`mt-1 h-4 w-4 shrink-0 text-subtext
              transition-transform duration-200 md:h-5 md:w-5 ${
                isOpen ? "rotate-180" : ""
              }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </div>

      <div className={`answer-wrapper ${isOpen ? "open" : ""}`}>
        <div>
          {shouldRender && (
          <div className={`answer-scroll px-4 pb-4 ${
            showCheckbox ? "pl-10 md:pl-14" : "pl-4 md:pl-5"
          }`}>
            {item.answerBrief && (
              <div className="mb-3 flex gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); setDetailedOverride(false); }}
                  className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                    !detailed
                      ? "bg-primary text-white"
                      : "border-[0.5px] border-border text-subtext hover:bg-surface"
                  }`}
                >
                  {t("brief", lang)}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onOpenModal) {
                      onOpenModal(item);
                    } else {
                      setDetailedOverride(true);
                    }
                  }}
                  className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                    detailed
                      ? "bg-primary text-white"
                      : "border-[0.5px] border-border text-subtext hover:bg-surface"
                  }`}
                >
                  {t("detailed", lang)}
                </button>
              </div>
            )}
            <MarkdownContent
              className="prose prose-sm max-w-none text-text
                [&_code]:rounded [&_code]:bg-surface [&_code]:px-1.5
                [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-sm
                [&_pre]:rounded-lg [&_pre]:bg-surface [&_pre]:p-4
                [&_pre_code]:bg-transparent [&_pre_code]:p-0
                [&_.katex-display]:overflow-x-auto
                [&_.katex-display]:py-2"
              content={detailed
                ? (lang === "en" && item.answerEn ? item.answerEn : item.answer)
                : (lang === "en" && item.answerBriefEn
                    ? item.answerBriefEn
                    : (item.answerBrief ?? item.answer))}
            />
            {mounted && detailed && item.images && item.images.length > 0 && (
              <div className="mt-4 space-y-3">
                {item.images.map((img, i) => (
                  <figure key={i} className="overflow-hidden rounded-lg border-[0.5px] border-border">
                    <a href={img.url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={img.url}
                        alt={img.caption}
                        className="w-full object-contain"
                        loading="lazy"
                      />
                    </a>
                    <figcaption className="bg-surface/50 px-3 py-2 text-xs text-subtext">
                      {img.caption}
                      <span className="ml-2 text-[10px] text-subtext/60">
                            [{img.source === "blog" ? t("blog", lang) : t("paper", lang)}]
                      </span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
            <ReferenceList references={item.references} lang={lang} />
            {/* Vote buttons — up/down 互斥 */}
            <div className="mt-3 flex items-center gap-3 border-t border-border/50 pt-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (currentVote === "upvote") {
                    onRevokeVote(item.id);
                  } else {
                    onVote(item.id, "upvote");
                  }
                }}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1
                  text-xs transition-colors ${
                    currentVote === "upvote"
                      ? "bg-green-50 text-green-700"
                      : "text-subtext hover:bg-surface"
                  }`}
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor"
                  viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z M2 13h2v9H2z" />
                </svg>
                                {t("helpful", lang)}
                {(item.upvoteCount ?? 0) > 0 && (
                  <span className="font-mono text-[10px]">{item.upvoteCount}</span>
                )}
                {isAuthenticated && currentVote === "upvote" && (
                  <svg className="h-3 w-3 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0l1.5 8.5L22 12l-8.5 1.5L12 22l-1.5-8.5L2 12l8.5-1.5z" />
                  </svg>
                )}
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (currentVote === "downvote") {
                    onRevokeVote(item.id);
                    setShowDownvotePanel(false);
                  } else {
                    setShowDownvotePanel((v) => !v);
                  }
                }}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1
                  text-xs transition-colors ${
                    currentVote === "downvote"
                      ? "bg-red-50 text-red-600"
                      : "text-subtext hover:bg-surface"
                  }`}
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor"
                  viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M10 15V19a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z M22 2h-2v9h2z" />
                </svg>
                                {t("report", lang)}
                {(item.downvoteCount ?? 0) > 0 && (
                  <span className="font-mono text-[10px]">{item.downvoteCount}</span>
                )}
              </button>

              {isAuthenticated && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite?.(item.id);
                  }}
                  className={`ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1
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
            </div>
            {showDownvotePanel && currentVote !== "downvote" && (
              <DownvotePanel
                lang={lang}
                onSubmit={(reason, detail) => {
                  onVote(item.id, "downvote", reason, detail);
                  setShowDownvotePanel(false);
                }}
                onCancel={() => setShowDownvotePanel(false)}
              />
            )}
          </div>
          )}
        </div>
      </div>
    </article>
  );
}

export default memo(FAQItem);
