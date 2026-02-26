"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import ReferenceList from "./ReferenceList";
import type { FAQItem as FAQItemType, VoteType } from "@/src/types/faq";

interface FAQItemProps {
  item: FAQItemType;
  isOpen: boolean;
  isSelected: boolean;
  showCheckbox: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onVote: (type: VoteType, reason?: string, detail?: string) => void;
  onRevokeVote: () => void;
  currentVote: VoteType | null;
}

const DOWNVOTE_REASONS = [
  { value: "outdated", label: "过时" },
  { value: "factual_error", label: "不准确" },
  { value: "unclear", label: "表述不清" },
  { value: "other", label: "其他" },
] as const;

function DownvotePanel({
  onSubmit,
  onCancel,
}: {
  onSubmit: (reason: string, detail: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  return (
    <div className="mt-2 rounded-lg border border-gray-200 bg-code-bg/50 p-3"
      onClick={(e) => e.stopPropagation()}>
      <p className="mb-2 text-xs font-medium text-slate-secondary">
        请选择反馈原因:
      </p>
      <div className="flex flex-wrap gap-1.5">
        {DOWNVOTE_REASONS.map((r) => (
          <button
            key={r.value}
            onClick={() => setReason(r.value)}
            className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
              reason === r.value
                ? "bg-copper text-white"
                : "bg-white border border-gray-200 text-deep-ink hover:bg-gray-100"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <textarea
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        placeholder="补充说明 (可选)"
        className="mt-2 w-full rounded border border-gray-200 bg-white px-2 py-1.5
          text-xs text-deep-ink placeholder:text-slate-secondary/50
          focus:border-copper focus:outline-none"
        rows={2}
      />
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => reason && onSubmit(reason, detail)}
          disabled={!reason}
          className="rounded-md bg-copper px-3 py-1 text-xs text-white
            transition-colors hover:bg-copper-light disabled:opacity-40"
        >
          提交
        </button>
        <button
          onClick={onCancel}
          className="rounded-md border border-gray-200 px-3 py-1 text-xs
            text-slate-secondary hover:bg-gray-100"
        >
          取消
        </button>
      </div>
    </div>
  );
}

export default function FAQItem({
  item,
  isOpen,
  isSelected,
  showCheckbox,
  onToggle,
  onSelect,
  onVote,
  onRevokeVote,
  currentVote,
}: FAQItemProps) {
  const [showDownvotePanel, setShowDownvotePanel] = useState(false);
  const hasTimelinessWarning = (item.downvoteCount ?? 0) >= 3;

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
              onChange={onSelect}
              className="h-4 w-4 cursor-pointer rounded border-gray-300
                accent-copper"
            />
          </label>
        )}

        {/* Question button */}
        <button
          onClick={onToggle}
          className={`flex min-w-0 flex-1 items-start gap-3 py-3 pr-4
            text-left hover:bg-code-bg/30 md:gap-4 md:py-4 md:pr-5 ${
              showCheckbox ? "" : "pl-4 md:pl-5"
            }`}
        >
          <span className="shrink-0 font-serif text-xl font-bold
            text-copper md:text-2xl">
            {item.id}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-medium leading-snug
              text-deep-ink md:text-base">
              {item.question}
              {hasTimelinessWarning && (
                <span className="ml-1.5 inline-block rounded bg-amber-100
                  px-1.5 py-0.5 align-middle text-[10px] text-amber-700"
                  title="多人反馈此内容可能过期或不准确">
                  待更新
                </span>
              )}
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
          <div className={`answer-scroll px-4 pb-4 ${
            showCheckbox ? "pl-10 md:pl-14" : "pl-4 md:pl-5"
          }`}>
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
            {/* Vote buttons — up/down 互斥 */}
            <div className="mt-3 flex items-center gap-3 border-t border-gray-100 pt-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (currentVote === "upvote") {
                    onRevokeVote();
                  } else {
                    onVote("upvote");
                  }
                }}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1
                  text-xs transition-colors ${
                    currentVote === "upvote"
                      ? "bg-green-100 text-green-700"
                      : "text-slate-secondary hover:bg-code-bg"
                  }`}
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor"
                  viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z M2 13h2v9H2z" />
                </svg>
                有用
                {(item.upvoteCount ?? 0) > 0 && (
                  <span className="font-mono text-[10px]">{item.upvoteCount}</span>
                )}
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (currentVote === "downvote") {
                    onRevokeVote();
                    setShowDownvotePanel(false);
                  } else {
                    setShowDownvotePanel((v) => !v);
                  }
                }}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1
                  text-xs transition-colors ${
                    currentVote === "downvote"
                      ? "bg-red-100 text-red-600"
                      : "text-slate-secondary hover:bg-code-bg"
                  }`}
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor"
                  viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M10 15V19a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z M22 2h-2v9h2z" />
                </svg>
                反馈
                {(item.downvoteCount ?? 0) > 0 && (
                  <span className="font-mono text-[10px]">{item.downvoteCount}</span>
                )}
              </button>
            </div>
            {showDownvotePanel && currentVote !== "downvote" && (
              <DownvotePanel
                onSubmit={(reason, detail) => {
                  onVote("downvote", reason, detail);
                  setShowDownvotePanel(false);
                }}
                onCancel={() => setShowDownvotePanel(false)}
              />
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
