"use client";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const PAGE_SIZES = [10, 20, 50];

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  if (left > 2) pages.push("...");
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < total - 1) pages.push("...");
  pages.push(total);
  return pages;
}

export default function Pagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row
      sm:justify-between">
      {/* Left: info + page size */}
      <div className="flex items-center gap-3 text-xs text-subtext">
        <span>
          共 {totalItems} 条，第 {currentPage}/{totalPages} 页
        </span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="rounded border border-border bg-panel px-2 py-1 text-xs
            text-text"
        >
          {PAGE_SIZES.map((s) => (
            <option key={s} value={s}>
              每页 {s} 条
            </option>
          ))}
        </select>
      </div>

      {/* Right: page navigation */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="rounded px-2 py-1 text-xs text-subtext
            hover:bg-surface disabled:opacity-30 disabled:hover:bg-transparent"
        >
          上一页
        </button>
        {getPageNumbers(currentPage, totalPages).map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="px-1 text-xs text-subtext">
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`min-w-[28px] rounded px-2 py-1 text-xs transition-colors ${
                p === currentPage
                  ? "bg-primary font-medium text-white"
                  : "text-text hover:bg-surface"
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="rounded px-2 py-1 text-xs text-subtext
            hover:bg-surface disabled:opacity-30 disabled:hover:bg-transparent"
        >
          下一页
        </button>
      </div>
    </div>
  );
}
