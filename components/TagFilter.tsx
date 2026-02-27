"use client";

import { useMemo } from "react";
import type { TagTaxonomy } from "@/src/types/faq";
import { t, translateCategory, translateTag } from "@/lib/i18n";

interface TagFilterProps {
  taxonomy: TagTaxonomy;
  allTags: string[];
  tagCounts: Map<string, number>;
  selectedCategories: string[];
  selectedTags: string[];
  onToggleCategory: (cat: string) => void;
  onToggleTag: (tag: string) => void;
  onClearAll: () => void;
  lang?: "zh" | "en";
}

export default function TagFilter({
  taxonomy,
  allTags,
  tagCounts,
  selectedCategories,
  selectedTags,
  onToggleCategory,
  onToggleTag,
  onClearAll,
  lang = "zh",
}: TagFilterProps) {
  // Count FAQs per category
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const cat of taxonomy.categories) {
      let total = 0;
      for (const tag of cat.tags) {
        total += tagCounts.get(tag) ?? 0;
      }
      counts.set(cat.name, total);
    }
    return counts;
  }, [taxonomy, tagCounts]);

  // Tags to show: only from selected categories
  const visibleTags = useMemo(() => {
    if (selectedCategories.length === 0) return [];
    const tagSet = new Set<string>();
    for (const cat of taxonomy.categories) {
      if (selectedCategories.includes(cat.name)) {
        for (const tag of cat.tags) {
          if (allTags.includes(tag)) tagSet.add(tag);
        }
      }
    }
    return [...tagSet].sort((a, b) =>
      (tagCounts.get(b) ?? 0) - (tagCounts.get(a) ?? 0)
    );
  }, [taxonomy, selectedCategories, allTags, tagCounts]);

  const hasSelection = selectedCategories.length > 0 || selectedTags.length > 0;

  return (
    <div className="rounded-xl border-[0.5px] border-border bg-panel p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-subtext">
          {t("tagFilter", lang)}
        </span>
        {hasSelection && (
          <button
            onClick={onClearAll}
            className="rounded-full border border-primary px-2.5 py-0.5
              text-xs text-primary transition-colors
              hover:bg-primary hover:text-white"
          >
            {t("clearFilter", lang)}
          </button>
        )}
      </div>

      {/* Level 1: Categories */}
      <div className="flex flex-wrap gap-1.5">
        {taxonomy.categories.map((cat) => {
          const count = categoryCounts.get(cat.name) ?? 0;
          if (count === 0) return null;
          const isSelected = selectedCategories.includes(cat.name);
          return (
            <button
              key={cat.name}
              onClick={() => onToggleCategory(cat.name)}
              title={cat.description}
              className={`inline-flex items-center gap-1 rounded-full
                px-2.5 py-1 text-xs leading-none transition-colors
                duration-150 ${
                  isSelected
                    ? "bg-primary text-white"
                    : "bg-surface text-text hover:bg-surface"
                }`}
            >
              {translateCategory(cat.name, lang)}
              <span
                className={`text-[10px] ${
                  isSelected ? "text-white/70" : "text-subtext"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Level 2: Tags under selected categories */}
      {visibleTags.length > 0 && (
        <div
          className="mt-2 flex max-h-28 flex-wrap gap-1 overflow-y-auto
            border-t border-border/50 pt-2 pr-1"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {visibleTags.map((tag) => {
            const isSelected = selectedTags.includes(tag);
            const count = tagCounts.get(tag) ?? 0;
            return (
              <button
                key={tag}
                onClick={() => onToggleTag(tag)}
                className={`inline-flex items-center gap-1 rounded-full
                  px-2 py-0.5 font-mono text-[11px] leading-none
                  transition-colors duration-150 ${
                    isSelected
                      ? "bg-primary/80 text-white"
                      : "bg-surface text-text hover:bg-surface"
                  }`}
              >
                {translateTag(tag, lang)}
                <span
                  className={`text-[9px] ${
                    isSelected ? "text-white/70" : "text-subtext"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
