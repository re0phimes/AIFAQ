"use client";

import { t } from "@/lib/i18n";

export type SearchMode = "combined" | "tag" | "content";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  mode: SearchMode;
  onModeChange: (mode: SearchMode) => void;
  lang?: "zh" | "en";
}

const MODE_KEYS: SearchMode[] = ["combined", "tag", "content"];

const MODE_LABEL_KEYS = {
  combined: "searchCombined",
  tag: "searchTag",
  content: "searchContent",
} as const;

const PLACEHOLDER_KEYS = {
  combined: "searchPlaceholderCombined",
  tag: "searchPlaceholderTag",
  content: "searchPlaceholderContent",
} as const;

export default function SearchBar({
  value,
  onChange,
  mode,
  onModeChange,
  lang = "zh",
}: SearchBarProps) {
  return (
    <div>
      <div className="relative">
        <svg
          className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-subtext"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t(PLACEHOLDER_KEYS[mode], lang)}
          className="w-full rounded-full border-[0.5px] border-border bg-bg
            py-3 pl-12 pr-16 text-text placeholder-subtext
            outline-none transition-shadow focus:border-primary
            focus:ring-2 focus:ring-primary/30"
        />
        <span
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded
            border border-border bg-surface px-1.5 py-0.5
            font-mono text-xs text-subtext"
        >
          ⌘K
        </span>
      </div>
      <div className="mt-2 flex gap-1">
        {MODE_KEYS.map((m) => (
          <button
            key={m}
            onClick={() => onModeChange(m)}
            className={`rounded-md px-3 py-1 text-xs transition-colors ${
              mode === m
                ? "bg-primary/10 font-medium text-primary"
                : "text-subtext hover:bg-surface"
            }`}
          >
            {t(MODE_LABEL_KEYS[m], lang)}
          </button>
        ))}
      </div>
    </div>
  );
}
