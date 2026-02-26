"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import SearchBar, { type SearchMode } from "./SearchBar";
import TagFilter from "./TagFilter";
import FAQItem from "./FAQItem";
import SelectionSidebar from "./SelectionSidebar";
import ReadingView from "./ReadingView";
import Pagination from "./Pagination";
import BackToTop from "./BackToTop";
import taxonomy from "@/data/tag-taxonomy.json";
import type {
  FAQItem as FAQItemType,
  TagTaxonomy,
  VoteType,
} from "@/src/types/faq";

interface FAQListProps {
  items: FAQItemType[];
}

const LS_KEY = "aifaq-selected";
const LS_PAGESIZE = "aifaq-pagesize";
const LS_VOTED = "aifaq-voted";

function loadSelected(): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return new Set(JSON.parse(raw) as number[]);
  } catch { /* ignore */ }
  return new Set();
}

function loadPageSize(): number {
  if (typeof window === "undefined") return 20;
  return Number(localStorage.getItem(LS_PAGESIZE)) || 20;
}

function loadVotedMap(): Map<number, VoteType> {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = localStorage.getItem(LS_VOTED);
    if (raw) {
      const obj = JSON.parse(raw) as Record<string, VoteType>;
      const map = new Map<number, VoteType>();
      for (const [k, v] of Object.entries(obj)) {
        map.set(Number(k), v);
      }
      return map;
    }
  } catch { /* ignore */ }
  return new Map();
}

function saveVotedMap(map: Map<number, VoteType>): void {
  const obj: Record<string, VoteType> = {};
  for (const [k, v] of map) obj[String(k)] = v;
  localStorage.setItem(LS_VOTED, JSON.stringify(obj));
}

export default function FAQList({ items }: FAQListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("combined");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [openItems, setOpenItems] = useState<Set<number>>(new Set());
  const [selectedItems, setSelectedItems] = useState<Set<number>>(loadSelected);
  const [view, setView] = useState<"list" | "reading">("list");
  const [compareMode, setCompareMode] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(loadPageSize);
  const [votedMap, setVotedMap] = useState<Map<number, VoteType>>(loadVotedMap);
  const [fingerprint, setFingerprint] = useState("");
  const [headerVisible, setHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);

  // Load fingerprint
  useEffect(() => {
    import("@fingerprintjs/fingerprintjs").then((FP) =>
      FP.load().then((fp) =>
        fp.get().then((r) => setFingerprint(r.visitorId))
      )
    );
  }, []);

  // Restore votes from server when fingerprint is available
  useEffect(() => {
    if (!fingerprint) return;
    fetch(`/api/faq/votes?fingerprint=${fingerprint}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data: Record<string, string> | null) => {
        if (!data) return;
        const map = new Map<number, VoteType>();
        for (const [k, v] of Object.entries(data)) {
          if (v === "upvote" || v === "downvote") {
            map.set(Number(k), v as VoteType);
          }
        }
        setVotedMap(map);
        saveVotedMap(map);
      })
      .catch(() => { /* network error, use localStorage fallback */ });
  }, [fingerprint]);

  // Hide header on scroll down, show on scroll up
  useEffect(() => {
    const THRESHOLD = 10;
    function handleScroll() {
      const currentY = window.scrollY;
      if (Math.abs(currentY - lastScrollY.current) < THRESHOLD) return;
      setHeaderVisible(currentY < lastScrollY.current || currentY < 80);
      lastScrollY.current = currentY;
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Persist selection
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify([...selectedItems]));
  }, [selectedItems]);

  // Persist pageSize
  useEffect(() => {
    localStorage.setItem(LS_PAGESIZE, String(pageSize));
  }, [pageSize]);

  const { allTags, tagCounts } = useMemo(() => {
    const freq = new Map<string, number>();
    for (const item of items) {
      for (const tag of item.tags) {
        freq.set(tag, (freq.get(tag) ?? 0) + 1);
      }
    }
    const sorted = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag);
    return { allTags: sorted, tagCounts: freq };
  }, [items]);

  // 构建 category -> tags 映射
  const categoryTagsMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const cat of (taxonomy as TagTaxonomy).categories) {
      map.set(cat.name, new Set(cat.tags));
    }
    return map;
  }, []);

  // Filter logic
  const filtered = useMemo(() => {
    let result = items;
    const q = searchQuery.trim().toLowerCase();

    if (q) {
      switch (searchMode) {
        case "tag":
          result = result.filter((item) =>
            item.tags.some((tag) => tag.toLowerCase().includes(q))
          );
          break;
        case "content":
          result = result.filter(
            (item) =>
              item.question.toLowerCase().includes(q) ||
              item.answer.toLowerCase().includes(q)
          );
          break;
        case "combined":
        default:
          result = result.filter(
            (item) =>
              item.question.toLowerCase().includes(q) ||
              item.answer.toLowerCase().includes(q) ||
              item.tags.some((tag) => tag.toLowerCase().includes(q))
          );
          break;
      }
    }

    if (selectedTags.length > 0) {
      result = result.filter((item) =>
        selectedTags.some((tag) => item.tags.includes(tag))
      );
    }

    if (selectedCategories.length > 0) {
      result = result.filter((item) =>
        selectedCategories.some((cat) => {
          const catTags = categoryTagsMap.get(cat);
          return catTags ? item.tags.some((tag) => catTags.has(tag)) : false;
        })
      );
    }

    return result;
  }, [items, searchQuery, searchMode, selectedTags, selectedCategories, categoryTagsMap]);

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, searchMode, selectedTags, selectedCategories]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedItems = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  function handlePageChange(page: number): void {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handlePageSizeChange(size: number): void {
    setPageSize(size);
    setCurrentPage(1);
  }

  function handleToggleCategory(cat: string): void {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  function handleToggleTag(tag: string): void {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  function handleToggleItem(id: number): void {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleToggleSelect(id: number): void {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleExpandAll(): void {
    setOpenItems(new Set(paginatedItems.map((item) => item.id)));
  }

  function handleCollapseAll(): void {
    setOpenItems(new Set());
  }

  function handleToggleCompare(): void {
    if (compareMode) {
      setCompareMode(false);
      setSelectedItems(new Set());
    } else {
      setCompareMode(true);
    }
  }

  const handleVote = useCallback(
    async (faqId: number, type: VoteType, reason?: string, detail?: string) => {
      if (!fingerprint) return;
      const current = votedMap.get(faqId);

      setVotedMap((prev) => {
        const next = new Map(prev);
        next.set(faqId, type);
        saveVotedMap(next);
        return next;
      });

      try {
        const res = await fetch(`/api/faq/${faqId}/vote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, fingerprint, reason, detail }),
        });
        if (!res.ok && res.status !== 409) {
          setVotedMap((prev) => {
            const next = new Map(prev);
            if (current) next.set(faqId, current);
            else next.delete(faqId);
            saveVotedMap(next);
            return next;
          });
        }
      } catch {
        setVotedMap((prev) => {
          const next = new Map(prev);
          if (current) next.set(faqId, current);
          else next.delete(faqId);
          saveVotedMap(next);
          return next;
        });
      }
    },
    [fingerprint, votedMap]
  );

  const handleRevokeVote = useCallback(
    async (faqId: number) => {
      if (!fingerprint) return;
      const current = votedMap.get(faqId);

      setVotedMap((prev) => {
        const next = new Map(prev);
        next.delete(faqId);
        saveVotedMap(next);
        return next;
      });

      try {
        const res = await fetch(`/api/faq/${faqId}/vote`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fingerprint }),
        });
        if (!res.ok) {
          setVotedMap((prev) => {
            const next = new Map(prev);
            if (current) next.set(faqId, current);
            saveVotedMap(next);
            return next;
          });
        }
      } catch {
        setVotedMap((prev) => {
          const next = new Map(prev);
          if (current) next.set(faqId, current);
          saveVotedMap(next);
          return next;
        });
      }
    },
    [fingerprint, votedMap]
  );

  const handleRemoveFromReading = useCallback((id: number) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Reading view
  const readingItems = items.filter((item) => selectedItems.has(item.id));

  if (view === "reading") {
    if (readingItems.length === 0) {
      setView("list");
      return null;
    }
    return (
      <ReadingView
        items={readingItems}
        onBack={() => setView("list")}
        onRemove={handleRemoveFromReading}
      />
    );
  }

  return (
    <>
      <div
        className={`sticky top-0 z-20 -mx-4 bg-warm-white/95 px-4 pb-3 backdrop-blur-sm
          transition-transform duration-300 md:-mx-8 md:px-8 ${
            headerVisible ? "translate-y-0" : "-translate-y-full"
          }`}
      >
        <header className="mb-4 pt-2">
          <h1 className="font-serif text-3xl font-bold text-deep-ink">AIFAQ</h1>
          <p className="mt-1 text-sm text-slate-secondary">
            AI/ML 常见问题知识库
          </p>
        </header>
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          mode={searchMode}
          onModeChange={setSearchMode}
        />
        <div className="mt-3">
          <TagFilter
            taxonomy={taxonomy as TagTaxonomy}
            allTags={allTags}
            tagCounts={tagCounts}
            selectedCategories={selectedCategories}
            selectedTags={selectedTags}
            onToggleCategory={handleToggleCategory}
            onToggleTag={handleToggleTag}
            onClearAll={() => {
              setSelectedTags([]);
              setSelectedCategories([]);
            }}
          />
        </div>
      </div>

      <div className="flex gap-4">
        {/* Main content */}
        <div className="min-w-0 flex-1 space-y-4">

        {/* Toolbar: compare, expand/collapse, info */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={handleToggleCompare}
              className={`rounded-md px-3 py-1 text-xs font-medium
                transition-colors ${
                  compareMode
                    ? "bg-copper text-white"
                    : "border border-gray-200 text-slate-secondary hover:bg-code-bg"
                }`}
            >
              {compareMode ? "退出比较" : "比较"}
            </button>
            <button
              onClick={handleExpandAll}
              className="rounded-md border border-gray-200 px-3 py-1
                text-xs text-slate-secondary hover:bg-code-bg"
            >
              全部展开
            </button>
            <button
              onClick={handleCollapseAll}
              className="rounded-md border border-gray-200 px-3 py-1
                text-xs text-slate-secondary hover:bg-code-bg"
            >
              全部折叠
            </button>
          </div>
          <p className="text-xs text-slate-secondary">
            共 {filtered.length} 条，第 {safePage}/{totalPages} 页
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <svg
              className="mx-auto mb-4 h-12 w-12 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-slate-secondary">没有找到匹配的问题</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {paginatedItems.map((item, index) => (
                <div
                  key={item.id}
                  className="faq-item-enter"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <FAQItem
                    item={item}
                    isOpen={openItems.has(item.id)}
                    isSelected={selectedItems.has(item.id)}
                    showCheckbox={compareMode}
                    onToggle={() => handleToggleItem(item.id)}
                    onSelect={() => handleToggleSelect(item.id)}
                    onVote={(type, reason, detail) => handleVote(item.id, type, reason, detail)}
                    onRevokeVote={() => handleRevokeVote(item.id)}
                    currentVote={votedMap.get(item.id) ?? null}
                  />
                </div>
              ))}
            </div>
            <Pagination
              currentPage={safePage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={filtered.length}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          </>
        )}
        {/* Mobile bottom bar spacer */}
        {compareMode && selectedItems.size > 0 && (
          <div className="h-16 md:hidden" />
        )}
      </div>

      {/* Selection sidebar - only in compare mode */}
      {compareMode && (
        <SelectionSidebar
          items={items}
          selectedIds={selectedItems}
          onRemove={(id) => handleToggleSelect(id)}
          onClear={() => setSelectedItems(new Set())}
          onCompare={() => setView("reading")}
        />
      )}
    </div>
    <BackToTop />
    </>
  );
}
