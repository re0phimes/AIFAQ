"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import SearchBar, { type SearchMode } from "./SearchBar";
import TagFilter from "./TagFilter";
import FAQItem from "./FAQItem";
import SelectionSidebar from "./SelectionSidebar";
import ReadingView from "./ReadingView";
import type { FAQItem as FAQItemType } from "@/src/types/faq";

interface FAQListProps {
  items: FAQItemType[];
}

const LS_KEY = "aifaq-selected";

function loadSelected(): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return new Set(JSON.parse(raw) as number[]);
  } catch { /* ignore */ }
  return new Set();
}

export default function FAQList({ items }: FAQListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("combined");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [openItems, setOpenItems] = useState<Set<number>>(new Set());
  const [selectedItems, setSelectedItems] = useState<Set<number>>(loadSelected);
  const [view, setView] = useState<"list" | "reading">("list");

  // Persist selection to localStorage
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify([...selectedItems]));
  }, [selectedItems]);

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

  // Filter logic based on search mode
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

    return result;
  }, [items, searchQuery, searchMode, selectedTags]);

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

  const handleRemoveFromReading = useCallback((id: number) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Reading view: show selected items, auto-back if empty
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
    <div className="flex gap-4">
      {/* Main content */}
      <div className="min-w-0 flex-1 space-y-4">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          mode={searchMode}
          onModeChange={setSearchMode}
        />
        <TagFilter
          allTags={allTags}
          tagCounts={tagCounts}
          selectedTags={selectedTags}
          onToggleTag={handleToggleTag}
          onClearTags={() => setSelectedTags([])}
        />
        <p className="text-sm text-slate-secondary">
          显示 {items.length} 条中的 {filtered.length} 条
        </p>

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
          <div className="space-y-2">
            {filtered.map((item, index) => (
              <div
                key={item.id}
                className="faq-item-enter"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <FAQItem
                  item={item}
                  isOpen={openItems.has(item.id)}
                  isSelected={selectedItems.has(item.id)}
                  onToggle={() => handleToggleItem(item.id)}
                  onSelect={() => handleToggleSelect(item.id)}
                />
              </div>
            ))}
          </div>
        )}
        {/* Mobile bottom bar spacer */}
        {selectedItems.size > 0 && <div className="h-16 md:hidden" />}
      </div>

      {/* Selection sidebar */}
      <SelectionSidebar
        items={items}
        selectedIds={selectedItems}
        onRemove={(id) => handleToggleSelect(id)}
        onClear={() => setSelectedItems(new Set())}
        onCompare={() => setView("reading")}
      />
    </div>
  );
}
