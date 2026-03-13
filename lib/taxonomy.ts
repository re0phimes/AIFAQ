import rawTaxonomy from "@/data/faq-taxonomy.json";
import type {
  FAQFacetGroup,
  FAQFacetOption,
  FAQTaxonomy,
  FAQTaxonomyCategory,
  Lang,
  PrimaryCategoryKey,
} from "@/src/types/faq";

const taxonomy = rawTaxonomy as FAQTaxonomy;

const primaryCategoryByKey = new Map<PrimaryCategoryKey, FAQTaxonomyCategory>();
const primaryCategoryAliasToKey = new Map<string, PrimaryCategoryKey>();
const facetOptionMaps: Record<FAQFacetGroup, Map<string, FAQFacetOption>> = {
  topic: new Map(),
  tool_stack: new Map(),
};
const facetAliasMaps: Record<FAQFacetGroup, Map<string, string>> = {
  topic: new Map(),
  tool_stack: new Map(),
};

function cloneCategory(category: FAQTaxonomyCategory): FAQTaxonomyCategory {
  return {
    ...category,
    aliases: category.aliases ? [...category.aliases] : undefined,
  };
}

function cloneFacetOption(option: FAQFacetOption): FAQFacetOption {
  return {
    ...option,
    aliases: option.aliases ? [...option.aliases] : undefined,
  };
}

function cloneTaxonomy(source: FAQTaxonomy): FAQTaxonomy {
  return {
    categories: source.categories.map(cloneCategory),
    facets: {
      topic: source.facets.topic.map(cloneFacetOption),
      tool_stack: source.facets.tool_stack.map(cloneFacetOption),
    },
  };
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

for (const category of taxonomy.categories) {
  primaryCategoryByKey.set(category.key, category);
  primaryCategoryAliasToKey.set(normalizeToken(category.key), category.key);
  primaryCategoryAliasToKey.set(normalizeToken(category.zh), category.key);
  primaryCategoryAliasToKey.set(normalizeToken(category.en), category.key);
  for (const alias of category.aliases ?? []) {
    primaryCategoryAliasToKey.set(normalizeToken(alias), category.key);
  }
}

for (const group of Object.keys(taxonomy.facets) as FAQFacetGroup[]) {
  for (const option of taxonomy.facets[group]) {
    facetOptionMaps[group].set(option.key, option);
    facetAliasMaps[group].set(normalizeToken(option.key), option.key);
    facetAliasMaps[group].set(normalizeToken(option.zh), option.key);
    facetAliasMaps[group].set(normalizeToken(option.en), option.key);
    for (const alias of option.aliases ?? []) {
      facetAliasMaps[group].set(normalizeToken(alias), option.key);
    }
  }
}

export type { FAQFacetGroup, FAQFacetOption, FAQTaxonomy, FAQTaxonomyCategory, PrimaryCategoryKey };

export function getTaxonomy(): FAQTaxonomy {
  return cloneTaxonomy(taxonomy);
}

export function getPrimaryCategoryOptions(): FAQTaxonomyCategory[] {
  return taxonomy.categories.map(cloneCategory);
}

export function getPrimaryCategory(key: string): FAQTaxonomyCategory | undefined {
  const normalized = normalizePrimaryCategoryKey(key);
  const category = normalized ? primaryCategoryByKey.get(normalized) : undefined;
  return category ? cloneCategory(category) : undefined;
}

export function normalizePrimaryCategoryKey(value: string | null | undefined): PrimaryCategoryKey | null {
  if (!value) return null;
  return primaryCategoryAliasToKey.get(normalizeToken(value)) ?? null;
}

export function expandPrimaryCategoryKeys(value: string | null | undefined): PrimaryCategoryKey[] {
  if (!value) return [];

  const normalized = normalizeToken(value);
  if (normalized === "retrieval_agent_systems") {
    return ["retrieval_systems", "agent_systems"];
  }

  const canonical = primaryCategoryAliasToKey.get(normalized);
  return canonical ? [canonical] : [];
}

export function isValidPrimaryCategoryKey(value: string | null | undefined): value is PrimaryCategoryKey {
  return normalizePrimaryCategoryKey(value) !== null;
}

export function getPrimaryCategoryLabel(value: string, lang: Lang): string {
  const category = getPrimaryCategory(value);
  if (!category) return value;
  return lang === "zh" ? category.zh : category.en;
}

export function getFacetGroups(): FAQFacetGroup[] {
  return ["topic", "tool_stack"];
}

export function getFacetOptions(group: FAQFacetGroup): FAQFacetOption[] {
  return taxonomy.facets[group].map(cloneFacetOption);
}

export function normalizeFacetValue(group: FAQFacetGroup, value: string | null | undefined): string | null {
  if (!value) return null;
  return facetAliasMaps[group].get(normalizeToken(value)) ?? null;
}

export function isValidFacetValue(group: FAQFacetGroup, value: string | null | undefined): boolean {
  return normalizeFacetValue(group, value) !== null;
}

export function getFacetOption(group: FAQFacetGroup, value: string): FAQFacetOption | undefined {
  const normalized = normalizeFacetValue(group, value);
  const option = normalized ? facetOptionMaps[group].get(normalized) : undefined;
  return option ? cloneFacetOption(option) : undefined;
}

export function getFacetLabel(group: FAQFacetGroup, value: string, lang: Lang): string {
  const option = getFacetOption(group, value);
  if (!option) return value;
  return lang === "zh" ? option.zh : option.en;
}
