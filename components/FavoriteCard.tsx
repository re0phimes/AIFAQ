"use client";

import Link from "next/link";
import { t, translateTag } from "@/lib/i18n";
import type { FAQItem } from "@/src/types/faq";

interface FavoriteCardProps {
  item: {
    faq_id: number;
    faq: FAQItem;
    learning_status: 'unread' | 'learning' | 'mastered';
  };
  lang: "zh" | "en";
  onUpdateStatus: (faqId: number, status: 'learning' | 'mastered') => void;
  onToggleFavorite: (faqId: number) => void;
  showMasterButton?: boolean;
  isPending?: boolean;
}

export default function FavoriteCard({
  item,
  lang,
  onUpdateStatus,
  onToggleFavorite,
  showMasterButton,
  isPending,
}: FavoriteCardProps) {
  const { faq_id, faq, learning_status } = item;

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

  return (
    <article className={`rounded-xl border-[0.5px] bg-panel transition-all duration-200 ${
      isPending
        ? 'border-red-300 opacity-50 grayscale'
        : 'border-border hover:border-primary/20'
    }`}>
      <div className="flex items-start p-4">
        {/* Left: ID */}
        <span className="shrink-0 font-brand text-xl font-bold text-primary md:text-2xl">
          {faq_id}
        </span>

        {/* Middle: Content */}
        <div className="min-w-0 flex-1 px-4">
          {/* Title */}
          <Link
            href={`/faq/${faq_id}`}
            className="block text-sm font-medium leading-snug text-text hover:text-primary md:text-base"
          >
            {lang === "en" && faq.questionEn ? faq.questionEn : faq.question}
          </Link>

          {/* Status badge */}
          <div className="mt-2 flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 text-xs ${status.textColor}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${status.dotColor}`} />
              {status.label}
            </span>
          </div>

          {/* Tags */}
          {faq.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {faq.tags.slice(0, 5).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border-[0.5px] border-border bg-panel px-1.5 py-0.5 text-xs font-medium text-primary"
                >
                  {translateTag(tag, lang)}
                </span>
              ))}
              {faq.tags.length > 5 && (
                <span className="text-xs text-subtext">+{faq.tags.length - 5}</span>
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
    </article>
  );
}
