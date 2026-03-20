"use client";

import { t, paginationInfo, perPageLabel } from "@/lib/i18n";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  lang?: "zh" | "en";
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
  lang = "zh",
}: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="mt-4 flex max-w-full flex-col items-stretch gap-3 sm:flex-row
      sm:justify-between">
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-subtext sm:justify-start sm:gap-3">
        <span>
          {paginationInfo(totalItems, currentPage, totalPages, lang)}
        </span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="rounded border border-border bg-panel px-2 py-1 text-xs
            text-text"
        >
          {PAGE_SIZES.map((s) => (
            <option key={s} value={s}>
              {perPageLabel(s, lang)}
            </option>
          ))}
        </select>
      </div>

      <div className="w-full overflow-x-auto pb-1 sm:w-auto sm:overflow-visible sm:pb-0">
        <div className="flex min-w-max items-center gap-1 sm:min-w-0">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="shrink-0 rounded px-2 py-1 text-xs text-subtext
              hover:bg-surface disabled:opacity-30 disabled:hover:bg-transparent"
          >
            {t("prevPage", lang)}
          </button>
          {getPageNumbers(currentPage, totalPages).map((p, i) =>
            p === "..." ? (
              <span key={`ellipsis-${i}`} className="shrink-0 px-1 text-xs text-subtext">
                ...
              </span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`min-w-[28px] shrink-0 rounded px-2 py-1 text-xs transition-colors ${
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
            className="shrink-0 rounded px-2 py-1 text-xs text-subtext
              hover:bg-surface disabled:opacity-30 disabled:hover:bg-transparent"
          >
            {t("nextPage", lang)}
          </button>
        </div>
      </div>
    </div>
  );
}
