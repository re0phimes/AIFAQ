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
          className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-secondary"
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
          className="w-full rounded-lg border border-gray-200 bg-warm-white
            py-3 pl-12 pr-16 text-deep-ink placeholder-slate-secondary
            outline-none transition-shadow focus:border-copper
            focus:ring-2 focus:ring-copper/30"
        />
        <span
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded
            border border-gray-300 bg-code-bg px-1.5 py-0.5
            font-mono text-xs text-slate-secondary"
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
                ? "bg-copper/10 font-medium text-copper"
                : "text-slate-secondary hover:bg-code-bg"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}
