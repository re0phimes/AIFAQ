"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import ReferenceList from "./ReferenceList";
import type { FAQItem as FAQItemType } from "@/src/types/faq";

interface FAQItemProps {
  item: FAQItemType;
  isOpen: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onSelect: () => void;
}

export default function FAQItem({
  item,
  isOpen,
  isSelected,
  onToggle,
  onSelect,
}: FAQItemProps) {
  return (
    <article
      className={`rounded-lg border transition-colors duration-200 ${
        isOpen
          ? "border-copper/40 bg-white shadow-sm"
          : isSelected
            ? "border-copper/20 bg-copper/5"
            : "border-gray-200 bg-white/60"
      }`}
    >
      <div className="flex items-start">
        {/* Checkbox */}
        <label
          className="flex shrink-0 cursor-pointer items-center
            self-stretch px-2 py-3 md:px-3 md:py-4"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onSelect}
            className="h-4 w-4 cursor-pointer rounded border-gray-300
              accent-copper"
          />
        </label>

        {/* Question button */}
        <button
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-start gap-3 py-3 pr-4
            text-left hover:bg-code-bg/30 md:gap-4 md:py-4 md:pr-5"
        >
          <span className="shrink-0 font-serif text-xl font-bold
            text-copper md:text-2xl">
            {item.id}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-medium leading-snug
              text-deep-ink md:text-base">
              {item.question}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-secondary md:text-xs">
                {item.date}
              </span>
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className="hidden rounded-full bg-code-bg px-2 py-0.5
                    font-mono text-[10px] text-slate-secondary
                    md:inline-block md:text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <svg
            className={`mt-1 h-4 w-4 shrink-0 text-slate-secondary
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
          <div className="answer-scroll px-4 pb-4 pl-10 md:pl-14">
            <div className="prose prose-sm max-w-none text-deep-ink
              [&_code]:rounded [&_code]:bg-code-bg [&_code]:px-1.5
              [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-sm
              [&_pre]:rounded-lg [&_pre]:bg-code-bg [&_pre]:p-4
              [&_pre_code]:bg-transparent [&_pre_code]:p-0
              [&_.katex-display]:overflow-x-auto
              [&_.katex-display]:py-2"
            >
              <ReactMarkdown
                remarkPlugins={[remarkMath]}
                rehypePlugins={[rehypeKatex]}
              >
                {item.answer}
              </ReactMarkdown>
            </div>
            <ReferenceList references={item.references} />
          </div>
        </div>
      </div>
    </article>
  );
}
