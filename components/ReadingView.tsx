"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import ReferenceList from "./ReferenceList";
import type { FAQItem } from "@/src/types/faq";

interface ReadingViewProps {
  items: FAQItem[];
  onBack: () => void;
  onRemove: (id: number) => void;
}

export default function ReadingView({
  items,
  onBack,
  onRemove,
}: ReadingViewProps) {
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set());

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
          className="flex items-center gap-1 text-sm text-slate-secondary
            hover:text-copper"
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
          返回列表
        </button>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-secondary">
            {items.length} 题
          </span>
          <button
            onClick={handleExpandAll}
            className="rounded-md border border-gray-200 px-2 py-1
              text-xs text-slate-secondary hover:bg-code-bg"
          >
            全部展开
          </button>
          <button
            onClick={handleCollapseAll}
            className="rounded-md border border-gray-200 px-2 py-1
              text-xs text-slate-secondary hover:bg-code-bg"
          >
            全部折叠
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-md bg-copper px-3
              py-1.5 text-sm font-medium text-white transition-colors
              hover:bg-copper-light"
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
            导出 PDF
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
              className="rounded-lg border border-gray-200 bg-white p-4
                shadow-sm md:p-6"
            >
              <div
                className="flex cursor-pointer items-start justify-between"
                onClick={() => toggleCollapse(item.id)}
              >
                <div className="flex items-start gap-3">
                  <span className="shrink-0 font-serif text-xl font-bold
                    text-copper md:text-2xl">
                    {item.id}
                  </span>
                  <div>
                    <h2 className="text-sm font-medium text-deep-ink
                      md:text-base">
                      {item.question}
                    </h2>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <span className="text-[11px] text-slate-secondary">
                        {item.date}
                      </span>
                      {item.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-code-bg px-2 py-0.5
                            font-mono text-[10px] text-slate-secondary"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 print:hidden">
                  <svg
                    className={`h-4 w-4 text-slate-secondary transition-transform
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
                    className="rounded p-1 text-slate-secondary
                      hover:bg-code-bg hover:text-copper"
                    title="移除"
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
                  <div className="prose prose-sm max-w-none text-deep-ink
                    [&_code]:rounded [&_code]:bg-code-bg [&_code]:px-1.5
                    [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-sm
                    [&_pre]:rounded-lg [&_pre]:bg-code-bg [&_pre]:p-4
                    [&_pre_code]:bg-transparent [&_pre_code]:p-0
                    [&_.katex-display]:overflow-x-auto
                    [&_.katex-display]:py-2"
                  >
                    <ReactMarkdown
                      remarkPlugins={[[remarkMath, { singleDollarTextMath: true }]]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {item.answer}
                    </ReactMarkdown>
                  </div>
                  <ReferenceList references={item.references} />
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
