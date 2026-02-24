"use client";

interface TagFilterProps {
  allTags: string[];
  tagCounts: Map<string, number>;
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  onClearTags: () => void;
}

const HOT_THRESHOLD = 5;

export default function TagFilter({
  allTags,
  tagCounts,
  selectedTags,
  onToggleTag,
  onClearTags,
}: TagFilterProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-secondary">
          标签筛选
        </span>
        {selectedTags.length > 0 && (
          <button
            onClick={onClearTags}
            className="rounded-full border border-copper px-2.5 py-0.5
              text-xs text-copper transition-colors
              hover:bg-copper hover:text-white"
          >
            清除 ({selectedTags.length})
          </button>
        )}
      </div>
      <div
        className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto
          pr-1 md:max-h-48"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {allTags.map((tag) => {
          const isSelected = selectedTags.includes(tag);
          const count = tagCounts.get(tag) ?? 0;
          const isHot = count >= HOT_THRESHOLD;
          return (
            <button
              key={tag}
              onClick={() => onToggleTag(tag)}
              className={`inline-flex items-center gap-1 rounded-full
                px-2.5 py-1 font-mono text-xs leading-none
                transition-colors duration-150 ${
                  isSelected
                    ? "bg-copper text-white"
                    : "bg-code-bg text-deep-ink hover:bg-gray-200"
                }`}
            >
              {isHot && (
                <span className="text-[10px]" title={`${count} 条相关`}>
                  🔥
                </span>
              )}
              {tag}
              <span
                className={`ml-0.5 text-[10px] ${
                  isSelected ? "text-white/70" : "text-slate-secondary"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
