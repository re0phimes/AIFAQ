"use client";

import { useState } from "react";
import type { Reference } from "@/src/types/faq";
import { t } from "@/lib/i18n";

interface ReferenceListProps {
  references: Reference[];
  lang?: "zh" | "en";
}

export default function ReferenceList({ references, lang = "zh" }: ReferenceListProps) {
  const [expanded, setExpanded] = useState(true);

  if (references.length === 0) return null;

  // Desktop: show collapsed summary; Mobile: always show full list
  return (
    <div className="mt-3 rounded border-[0.5px] border-border bg-surface/50 px-3 py-2
      md:px-4 md:py-3">
      {/* Mobile: always full list */}
      <div className="md:hidden">
        <p className="mb-1.5 text-xs font-medium text-subtext">
          {t("references", lang)}
        </p>
        <RefItems references={references} />
      </div>

      {/* Desktop: collapsible */}
      <div className="hidden md:block">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-between text-left"
        >
          <span className="text-sm font-medium text-subtext">
            {t("references", lang)} ({references.length})
          </span>
          <svg
            className={`h-4 w-4 text-subtext transition-transform
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
          <p className="mt-1 truncate text-xs text-subtext/70">
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
            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium md:text-xs ${
              ref.type === "paper"
                ? "bg-blue-100 text-blue-700"
                : ref.type === "blog"
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-700"
            }`}>
              {ref.type === "paper" ? "Paper" : ref.type === "blog" ? "Blog" : "Ref"}
            </span>
            {ref.url ? (
              <a
                href={ref.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`break-all underline-offset-2 hover:underline ${
                  isPhimes
                    ? "font-medium text-red-600"
                    : "text-primary"
                }`}
              >
                {displayTitle}
              </a>
            ) : (
              <span className={isPhimes ? "font-medium text-red-600" : "text-subtext"}>
                {displayTitle}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
