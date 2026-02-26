"use client";

import { useState } from "react";
import type { Reference } from "@/src/types/faq";

interface ReferenceListProps {
  references: Reference[];
}

export default function ReferenceList({ references }: ReferenceListProps) {
  const [expanded, setExpanded] = useState(true);

  if (references.length === 0) return null;

  // Desktop: show collapsed summary; Mobile: always show full list
  return (
    <div className="mt-3 rounded border border-gray-200 bg-code-bg/50 px-3 py-2
      md:px-4 md:py-3">
      {/* Mobile: always full list */}
      <div className="md:hidden">
        <p className="mb-1.5 text-xs font-medium text-slate-secondary">
          参考来源
        </p>
        <RefItems references={references} />
      </div>

      {/* Desktop: collapsible */}
      <div className="hidden md:block">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-between text-left"
        >
          <span className="text-sm font-medium text-slate-secondary">
            参考来源 ({references.length})
          </span>
          <svg
            className={`h-4 w-4 text-slate-secondary transition-transform
              duration-150 ${expanded ? "rotate-180" : ""}`}
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
        {!expanded && (
          <p className="mt-1 truncate text-xs text-slate-secondary/70">
            {references.map((r) => r.title).join(" · ")}
          </p>
        )}
        {expanded && (
          <div className="mt-2">
            <RefItems references={references} />
          </div>
        )}
      </div>
    </div>
  );
}

function RefItems({ references }: { references: Reference[] }) {
  return (
    <ul className="space-y-1">
      {references.map((ref, i) => {
        const isPhimes = ref.author === "Phimes";
        const displayTitle = ref.author
          ? `${ref.author} · ${ref.title}`
          : ref.title;

        return (
          <li key={i} className="flex items-start gap-2 text-xs md:text-sm">
            <span className="shrink-0 text-slate-secondary">
              {ref.type === "paper" ? "📄" : ref.type === "blog" ? "📖" : "📌"}
            </span>
            {ref.url ? (
              <a
                href={ref.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`break-all underline-offset-2 hover:underline ${
                  isPhimes
                    ? "font-medium text-red-600"
                    : "text-copper"
                }`}
              >
                {displayTitle}
              </a>
            ) : (
              <span className={isPhimes ? "font-medium text-red-600" : "text-slate-secondary"}>
                {displayTitle}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
