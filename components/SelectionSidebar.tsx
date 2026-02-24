"use client";

import type { FAQItem } from "@/src/types/faq";

interface SelectionSidebarProps {
  items: FAQItem[];
  selectedIds: Set<number>;
  onRemove: (id: number) => void;
  onClear: () => void;
  onCompare: () => void;
}

export default function SelectionSidebar({
  items,
  selectedIds,
  onRemove,
  onClear,
  onCompare,
}: SelectionSidebarProps) {
  const selected = items.filter((item) => selectedIds.has(item.id));

  if (selected.length === 0) return null;

  return (
    <>
      {/* Desktop: right sidebar */}
      <aside
        className="hidden shrink-0 md:block"
        style={{ width: 240 }}
      >
        <div className="sticky top-6 rounded-lg border border-gray-200
          bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-deep-ink">
              已选 ({selected.length})
            </span>
            <button
              onClick={onClear}
              className="text-xs text-slate-secondary hover:text-copper"
            >
              清空
            </button>
          </div>
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {selected.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-1.5 rounded px-2 py-1
                  text-xs hover:bg-code-bg"
              >
                <span className="shrink-0 font-mono text-copper">
                  {item.id}.
                </span>
                <span className="min-w-0 flex-1 truncate text-deep-ink">
                  {item.question}
                </span>
                <button
                  onClick={() => onRemove(item.id)}
                  className="shrink-0 text-slate-secondary hover:text-copper"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <button
            onClick={onCompare}
            className="mt-3 w-full rounded-md bg-copper py-1.5 text-sm
              font-medium text-white transition-colors hover:bg-copper-light"
          >
            对比查看
          </button>
        </div>
      </aside>

      {/* Mobile: bottom floating bar */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200
          bg-white/95 px-4 py-3 backdrop-blur-sm md:hidden"
      >
        <div className="flex items-center justify-between">
          <span className="text-sm text-deep-ink">
            已选 {selected.length} 题
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClear}
              className="rounded-md border border-gray-300 px-3 py-1
                text-xs text-slate-secondary"
            >
              清空
            </button>
            <button
              onClick={onCompare}
              className="rounded-md bg-copper px-3 py-1 text-xs
                font-medium text-white"
            >
              对比查看
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
