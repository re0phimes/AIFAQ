"use client";

import { t, translateTag } from "@/lib/i18n";
import Image from "next/image";
import type { FAQItem } from "@/src/types/faq";
import MarkdownContent from "@/components/MarkdownContent";
import ReferenceList from "@/components/ReferenceList";

interface FavoriteCardProps {
  item: {
    faq_id: number;
    faq: FAQItem;
    learning_status: 'unread' | 'learning' | 'mastered';
    relative_time_label: string;
    needs_nudge: boolean;
  };
  lang: "zh" | "en";
  onUpdateStatus: (faqId: number, status: 'learning' | 'mastered') => void;
  onToggleFavorite: (faqId: number) => void;
  onOpenItem: (item: FavoriteCardProps["item"]) => void;
  showMasterButton?: boolean;
  isPending?: boolean;
  detailedMode?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: (faqId: number) => void;
}

export default function FavoriteCard({
  item,
  lang,
  onUpdateStatus,
  onToggleFavorite,
  onOpenItem,
  showMasterButton,
  isPending,
  detailedMode = false,
  isExpanded = false,
  onToggleExpand,
}: FavoriteCardProps) {
  const { faq_id, faq, learning_status, relative_time_label, needs_nudge } = item;
  const title = lang === "en" && faq.questionEn ? faq.questionEn : faq.question;
  const briefContent =
    lang === "en" && faq.answerBriefEn
      ? faq.answerBriefEn
      : faq.answerBrief ?? faq.answer;

  // Status badge config
  const statusConfig = {
    unread: {
      dotColor: "bg-gray-400",
      textColor: "text-subtext",
      label: t("unreadStatus", lang),
    },
    learning: {
      dotColor: "bg-blue-500",
      textColor: "text-blue-600",
      label: t("learningStatus", lang),
    },
    mastered: {
      dotColor: "bg-green-500",
      textColor: "text-green-600",
      label: t("masteredStatus", lang),
    },
  };

  const status = statusConfig[learning_status];
  const timeLabelKey = learning_status === "unread" ? "savedAt" : "lastReviewedAt";

  return (
    <article className={`rounded-xl border-[0.5px] bg-panel transition-all duration-200 ${
      isPending
        ? 'border-red-300 opacity-50 grayscale'
        : 'border-border hover:border-primary/20'
    }`}>
      <div className="flex items-start p-3.5 md:p-4">
        {/* Left: ID */}
        <span className="shrink-0 font-brand text-lg font-bold text-primary md:text-xl">
          {faq_id}
        </span>

        {/* Middle: Content */}
        <div className="min-w-0 flex-1 px-4">
          {/* Title */}
          <button
            type="button"
            onClick={() => (detailedMode ? onOpenItem(item) : onToggleExpand?.(faq_id))}
            className="block w-full text-left text-[13px] font-medium leading-snug text-text hover:text-primary md:text-sm"
          >
            {title}
          </button>

          {/* Status badge */}
          <div className="mt-2 flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 text-xs ${status.textColor}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${status.dotColor}`} />
              {status.label}
            </span>
          </div>
          <div className="mt-1.5 text-[11px] text-subtext">
            {t(timeLabelKey, lang)}: {relative_time_label}
          </div>
          {needs_nudge && (
            <div className="mt-2">
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
                {t("internalizeSoon", lang)}
              </span>
            </div>
          )}

          {/* Tags */}
          {faq.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {faq.tags.slice(0, 5).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border-[0.5px] border-border bg-panel px-1.5 py-0.5 text-[11px] font-medium text-primary"
                >
                  {translateTag(tag, lang)}
                </span>
              ))}
              {faq.tags.length > 5 && (
                <span className="text-[11px] text-subtext">+{faq.tags.length - 5}</span>
              )}
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          {/* Favorite button - remove from favorites */}
          <button
            onClick={() => onToggleFavorite(faq_id)}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs transition-colors bg-amber-50 text-amber-600 hover:bg-amber-100"
            title={t("unfavorite", lang)}
          >
            <svg
              className="h-3.5 w-3.5"
              fill="currentColor"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
              />
            </svg>
            <span className="hidden sm:inline">{t("unfavorite", lang)}</span>
          </button>

          {/* Mark as mastered button - only for learning status */}
          {showMasterButton && (
            <button
              onClick={() => onUpdateStatus(faq_id, 'mastered')}
              className="inline-flex items-center gap-1 rounded-full border border-green-500 px-2 py-1 text-xs text-green-600 hover:bg-green-50"
            >
              <span>{t("markAsMastered", lang)}</span>
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {!detailedMode && isExpanded && (
        <div className="border-t border-border/50 px-4 pb-4 pt-3">
          <MarkdownContent
            className="prose prose-sm max-w-none text-text [&_code]:rounded [&_code]:bg-surface [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-sm [&_pre]:rounded-lg [&_pre]:bg-surface [&_pre]:p-4 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_.katex-display]:overflow-x-auto [&_.katex-display]:py-2"
            content={briefContent}
          />
          {faq.images && faq.images.length > 0 && (
            <div className="mt-4 space-y-3">
              {faq.images.map((img, i) => (
                <figure key={i} className="overflow-hidden rounded-lg border-[0.5px] border-border">
                  <a href={img.url} target="_blank" rel="noopener noreferrer">
                    <Image
                      src={img.url}
                      alt={img.caption}
                      width={1200}
                      height={800}
                      className="h-auto w-full object-contain"
                      loading="lazy"
                      unoptimized
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
          <ReferenceList references={faq.references} lang={lang} />
        </div>
      )}
    </article>
  );
}
