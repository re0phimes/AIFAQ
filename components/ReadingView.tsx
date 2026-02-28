"use client";

import { useState } from "react";
import MarkdownContent from "./MarkdownContent";
import ReferenceList from "./ReferenceList";
import type { FAQItem } from "@/src/types/faq";
import { t, translateTag, itemsCount } from "@/lib/i18n";

interface ReadingViewProps {
  items: FAQItem[];
  lang?: "zh" | "en";
  onBack: () => void;
  onRemove: (id: number) => void;
}

export default function ReadingView({
  items,
  lang = "zh",
  onBack,
  onRemove,
}: ReadingViewProps) {
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set());
  const [globalDetailed, setGlobalDetailed] = useState(false);
  const [itemDetailOverrides, setItemDetailOverrides] = useState<Map<number, boolean>>(new Map());

  function isDetailed(id: number): boolean {
    return itemDetailOverrides.get(id) ?? globalDetailed;
  }

  function handlePrint(): void {
    window.print();
  }

  function handleExpandAll(): void {
    setCollapsedIds(new Set());
  }

  function handleCollapseAll(): void {
    setCollapsedIds(new Set(items.map((item) => item.id)));
  }

  function toggleCollapse(id: number): void {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="reading-view">
      {/* Toolbar - hidden when printing */}
      <div className="mb-6 flex items-center justify-between print:hidden">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-subtext
            hover:text-primary"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          {t("backToList", lang)}
        </button>
        <div className="flex items-center gap-3">
          <span className="text-xs text-subtext">
            {itemsCount(items.length, lang)}
          </span>
          <button
            onClick={handleExpandAll}
            className="rounded-full border-[0.5px] border-border px-2 py-1
              text-xs text-subtext hover:bg-surface"
          >
            {t("expandAll", lang)}
          </button>
          <button
            onClick={handleCollapseAll}
            className="rounded-full border-[0.5px] border-border px-2 py-1
              text-xs text-subtext hover:bg-surface"
          >
            {t("collapseAll", lang)}
          </button>
          <button
            onClick={() => { setGlobalDetailed(false); setItemDetailOverrides(new Map()); }}
            className={`rounded-full border-[0.5px] border-border px-2 py-1 text-xs ${
              !globalDetailed ? "bg-primary text-white border-primary" : "text-subtext hover:bg-surface"
            }`}
          >
            {t("allBrief", lang)}
          </button>
          <button
            onClick={() => { setGlobalDetailed(true); setItemDetailOverrides(new Map()); }}
            className={`rounded-full border-[0.5px] border-border px-2 py-1 text-xs ${
              globalDetailed ? "bg-primary text-white border-primary" : "text-subtext hover:bg-surface"
            }`}
          >
            {t("allDetailed", lang)}
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-full bg-primary px-3
              py-1.5 text-sm font-medium text-white transition-colors
              hover:bg-primary-hover"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            {t("exportPdf", lang)}
          </button>
        </div>
      </div>

      {/* Reading content */}
      <div className="space-y-6">
        {items.map((item) => {
          const isCollapsed = collapsedIds.has(item.id);
          return (
            <article
              key={item.id}
              className="rounded-xl border-[0.5px] border-border bg-panel p-4
                shadow-sm md:p-6"
            >
              <div
                className="flex cursor-pointer items-start justify-between"
                onClick={() => toggleCollapse(item.id)}
              >
                <div className="flex items-start gap-3">
                  <span className="shrink-0 font-brand text-xl font-bold
                    text-primary md:text-2xl">
                    {item.id}
                  </span>
                  <div>
                    <h2 className="text-sm font-medium text-text
                      md:text-base">
                      {lang === "en" && item.questionEn ? item.questionEn : item.question}
                    </h2>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <span className="text-[11px] text-subtext">
                        {item.date}
                      </span>
                      {item.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border-[0.5px] border-border bg-panel px-2 py-0.5
                            font-medium text-xs text-primary"
                        >
                          {translateTag(tag, lang)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 print:hidden">
                  <svg
                    className={`h-4 w-4 text-subtext transition-transform
                      duration-200 ${isCollapsed ? "" : "rotate-180"}`}
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
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(item.id);
                    }}
                    className="rounded p-1 text-subtext
                      hover:bg-surface hover:text-primary"
                    title={t("remove", lang)}
                  >
                    <svg
                      className="h-4 w-4"
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
              </div>

              {!isCollapsed && (
                <div className="mt-3">
                  {item.answerBrief && (
                    <div className="mb-3 flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setItemDetailOverrides(prev => { const n = new Map(prev); n.set(item.id, false); return n; });
                        }}
                        className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                          !isDetailed(item.id)
                            ? "bg-primary text-white"
                            : "border-[0.5px] border-border text-subtext hover:bg-surface"
                        }`}
                      >
                        {t("brief", lang)}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setItemDetailOverrides(prev => { const n = new Map(prev); n.set(item.id, true); return n; });
                        }}
                        className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                          isDetailed(item.id)
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
                    content={isDetailed(item.id)
                      ? (lang === "en" && item.answerEn ? item.answerEn : item.answer)
                      : (lang === "en" && item.answerBriefEn
                          ? item.answerBriefEn
                          : (item.answerBrief ?? item.answer))}
                  />
                  {isDetailed(item.id) && item.images && item.images.length > 0 && (
                    <div className="mt-4 space-y-3 print:hidden">
                      {item.images.map((img, i) => (
                        <figure key={i} className="overflow-hidden rounded-lg border-[0.5px] border-border">
                          <a href={img.url} target="_blank" rel="noopener noreferrer">
                            <img src={img.url} alt={img.caption} className="w-full object-contain" loading="lazy" />
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
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
