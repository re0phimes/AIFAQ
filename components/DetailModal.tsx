"use client";

import { useEffect, useCallback, memo } from "react";
import AsyncMarkdownContent from "./AsyncMarkdownContent";
import ReferenceList from "./ReferenceList";
import type { FAQItem as FAQItemType, VoteType } from "@/src/types/faq";
import { t, translateTag } from "@/lib/i18n";

interface DetailModalProps {
  item: FAQItemType | null;
  isOpen: boolean;
  onClose: () => void;
  lang: "zh" | "en";
  onVote: (type: VoteType, reason?: string, detail?: string) => void;
  onRevokeVote: () => void;
  currentVote: VoteType | null;
  upvoteCount?: number;
  downvoteCount?: number;
}

function DetailModal({
  item,
  isOpen,
  onClose,
  lang,
  onVote,
  onRevokeVote,
  currentVote,
  upvoteCount,
  downvoteCount,
}: DetailModalProps) {
  // Handle ESC key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const hasTimelinessWarning = (downvoteCount ?? 0) >= 3;

  // 骨架屏状态
  if (!item) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6"
        aria-modal="true"
        role="dialog"
      >
        {/* Backdrop - 无动画，静态背景 */}
        <div
          className="absolute inset-0 bg-black/60"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Modal content skeleton - 简化动画 */}
        <div
          className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border-[0.5px] border-border bg-bg shadow-2xl md:max-h-[85vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header skeleton - 移除单个动画，改用整体透明度 */}
          <div className="flex items-start justify-between border-b border-border/50 px-4 py-4 md:px-6 opacity-60">
            <div className="min-w-0 flex-1 pr-4">
              <div className="flex items-start gap-3">
                <div className="h-6 w-8 shrink-0 rounded bg-surface" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-5 w-3/4 rounded bg-surface" />
                  <div className="h-4 w-1/2 rounded bg-surface" />
                </div>
              </div>
            </div>
          </div>

          {/* Content skeleton - 静态，无动画 */}
          <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 opacity-60">
            <div className="space-y-3">
              <div className="h-4 w-full rounded bg-surface" />
              <div className="h-4 w-5/6 rounded bg-surface" />
              <div className="h-4 w-4/5 rounded bg-surface" />
              <div className="h-20 w-full rounded bg-surface" />
              <div className="h-4 w-full rounded bg-surface" />
              <div className="h-4 w-2/3 rounded bg-surface" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6"
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop - 静态背景，无动画 */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
        style={{ contain: 'strict' }}
      />

      {/* Modal content - 仅使用 GPU 加速的动画属性 */}
      <div
        className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border-[0.5px] border-border bg-bg shadow-2xl animate-modal-in-fast md:max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border/50 px-4 py-4 md:px-6">
          <div className="min-w-0 flex-1 pr-4">
            <div className="flex items-start gap-3">
              <span className="shrink-0 font-brand text-xl font-bold text-primary md:text-2xl">
                {item.id}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-medium leading-snug text-text md:text-lg">
                  {lang === "en" && item.questionEn
                    ? item.questionEn
                    : item.question}
                  {hasTimelinessWarning && (
                    <span
                      className="ml-1.5 inline-block rounded bg-amber-100 px-1.5 py-0.5 align-middle text-[10px] text-amber-700"
                      title={
                        lang === "en"
                          ? "Multiple reports of outdated/inaccurate content"
                          : "多人反馈此内容可能过期或不准确"
                      }
                    >
                      {t("pendingUpdate", lang)}
                    </span>
                  )}
                </h2>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-subtext">{item.date}</span>
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border-[0.5px] border-border bg-panel px-2 py-0.5 text-xs font-medium text-primary"
                >
                  {translateTag(tag, lang)}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-full p-1.5 text-subtext transition-colors hover:bg-surface hover:text-text"
            aria-label={lang === "zh" ? "关闭" : "Close"}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
          <AsyncMarkdownContent
            className="prose prose-base max-w-none text-text [&_code]:rounded [&_code]:bg-surface [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-sm [&_pre]:rounded-lg [&_pre]:bg-surface [&_pre]:p-4 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_.katex-display]:overflow-x-auto [&_.katex-display]:py-2"
            content={lang === "en" && item.answerEn ? item.answerEn : item.answer}
          />

          {/* Images */}
          {item.images && item.images.length > 0 && (
            <div className="mt-6 space-y-3">
              {item.images.map((img, i) => (
                <figure
                  key={i}
                  className="overflow-hidden rounded-lg border-[0.5px] border-border"
                >
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
        </div>

        {/* Footer with vote buttons */}
        <div className="border-t border-border/50 px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (currentVote === "upvote") {
                  onRevokeVote();
                } else {
                  onVote("upvote");
                }
              }}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors ${
                currentVote === "upvote"
                  ? "bg-green-50 text-green-700"
                  : "text-subtext hover:bg-surface"
              }`}
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z M2 13h2v9H2z"
                />
              </svg>
              {t("helpful", lang)}
              {(upvoteCount ?? 0) > 0 && (
                <span className="font-mono text-xs">{upvoteCount}</span>
              )}
            </button>

            <button
              onClick={() => {
                if (currentVote === "downvote") {
                  onRevokeVote();
                } else {
                  onVote("downvote");
                }
              }}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors ${
                currentVote === "downvote"
                  ? "bg-red-50 text-red-600"
                  : "text-subtext hover:bg-surface"
              }`}
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10 15V19a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z M22 2h-2v9h2z"
                />
              </svg>
              {t("report", lang)}
              {(downvoteCount ?? 0) > 0 && (
                <span className="font-mono text-xs">{downvoteCount}</span>
              )}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}

export default memo(DetailModal);
