"use client";

export type SearchMode = "combined" | "tag" | "content";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  mode: SearchMode;
  onModeChange: (mode: SearchMode) => void;
}

const MODES: { key: SearchMode; label: string }[] = [
  { key: "combined", label: "组合" },
  { key: "tag", label: "标签" },
  { key: "content", label: "全文" },
];

export default function SearchBar({
  value,
  onChange,
  mode,
  onModeChange,
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
          placeholder={
            mode === "tag"
              ? "输入标签名..."
              : mode === "content"
                ? "搜索答案内容..."
                : "搜索问题..."
          }
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
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => onModeChange(m.key)}
            className={`rounded-md px-3 py-1 text-xs transition-colors ${
              mode === m.key
                ? "bg-primary/10 font-medium text-primary"
                : "text-subtext hover:bg-surface"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}
