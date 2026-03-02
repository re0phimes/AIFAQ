"use client";

import Link from "next/link";
import { t, translateTag } from "@/lib/i18n";
import type { FAQItem } from "@/src/types/faq";

interface FavoriteCardProps {
  item: {
    faq_id: number;
    faq: FAQItem;
    learning_status: "unread" | "learning" | "mastered";
  };
  lang: "zh" | "en";
  onUpdateStatus: (faqId: number, status: "learning" | "mastered") => void;
  onToggleFavorite: (faqId: number) => void;
  showMasterButton?: boolean;
  isPending?: boolean;
}

const statusConfig = {
  unread: {
    borderClass: "",
    bgClass: "",
  },
  learning: {
    borderClass: "border-l-4 border-l-blue-500",
    bgClass: "bg-blue-50/30",
  },
  mastered: {
    borderClass: "border-l-4 border-l-green-500",
    bgClass: "bg-green-50/30",
  },
};

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      className="h-4 w-4"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
      />
    </svg>
  );
}

function BookOpenIcon() {
  return (
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
        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
      />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
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
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function DifficultyIcon({ level }: { level?: string | null }) {
  const colorClass =
    level === "advanced"
      ? "text-red-500"
      : level === "intermediate"
        ? "text-amber-500"
        : "text-green-500";

  return (
    <svg
      className={`h-3.5 w-3.5 ${colorClass}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>
  );
}

function UpvoteIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"
      />
    </svg>
  );
}

export default function FavoriteCard({
  item,
  lang,
  onUpdateStatus,
  onToggleFavorite,
  showMasterButton = false,
  isPending = false,
}: FavoriteCardProps) {
  const { faq_id, faq, learning_status } = item;
  const config = statusConfig[learning_status];

  const title = lang === "en" && faq.questionEn ? faq.questionEn : faq.question;
  const summary =
    lang === "en" && faq.answerBriefEn
      ? faq.answerBriefEn
      : faq.answerBrief || faq.answer.slice(0, 150) + "...";

  const difficultyText =
    faq.difficulty === "advanced"
      ? lang === "en"
        ? "Advanced"
        : "困难"
      : faq.difficulty === "intermediate"
        ? lang === "en"
          ? "Intermediate"
          : "中等"
        : faq.difficulty === "beginner"
          ? lang === "en"
            ? "Beginner"
            : "简单"
          : null;

  const displayTags = faq.tags.slice(0, 3);

  return (
    <div
      className={`group relative rounded-2xl shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] ${config.borderClass} ${config.bgClass}`}
    >
      <div className="p-4 sm:p-5">
        {/* Header: ID + Title */}
        <div className="mb-2 flex items-start gap-2">
          <span className="shrink-0 font-mono text-xs font-medium text-subtext">
            #{faq_id}
          </span>
          <Link
            href={`/faq/${faq_id}`}
            className="min-w-0 flex-1 text-base font-semibold leading-snug text-text transition-colors hover:text-primary sm:text-lg"
          >
            {title}
          </Link>
        </div>

        {/* Summary */}
        <p className="mb-3 line-clamp-2 text-sm leading-relaxed text-subtext">
          {summary}
        </p>

        {/* Metadata Row */}
        <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-subtext">
          {difficultyText && (
            <span className="inline-flex items-center gap-1">
              <DifficultyIcon level={faq.difficulty} />
              <span>{difficultyText}</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <UpvoteIcon />
            <span>
              {faq.upvoteCount || 0} {lang === "en" ? "votes" : "赞"}
            </span>
          </span>
          <span>{faq.date}</span>
        </div>

        {/* Tags */}
        {displayTags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {displayTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-primary"
              >
                {translateTag(tag, lang)}
              </span>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {learning_status === "unread" && (
            <button
              onClick={() => onUpdateStatus(faq_id, "learning")}
              disabled={isPending}
              className="inline-flex h-9 min-h-[44px] items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50 sm:h-8 sm:min-h-0"
            >
              <BookOpenIcon />
              <span>{lang === "en" ? "Start Learning" : "开始学习"}</span>
            </button>
          )}

          {showMasterButton && learning_status === "learning" && (
            <button
              onClick={() => onUpdateStatus(faq_id, "mastered")}
              disabled={isPending}
              className="inline-flex h-9 min-h-[44px] items-center gap-1.5 rounded-full border border-green-500 bg-white px-4 text-sm font-medium text-green-600 transition-colors hover:bg-green-50 disabled:opacity-50 sm:h-8 sm:min-h-0"
            >
              <CheckCircleIcon />
              <span>{lang === "en" ? "Mark Mastered" : "标记已掌握"}</span>
            </button>
          )}

          <button
            onClick={() => onToggleFavorite(faq_id)}
            disabled={isPending}
            className="ml-auto inline-flex h-9 min-h-[44px] items-center gap-1.5 rounded-full bg-amber-50 px-3 text-sm font-medium text-amber-600 transition-colors hover:bg-amber-100 disabled:opacity-50 sm:h-8 sm:min-h-0"
            title={lang === "en" ? "Unfavorite" : "取消收藏"}
          >
            <StarIcon filled={true} />
            <span className="hidden sm:inline">
              {lang === "en" ? "Favorited" : "已收藏"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
