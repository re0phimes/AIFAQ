"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import MarkdownContent from "@/components/MarkdownContent";
import type { FAQItem } from "@/src/types/faq";

interface FAQDetailClientProps {
  faq: FAQItem;
  isFavorited: boolean;
  learningStatus: string | null;
}

export default function FAQDetailClient({ faq, isFavorited, learningStatus }: FAQDetailClientProps) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-text">{faq.question}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            {faq.tags.map(tag => (
              <span key={tag} className="rounded-full bg-surface px-2 py-1 text-xs text-subtext">
                {tag}
              </span>
            ))}
          </div>
        </div>

        {isFavorited && learningStatus === 'learning' && (
          <button
            onClick={handleMarkMastered}
            disabled={updating}
            className="ml-4 rounded-full border border-green-500 px-4 py-2 text-sm text-green-600 hover:bg-green-50 disabled:opacity-50"
          >
            {updating ? '更新中...' : '标记为已内化'}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="prose prose-sm max-w-none">
        <MarkdownContent content={faq.answer} />
      </div>

      {/* Back button */}
      <div className="pt-4">
        <button
          onClick={() => router.back()}
          className="text-sm text-primary hover:underline"
        >
          ← 返回
        </button>
      </div>
    </div>
  );
}
