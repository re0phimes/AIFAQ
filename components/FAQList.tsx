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
import { t, paginationInfo } from "@/lib/i18n";
import type {
  FAQItem as FAQItemType,
  TagTaxonomy,
  VoteType,
} from "@/src/types/faq";

type SortMode = "default" | "date" | "difficulty";

const DIFFICULTY_ORDER: Record<string, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

interface FAQListProps {
  items: FAQItemType[];
  lang: "zh" | "en";
  onLangChange: (lang: "zh" | "en") => void;
  votedMap: Map<number, VoteType>;
  onVote: (faqId: number, type: VoteType, reason?: string, detail?: string) => void;
  onRevokeVote: (faqId: number) => void;
  onOpenItem?: (item: FAQItemType) => void;
  session?: { user?: { id?: string; name?: string | null; image?: string | null } } | null;
  onSignIn?: () => void;
  onSignOut?: () => void;
  favorites?: Set<number>;
  onToggleFavorite?: (id: number) => void;
}

const LS_KEY = "aifaq-selected";
const LS_PAGESIZE = "aifaq-pagesize";
const LS_GLOBAL_DETAILED = "aifaq-global-detailed";

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

export default function FAQList({ items, lang, onLangChange, votedMap, onVote, onRevokeVote, onOpenItem, session, onSignIn, onSignOut, favorites, onToggleFavorite }: FAQListProps) {
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
  const [sortMode, setSortMode] = useState<SortMode>("default");
  const [globalDetailed, setGlobalDetailed] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);
  // Modal state removed - now managed by parent (FAQPage)
  const lastScrollY = useRef(0);

  // Refs for stable callbacks - avoid re-creating functions on every render
  const itemsRef = useRef(items);
  const globalDetailedRef = useRef(globalDetailed);

  // Sync refs with state
  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { globalDetailedRef.current = globalDetailed; }, [globalDetailed]);

  // Load globalDetailed from localStorage on client
  useEffect(() => {
    const saved = localStorage.getItem(LS_GLOBAL_DETAILED);
    if (saved !== null) {
      setGlobalDetailed(saved === "true");
    }
  }, []);

  // Hide header on scroll down, show on scroll up, or when tab is open
  // 使用 ref 避免频繁重新订阅 scroll 事件
  const openItemsSizeRef = useRef(openItems.size);

  useEffect(() => {
    openItemsSizeRef.current = openItems.size;
  }, [openItems.size]);

  useEffect(() => {
    const THRESHOLD = 10;
    function handleScroll() {
      const currentY = window.scrollY;
      if (Math.abs(currentY - lastScrollY.current) < THRESHOLD) return;
      // Hide header only when scrolling down past threshold
      const shouldHide = currentY > lastScrollY.current && currentY > 80;
      setHeaderVisible(!shouldHide);
      lastScrollY.current = currentY;
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    // Initial check
    handleScroll();
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

  // Persist globalDetailed
  useEffect(() => {
    localStorage.setItem(LS_GLOBAL_DETAILED, String(globalDetailed));
  }, [globalDetailed]);

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

    // Favorites filter
    if (showFavoritesOnly && favorites) {
      result = result.filter((item) => favorites.has(item.id));
    }

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
  }, [items, searchQuery, searchMode, selectedTags, selectedCategories, categoryTagsMap, showFavoritesOnly, favorites]);

  // Sort logic
  const sorted = useMemo(() => {
    if (sortMode === "default") return filtered;
    const arr = [...filtered];
    if (sortMode === "date") {
      arr.sort((a, b) => b.date.localeCompare(a.date));
    } else if (sortMode === "difficulty") {
      arr.sort(
        (a, b) =>
          (DIFFICULTY_ORDER[a.difficulty ?? ""] ?? 99) -
          (DIFFICULTY_ORDER[b.difficulty ?? ""] ?? 99)
      );
    }
    return arr;
  }, [filtered, sortMode]);

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, searchMode, selectedTags, selectedCategories, sortMode, showFavoritesOnly]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedItems = sorted.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  function handlePageChange(page: number): void {
    window.scrollTo({ top: 0 });
    setOpenItems(new Set());
    setHeaderVisible(true);
    setCurrentPage(page);
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

  const handleToggleItem = useCallback((id: number): void => {
    // Detailed mode: directly open modal, don't expand tab
    if (globalDetailedRef.current) {
      const item = itemsRef.current.find((i) => i.id === id);
      if (item && onOpenItem) {
        onOpenItem(item);
      }
      return;
    }
    // Brief mode: toggle tab expansion
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, [onOpenItem]);

  const handleToggleSelect = useCallback((id: number): void => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

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
        lang={lang}
        onBack={() => setView("list")}
        onRemove={handleRemoveFromReading}
      />
    );
  }

  return (
    <>
      <div
        className={`sticky top-0 z-20 -mx-4 bg-bg/95 px-4 pb-3 backdrop-blur-sm
          transition-transform duration-300 md:-mx-8 md:px-8 ${
            headerVisible ? "translate-y-0" : "-translate-y-full"
          }`}
      >
        <header className="mb-4 flex items-center justify-between pt-2">
          <div>
            <h1 className="font-brand text-3xl font-bold text-text">AIFAQ</h1>
            <p className="mt-1 text-sm text-subtext">
              {lang === "zh" ? "AI/ML 常见问题知识库" : "AI/ML FAQ Knowledge Base"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {session?.user ? (
              <div className="flex items-center gap-2">
                {session.user.image && (
                  <img src={session.user.image} alt="" className="h-6 w-6 rounded-full" />
                )}
                <span className="text-xs text-subtext">{session.user.name}</span>
                <button onClick={onSignOut} className="text-xs text-subtext hover:text-text">
                  {t("logout", lang)}
                </button>
              </div>
            ) : (
              <button
                onClick={onSignIn}
                className="flex items-center gap-1.5 rounded-full border-[0.5px] border-border px-3 py-1.5 text-xs text-subtext hover:bg-surface"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                </svg>
                {t("loginWithGithub", lang)}
              </button>
            )}
            <div className="flex gap-1">
            <button
              onClick={() => onLangChange("zh")}
              className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                lang === "zh" ? "bg-primary text-white" : "text-subtext hover:bg-surface"
              }`}
            >
              中文
            </button>
            <button
              onClick={() => onLangChange("en")}
              className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                lang === "en" ? "bg-primary text-white" : "text-subtext hover:bg-surface"
              }`}
            >
              EN
            </button>
          </div>
          </div>
        </header>
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          mode={searchMode}
          onModeChange={setSearchMode}
          lang={lang}
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
            lang={lang}
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
          <div className="flex flex-wrap items-center gap-2">
            {/* Group 1: Compare */}
            <button
              onClick={handleToggleCompare}
              className={`rounded-full px-3 py-1.5 text-xs font-medium
                transition-colors ${
                  compareMode
                    ? "bg-primary text-white"
                    : "border-[0.5px] border-border text-subtext hover:bg-surface"
                }`}
            >
              {compareMode ? t("exitCompare", lang) : t("compare", lang)}
            </button>
            {session?.user && (
              <>
                <span className="h-4 border-l border-border" />
                <button
                  onClick={() => setShowFavoritesOnly((v) => !v)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium
                    transition-colors ${
                      showFavoritesOnly
                        ? "bg-amber-500 text-white"
                        : "border-[0.5px] border-border text-amber-600 hover:bg-amber-50"
                    }`}
                >
                  <span className="mr-1">★</span>
                  {t("myFavorites", lang)}
                </button>
              </>
            )}
            {/* Group 2: Expand/Collapse */}
            <span className="h-4 border-l border-border" />
            <button
              onClick={handleExpandAll}
              className="rounded-full border-[0.5px] border-border px-3 py-1.5
                text-xs text-subtext hover:bg-surface"
            >
              {t("expandAll", lang)}
            </button>
            <button
              onClick={handleCollapseAll}
              className="rounded-full border-[0.5px] border-border px-3 py-1.5
                text-xs text-subtext hover:bg-surface"
            >
              {t("collapseAll", lang)}
            </button>
            <div className="flex items-center gap-1 ml-2 border-l border-border pl-2">
              <button
                onClick={() => setGlobalDetailed(false)}
                className={`rounded-full px-2.5 py-1.5 text-xs transition-colors ${
                  !globalDetailed
                    ? "bg-primary text-white"
                    : "text-subtext hover:bg-surface"
                }`}
              >
                {t("brief", lang)}
              </button>
              <button
                onClick={() => setGlobalDetailed(true)}
                className={`rounded-full px-2.5 py-1.5 text-xs transition-colors ${
                  globalDetailed
                    ? "bg-primary text-white"
                    : "text-subtext hover:bg-surface"
                }`}
              >
                {t("detailed", lang)}
              </button>
            </div>
            <div className="flex items-center gap-1 ml-2 border-l border-border pl-2">
              <span className="text-[11px] text-subtext">{t("sort", lang)}</span>
              {(["default", "date", "difficulty"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setSortMode(mode)}
                  className={`rounded-full px-2 py-1.5 text-xs transition-colors ${
                    sortMode === mode
                      ? "bg-primary text-white"
                      : "text-subtext hover:bg-surface"
                  }`}
                >
                  {mode === "default" ? t("sortDefault", lang) : mode === "date" ? t("sortDate", lang) : t("sortDifficulty", lang)}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-subtext">
            {paginationInfo(sorted.length, safePage, totalPages, lang)}
          </p>
        </div>

        {sorted.length === 0 ? (
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
            <p className="text-subtext">{t("noResults", lang)}</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {paginatedItems.map((item, index) => (
                <div
                  key={item.id}
                  className="faq-item-enter"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <FAQItem
                    item={item}
                    lang={lang}
                    globalDetailed={globalDetailed}
                    isOpen={openItems.has(item.id)}
                    isSelected={selectedItems.has(item.id)}
                    showCheckbox={compareMode}
                    onToggle={handleToggleItem}
                    onSelect={handleToggleSelect}
                    onVote={onVote}
                    onRevokeVote={onRevokeVote}
                    currentVote={votedMap.get(item.id) ?? null}
                    onOpenModal={onOpenItem}
                    isFavorited={favorites?.has(item.id)}
                    onToggleFavorite={onToggleFavorite}
                    isAuthenticated={!!session?.user}
                  />
                </div>
              ))}
            </div>
            <Pagination
              currentPage={safePage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={sorted.length}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
              lang={lang}
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
          lang={lang}
        />
      )}
    </div>
    <BackToTop />
    </>
  );
}
