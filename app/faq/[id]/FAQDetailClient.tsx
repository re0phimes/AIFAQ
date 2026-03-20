"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "@/lib/i18n";
import { getFacetLabel, getPrimaryCategoryLabel } from "@/lib/taxonomy";
import MarkdownContent from "@/components/MarkdownContent";
import type { FAQItem } from "@/src/types/faq";

interface FAQDetailClientProps {
  faq: FAQItem;
  isFavorited: boolean;
  learningStatus: string | null;
  lang: "zh" | "en";
}

export default function FAQDetailClient({ faq, isFavorited, learningStatus, lang }: FAQDetailClientProps) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);
  const taxonomyPills = [
    faq.primaryCategory
      ? { key: `primary:${faq.primaryCategory}`, label: getPrimaryCategoryLabel(faq.primaryCategory, lang) }
      : null,
    faq.secondaryCategory
      ? { key: `secondary:${faq.secondaryCategory}`, label: getPrimaryCategoryLabel(faq.secondaryCategory, lang) }
      : null,
    ...(faq.topics ?? []).slice(0, 2).map((topic) => ({
      key: `topic:${topic}`,
      label: getFacetLabel("topic", topic, lang),
    })),
  ].filter((pill): pill is { key: string; label: string } => pill !== null);

  const handleMarkMastered = async () => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/favorites/${faq.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'mastered' })
      });
      if (res.ok) {
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-text">{faq.question}</h1>
          {taxonomyPills.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {taxonomyPills.map((pill) => (
                <span key={pill.key} className="rounded-full bg-surface px-2 py-1 text-xs text-subtext">
                  {pill.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {isFavorited && learningStatus === 'learning' && (
          <button
            onClick={handleMarkMastered}
            disabled={updating}
            className="rounded-full border border-green-500 px-4 py-2 text-sm text-green-600 hover:bg-green-50 disabled:opacity-50 sm:ml-4"
          >
            {updating ? t("updating", lang) : t("markAsMastered", lang)}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 overflow-x-hidden">
        <MarkdownContent
          className="prose prose-sm min-w-0 max-w-none text-text [&_pre]:max-w-full [&_pre]:text-[13px]"
          content={faq.answer}
        />
      </div>

      {/* Back button */}
      <div className="pt-4">
        <button
          onClick={() => router.back()}
          className="text-sm text-primary hover:underline"
        >
          {t("backButton", lang)}
        </button>
      </div>
    </div>
  );
}
