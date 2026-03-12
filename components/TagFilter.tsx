"use client";

import { t, translateTag } from "@/lib/i18n";
import { getFacetLabel, getPrimaryCategoryLabel } from "@/lib/taxonomy";
import type { Lang, PrimaryCategoryKey } from "@/src/types/faq";

interface FacetCount {
  key: string;
  count: number;
}

interface TagFilterProps {
  categories: { key: PrimaryCategoryKey; description: string }[];
  categoryCounts: Map<PrimaryCategoryKey, number>;
  topicCounts: FacetCount[];
  patternCounts: FacetCount[];
  allTags: string[];
  tagCounts: Map<string, number>;
  selectedCategories: PrimaryCategoryKey[];
  selectedTopics: string[];
  selectedPatterns: string[];
  selectedTags: string[];
  onToggleCategory: (category: PrimaryCategoryKey) => void;
  onToggleTopic: (topic: string) => void;
  onTogglePattern: (pattern: string) => void;
  onToggleTag: (tag: string) => void;
  onClearAll: () => void;
  lang?: Lang;
}

function SectionLabel({
  zh,
  en,
  lang,
}: {
  zh: string;
  en: string;
  lang: Lang;
}) {
  return <p className="mb-1.5 text-[11px] font-medium text-subtext">{lang === "zh" ? zh : en}</p>;
}

export default function TagFilter({
  categories,
  categoryCounts,
  topicCounts,
  patternCounts,
  allTags,
  tagCounts,
  selectedCategories,
  selectedTopics,
  selectedPatterns,
  selectedTags,
  onToggleCategory,
  onToggleTopic,
  onTogglePattern,
  onToggleTag,
  onClearAll,
  lang = "zh",
}: TagFilterProps) {
  const hasSelection =
    selectedCategories.length > 0 ||
    selectedTopics.length > 0 ||
    selectedPatterns.length > 0 ||
    selectedTags.length > 0;

  return (
    <div className="rounded-xl border-[0.5px] border-border bg-panel p-2.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-subtext">{t("tagFilter", lang)}</span>
        {hasSelection && (
          <button
            onClick={onClearAll}
            className="rounded-full border border-primary px-2.5 py-0.5 text-xs text-primary transition-colors hover:bg-primary hover:text-white"
          >
            {t("clearFilter", lang)}
          </button>
        )}
      </div>

      <SectionLabel zh="主类" en="Primary" lang={lang} />
      <div className="flex flex-wrap gap-1.5">
        {categories.map((category) => {
          const count = categoryCounts.get(category.key) ?? 0;
          if (count === 0) return null;
          const selected = selectedCategories.includes(category.key);
          return (
            <button
              key={category.key}
              onClick={() => onToggleCategory(category.key)}
              title={category.description}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs leading-none transition-colors duration-150 ${
                selected ? "bg-primary text-white" : "bg-surface text-text hover:bg-surface"
              }`}
            >
              {getPrimaryCategoryLabel(category.key, lang)}
              <span className={`text-[10px] ${selected ? "text-white/70" : "text-subtext"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {patternCounts.length > 0 && (
        <div className="mt-2 border-t border-border/50 pt-2">
          <SectionLabel zh="模式" en="Patterns" lang={lang} />
          <div className="flex flex-wrap gap-1.5">
            {patternCounts.map(({ key, count }) => {
              const selected = selectedPatterns.includes(key);
              return (
                <button
                  key={key}
                  onClick={() => onTogglePattern(key)}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] leading-none transition-colors duration-150 ${
                    selected ? "bg-primary/80 text-white" : "bg-surface text-text hover:bg-surface"
                  }`}
                >
                  {getFacetLabel("pattern", key, lang)}
                  <span className={`text-[9px] ${selected ? "text-white/70" : "text-subtext"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {topicCounts.length > 0 && (
        <div className="mt-2 border-t border-border/50 pt-2">
          <SectionLabel zh="主题" en="Topics" lang={lang} />
          <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto pr-1">
            {topicCounts.map(({ key, count }) => {
              const selected = selectedTopics.includes(key);
              return (
                <button
                  key={key}
                  onClick={() => onToggleTopic(key)}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] leading-none transition-colors duration-150 ${
                    selected ? "bg-primary/80 text-white" : "bg-surface text-text hover:bg-surface"
                  }`}
                >
                  {getFacetLabel("topic", key, lang)}
                  <span className={`text-[9px] ${selected ? "text-white/70" : "text-subtext"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {allTags.length > 0 && (
        <div className="mt-2 border-t border-border/50 pt-2">
          <SectionLabel zh="叶子标签" en="Leaf Tags" lang={lang} />
          <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto pr-1">
            {allTags.map((tag) => {
              const selected = selectedTags.includes(tag);
              const count = tagCounts.get(tag) ?? 0;
              return (
                <button
                  key={tag}
                  onClick={() => onToggleTag(tag)}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11px] leading-none transition-colors duration-150 ${
                    selected ? "bg-primary/80 text-white" : "bg-surface text-text hover:bg-surface"
                  }`}
                >
                  {translateTag(tag, lang)}
                  <span className={`text-[9px] ${selected ? "text-white/70" : "text-subtext"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
