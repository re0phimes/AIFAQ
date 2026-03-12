import test from "node:test";
import assert from "node:assert/strict";
import { translateCategory } from "./i18n";
import {
  getFacetLabel,
  getFacetOption,
  getFacetOptions,
  getPrimaryCategory,
  getPrimaryCategoryLabel,
  getPrimaryCategoryOptions,
  getTaxonomy,
  isValidFacetValue,
  isValidPrimaryCategoryKey,
  normalizeFacetValue,
  normalizePrimaryCategoryKey,
} from "./taxonomy";

test("taxonomy exposes the approved primary categories", () => {
  const categories = getPrimaryCategoryOptions();
  assert.equal(categories.length, 8);
  assert.equal(categories[0]?.key, "fundamentals");
  assert.equal(categories[1]?.key, "model_architecture");
});

test("primary category lookup works by stable key", () => {
  const category = getPrimaryCategory("model_architecture");
  assert.ok(category);
  assert.equal(category?.zh, "模型结构");
  assert.equal(category?.en, "Model Architecture");
});

test("primary category labels support zh and en", () => {
  assert.equal(getPrimaryCategoryLabel("fundamentals", "zh"), "基础概念");
  assert.equal(getPrimaryCategoryLabel("fundamentals", "en"), "Fundamentals");
  assert.equal(translateCategory("model_architecture", "zh"), "模型结构");
  assert.equal(translateCategory("model_architecture", "en"), "Model Architecture");
});

test("facet lookup returns bilingual labels", () => {
  const option = getFacetOption("topic", "kv_cache");
  assert.ok(option);
  assert.equal(option?.zh, "KV Cache");
  assert.equal(getFacetLabel("topic", "kv_cache", "en"), "KV Cache");
});

test("aliases normalize to canonical values", () => {
  assert.equal(normalizeFacetValue("topic", "KVCache"), "kv_cache");
  assert.equal(normalizeFacetValue("pattern", "multi-agent"), "multi_agent");
  assert.equal(normalizePrimaryCategoryKey("post-training"), "post_training_alignment");
});

test("invalid values are rejected", () => {
  assert.equal(isValidPrimaryCategoryKey("does_not_exist"), false);
  assert.equal(isValidFacetValue("tool_stack", "unknown_tool"), false);
  assert.equal(getPrimaryCategory("unknown"), undefined);
});

test("facet options expose the configured values", () => {
  const tools = getFacetOptions("tool_stack");
  assert.equal(tools.some((tool) => tool.key === "trl"), true);
  assert.equal(tools.some((tool) => tool.key === "smolagents"), true);
});

test("taxonomy helper results do not expose shared mutable state", () => {
  const categories = getPrimaryCategoryOptions();
  categories[0]!.zh = "被修改";
  const categoriesAgain = getPrimaryCategoryOptions();
  assert.equal(categoriesAgain[0]!.zh, "基础概念");

  const tools = getFacetOptions("tool_stack");
  tools[0]!.en = "Changed";
  const toolsAgain = getFacetOptions("tool_stack");
  assert.equal(toolsAgain[0]!.en, "PyTorch");

  const taxonomy = getTaxonomy();
  taxonomy.categories[0]!.en = "Changed";
  taxonomy.facets.topic[0]!.zh = "已修改";
  const taxonomyAgain = getTaxonomy();
  assert.equal(taxonomyAgain.categories[0]!.en, "Fundamentals");
  assert.equal(taxonomyAgain.facets.topic[0]!.zh, "Transformer");
});
