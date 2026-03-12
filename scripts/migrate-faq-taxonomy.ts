import fs from "node:fs";
import path from "node:path";
import {
  getFacetOptions,
  getPrimaryCategoryOptions,
  normalizeFacetValue,
  normalizePrimaryCategoryKey,
} from "../lib/taxonomy";
import type { FAQItem, PrimaryCategoryKey, Reference } from "../src/types/faq";

const FAQ_PATH = path.resolve(__dirname, "../data/faq.json");

const PRIMARY_CATEGORY_ORDER = getPrimaryCategoryOptions().map((option) => option.key);
const TOPIC_ORDER = getFacetOptions("topic").map((option) => option.key);
const PATTERN_ORDER = getFacetOptions("pattern").map((option) => option.key);
const TOOL_STACK_ORDER = getFacetOptions("tool_stack").map((option) => option.key);

type LegacyFaqInput = Pick<FAQItem, "question" | "tags" | "categories"> &
  Partial<
    Pick<
      FAQItem,
      | "id"
      | "answer"
      | "references"
      | "primaryCategory"
      | "secondaryCategory"
      | "patterns"
      | "topics"
      | "toolStack"
    >
  >;

export interface FAQTaxonomyClassification {
  primary_category: PrimaryCategoryKey | null;
  secondary_category: PrimaryCategoryKey | null;
  patterns: string[];
  topics: string[];
  tool_stack: string[];
  ambiguous: boolean;
  matched_signals: string[];
  score_breakdown: Record<PrimaryCategoryKey, number>;
}

export interface MigrationSummary {
  total: number;
  changed: number;
  mapped: number;
  unmapped: number;
  ambiguous: number;
  primaryCategoryCounts: Record<string, number>;
  ambiguousRows: Array<{ id?: number; question: string; primary: string | null; secondary: string | null }>;
}

interface ScoredSignal {
  category: PrimaryCategoryKey;
  keywords: string[];
  score: number;
  reason: string;
}

interface LegacyCategoryHint {
  primary?: PrimaryCategoryKey;
  secondary?: PrimaryCategoryKey;
}

const TOPIC_CATEGORY_MAP: Record<string, PrimaryCategoryKey> = {
  attention: "model_architecture",
  embedding: "fundamentals",
  transformer: "model_architecture",
  rope: "model_architecture",
  residual_connection: "model_architecture",
  normalization: "model_architecture",
  lora: "post_training_alignment",
  sft: "post_training_alignment",
  dpo: "post_training_alignment",
  reward_model: "post_training_alignment",
  ppo: "reinforcement_learning",
  grpo: "reinforcement_learning",
  kv_cache: "inference_deployment",
  quantization: "inference_deployment",
  distillation: "post_training_alignment",
};

const PATTERN_CATEGORY_MAP: Record<string, PrimaryCategoryKey> = {
  workflow: "retrieval_agent_systems",
  rag: "retrieval_agent_systems",
  tool_use: "retrieval_agent_systems",
  single_agent: "retrieval_agent_systems",
  multi_agent: "retrieval_agent_systems",
  memory: "retrieval_agent_systems",
  planner_executor: "retrieval_agent_systems",
  human_in_the_loop: "retrieval_agent_systems",
};

const TOOL_STACK_CATEGORY_MAP: Partial<Record<string, PrimaryCategoryKey>> = {
  trl: "post_training_alignment",
  vllm: "inference_deployment",
  llama_cpp: "inference_deployment",
  langchain: "retrieval_agent_systems",
  smolagents: "retrieval_agent_systems",
};

const TOPIC_FAMILY_BOOSTS: Array<{
  category: PrimaryCategoryKey;
  topics: string[];
  score: number;
  reason: string;
}> = [
  {
    category: "model_architecture",
    topics: ["transformer", "attention", "rope", "residual_connection", "normalization"],
    score: 2,
    reason: "architecture-topic-family",
  },
  {
    category: "post_training_alignment",
    topics: ["lora", "sft", "dpo", "reward_model", "distillation"],
    score: 3,
    reason: "post-training-topic-family",
  },
  {
    category: "reinforcement_learning",
    topics: ["ppo", "grpo"],
    score: 3,
    reason: "rl-topic-family",
  },
  {
    category: "inference_deployment",
    topics: ["kv_cache", "quantization"],
    score: 2,
    reason: "inference-topic-family",
  },
];

const PRIMARY_SIGNALS: ScoredSignal[] = [
  {
    category: "model_architecture",
    keywords: [
      "transformer",
      "attention",
      "注意力",
      "rope",
      "残差连接",
      "residual",
      "layernorm",
      "rmsnorm",
      "归一化",
      "位置编码",
      "ffn",
      "moe",
      "gqa",
      "mqa",
      "mla",
      "qkv",
      "addnorm",
    ],
    score: 3,
    reason: "architecture keyword",
  },
  {
    category: "post_training_alignment",
    keywords: [
      "lora",
      "qlora",
      "sft",
      "dpo",
      "微调",
      "finetuning",
      "finetune",
      "instructiontuning",
      "alignment",
      "对齐",
      "偏好优化",
      "rewardmodel",
      "奖励模型",
      "distillation",
      "蒸馏",
      "rlhf",
    ],
    score: 3,
    reason: "post-training keyword",
  },
  {
    category: "reinforcement_learning",
    keywords: [
      "ppo",
      "grpo",
      "强化学习",
      "policygradient",
      "actorcritic",
      "advantage",
      "策略优化",
      "策略梯度",
      "奖励函数",
    ],
    score: 4,
    reason: "rl keyword",
  },
  {
    category: "retrieval_agent_systems",
    keywords: [
      "rag",
      "retrieval",
      "检索",
      "agent",
      "workflow",
      "toolcalling",
      "functioncalling",
      "planner",
      "executor",
      "memory",
      "langchain",
      "smolagents",
      "多agent",
      "multiagent",
    ],
    score: 4,
    reason: "retrieval/agent keyword",
  },
  {
    category: "inference_deployment",
    keywords: [
      "kvcache",
      "kvcache",
      "量化",
      "quantization",
      "推理优化",
      "serving",
      "vllm",
      "llamacpp",
      "部署",
      "延迟",
      "吞吐",
      "speculativedecoding",
    ],
    score: 4,
    reason: "inference keyword",
  },
  {
    category: "pretraining_data",
    keywords: [
      "预训练",
      "pretraining",
      "pretrain",
      "tokenizer",
      "tokenization",
      "分词",
      "语料",
      "corpus",
      "continuedpretraining",
      "cpt",
      "nexttoken",
      "掩码语言模型",
    ],
    score: 4,
    reason: "pretraining keyword",
  },
  {
    category: "evaluation_safety",
    keywords: [
      "评测",
      "benchmark",
      "eval",
      "hallucination",
      "幻觉",
      "redteam",
      "安全",
      "safety",
      "guardrail",
      "jailbreak",
      "越狱",
    ],
    score: 4,
    reason: "evaluation/safety keyword",
  },
  {
    category: "fundamentals",
    keywords: [
      "梯度",
      "gradient",
      "损失",
      "loss",
      "概率",
      "probability",
      "熵",
      "entropy",
      "流形",
      "manifold",
      "线性变换",
      "仿射变换",
      "优化理论",
      "optimization",
    ],
    score: 2,
    reason: "fundamentals keyword",
  },
];

const LEGACY_CATEGORY_HINTS: Record<string, LegacyCategoryHint> = {
  "ai基础概念": { primary: "fundamentals" },
  "机器学习基础": { primary: "fundamentals" },
  "深度学习": { primary: "model_architecture" },
  "自然语言处理": { secondary: "pretraining_data" },
  "生成式ai/llm": {},
  "强化学习": { primary: "reinforcement_learning" },
  "推荐系统与搜索": { primary: "retrieval_agent_systems" },
  "数据工程与mlops": { primary: "inference_deployment" },
  "ai伦理与安全": { primary: "evaluation_safety" },
  "工具与框架": {},
};

const TOPIC_KEYWORDS: Record<string, string[]> = {
  transformer: ["transformer"],
  attention: ["attention", "注意力", "注意力机制"],
  embedding: ["embedding", "嵌入", "向量表示"],
  rope: ["rope", "rotarypositionembedding", "旋转位置编码"],
  residual_connection: ["残差连接", "residual", "skipconnection"],
  normalization: ["归一化", "layernorm", "rmsnorm", "batchnorm", "normalization"],
  lora: ["lora", "qlora"],
  sft: ["sft", "instructiontuning", "supervisedfinetuning", "监督微调"],
  dpo: ["dpo", "directpreferenceoptimization"],
  reward_model: ["rewardmodel", "奖励模型"],
  ppo: ["ppo"],
  grpo: ["grpo"],
  kv_cache: ["kvcache", "kvcache", "kvcache机制", "kv缓存"],
  quantization: ["量化", "quantization", "4bit", "8bit", "gptq", "awq"],
  distillation: ["distillation", "蒸馏"],
};

const PATTERN_KEYWORDS: Record<string, string[]> = {
  workflow: ["workflow", "工作流"],
  rag: ["rag", "retrievalaugmentedgeneration", "检索增强生成"],
  tool_use: ["tooluse", "toolcalling", "functioncalling", "工具调用"],
  single_agent: ["singleagent", "单agent"],
  multi_agent: ["multiagent", "多agent"],
  memory: ["memory", "记忆", "长期记忆"],
  planner_executor: ["plannerexecutor", "planner", "规划执行", "规划器"],
  human_in_the_loop: ["humanintheloop", "人在回路", "hitl", "人工审核"],
};

const TOOL_STACK_KEYWORDS: Record<string, string[]> = {
  pytorch: ["pytorch"],
  transformers: ["transformers", "hftransformers", "huggingfacetransformers"],
  trl: ["trl"],
  vllm: ["vllm"],
  llama_cpp: ["llamacpp", "llama.cpp"],
  langchain: ["langchain"],
  smolagents: ["smolagents"],
};

function compact(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "");
}

function uniqueOrdered(values: string[], order: string[]): string[] {
  const unique = [...new Set(values)];
  const rank = new Map(order.map((key, index) => [key, index]));
  return unique.sort((a, b) => (rank.get(a) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b) ?? Number.MAX_SAFE_INTEGER));
}

function buildCompactSources(item: LegacyFaqInput): string[] {
  const referenceTitles = (item.references ?? []).map((reference) => reference.title);
  return [
    item.question,
    item.answer ?? "",
    ...(item.tags ?? []),
    ...(item.categories ?? []),
    ...referenceTitles,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map(compact);
}

function hasKeyword(compactSources: string[], keyword: string): boolean {
  const normalizedKeyword = compact(keyword);
  return compactSources.some((source) => source.includes(normalizedKeyword));
}

function normalizeExistingFacetValues(
  group: "pattern" | "topic" | "tool_stack",
  values: string[] | undefined
): string[] {
  if (!Array.isArray(values)) return [];
  return uniqueOrdered(
    values
      .map((value) => normalizeFacetValue(group, value))
      .filter((value): value is string => value !== null),
    group === "pattern" ? PATTERN_ORDER : group === "topic" ? TOPIC_ORDER : TOOL_STACK_ORDER
  );
}

function detectFacetValues(
  compactSources: string[],
  tags: string[],
  group: "pattern" | "topic" | "tool_stack",
  keywordsByKey: Record<string, string[]>,
  order: string[]
): string[] {
  const normalizedFromTags = tags
    .map((tag) => normalizeFacetValue(group, tag))
    .filter((value): value is string => value !== null);

  const detectedFromKeywords = Object.entries(keywordsByKey)
    .filter(([, keywords]) => keywords.some((keyword) => hasKeyword(compactSources, keyword)))
    .map(([key]) => key);

  return uniqueOrdered([...normalizedFromTags, ...detectedFromKeywords], order);
}

function normalizeLegacyCategory(category: string): string {
  return compact(category);
}

function createScoreBreakdown(): Record<PrimaryCategoryKey, number> {
  return PRIMARY_CATEGORY_ORDER.reduce<Record<PrimaryCategoryKey, number>>((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {} as Record<PrimaryCategoryKey, number>);
}

function addScore(
  scores: Record<PrimaryCategoryKey, number>,
  matchedSignals: string[],
  category: PrimaryCategoryKey,
  score: number,
  reason: string
): void {
  scores[category] += score;
  matchedSignals.push(`${category}:${reason}`);
}

function pickCategories(scores: Record<PrimaryCategoryKey, number>): {
  primary: PrimaryCategoryKey | null;
  secondary: PrimaryCategoryKey | null;
  ambiguous: boolean;
} {
  const ranked = [...PRIMARY_CATEGORY_ORDER]
    .map((key) => ({ key, score: scores[key] }))
    .sort((a, b) => (b.score - a.score) || (PRIMARY_CATEGORY_ORDER.indexOf(a.key) - PRIMARY_CATEGORY_ORDER.indexOf(b.key)));

  const primary = ranked[0]?.score > 0 ? ranked[0].key : null;
  const second = ranked[1]?.score > 0 ? ranked[1] : null;

  const ambiguous = Boolean(primary && second && ranked[0].score === second.score);
  const secondary =
    primary && second && !ambiguous && second.score >= 3 && ranked[0].score - second.score <= 1
      ? second.key
      : null;

  return { primary, secondary, ambiguous };
}

function mergeExistingOrClassified(
  item: LegacyFaqInput,
  classified: FAQTaxonomyClassification
): FAQTaxonomyClassification {
  const existingPrimary = normalizePrimaryCategoryKey(item.primaryCategory);
  const existingSecondary = normalizePrimaryCategoryKey(item.secondaryCategory);
  const existingPatterns = normalizeExistingFacetValues("pattern", item.patterns);
  const existingTopics = normalizeExistingFacetValues("topic", item.topics);
  const existingToolStack = normalizeExistingFacetValues("tool_stack", item.toolStack);

  return {
    ...classified,
    primary_category: existingPrimary ?? classified.primary_category,
    secondary_category:
      existingPrimary && existingSecondary === existingPrimary ? null : existingSecondary ?? classified.secondary_category,
    patterns: existingPatterns.length > 0 ? existingPatterns : classified.patterns,
    topics: existingTopics.length > 0 ? existingTopics : classified.topics,
    tool_stack: existingToolStack.length > 0 ? existingToolStack : classified.tool_stack,
  };
}

export function classifyLegacyFaq(item: LegacyFaqInput): FAQTaxonomyClassification {
  const compactSources = buildCompactSources(item);
  const tags = item.tags ?? [];
  const matchedSignals: string[] = [];
  const scores = createScoreBreakdown();

  const topics = detectFacetValues(compactSources, tags, "topic", TOPIC_KEYWORDS, TOPIC_ORDER);
  const patterns = detectFacetValues(compactSources, tags, "pattern", PATTERN_KEYWORDS, PATTERN_ORDER);
  const toolStack = detectFacetValues(compactSources, tags, "tool_stack", TOOL_STACK_KEYWORDS, TOOL_STACK_ORDER);

  for (const topic of topics) {
    const category = TOPIC_CATEGORY_MAP[topic];
    if (category) addScore(scores, matchedSignals, category, 5, `topic:${topic}`);
  }

  for (const boost of TOPIC_FAMILY_BOOSTS) {
    if (boost.topics.some((topic) => topics.includes(topic))) {
      addScore(scores, matchedSignals, boost.category, boost.score, boost.reason);
    }
  }

  for (const pattern of patterns) {
    const category = PATTERN_CATEGORY_MAP[pattern];
    if (category) addScore(scores, matchedSignals, category, 5, `pattern:${pattern}`);
  }

  for (const tool of toolStack) {
    const category = TOOL_STACK_CATEGORY_MAP[tool];
    if (category) addScore(scores, matchedSignals, category, 2, `tool_stack:${tool}`);
  }

  for (const signal of PRIMARY_SIGNALS) {
    if (signal.keywords.some((keyword) => hasKeyword(compactSources, keyword))) {
      addScore(scores, matchedSignals, signal.category, signal.score, signal.reason);
    }
  }

  for (const categoryName of item.categories ?? []) {
    const hint = LEGACY_CATEGORY_HINTS[normalizeLegacyCategory(categoryName)];
    if (!hint) continue;
    if (hint.primary) addScore(scores, matchedSignals, hint.primary, 2, `legacy_category:${categoryName}`);
    if (hint.secondary) addScore(scores, matchedSignals, hint.secondary, 1, `legacy_category:${categoryName}`);
  }

  const picked = pickCategories(scores);
  return mergeExistingOrClassified(item, {
    primary_category: picked.primary,
    secondary_category: picked.secondary,
    patterns,
    topics,
    tool_stack: toolStack,
    ambiguous: picked.ambiguous,
    matched_signals: matchedSignals,
    score_breakdown: scores,
  });
}

function taxonomyEquals(item: FAQItem, classified: FAQTaxonomyClassification): boolean {
  const currentPrimary = normalizePrimaryCategoryKey(item.primaryCategory);
  const currentSecondary = normalizePrimaryCategoryKey(item.secondaryCategory);
  const currentPatterns = normalizeExistingFacetValues("pattern", item.patterns);
  const currentTopics = normalizeExistingFacetValues("topic", item.topics);
  const currentToolStack = normalizeExistingFacetValues("tool_stack", item.toolStack);

  return (
    currentPrimary === classified.primary_category &&
    currentSecondary === classified.secondary_category &&
    JSON.stringify(currentPatterns) === JSON.stringify(classified.patterns) &&
    JSON.stringify(currentTopics) === JSON.stringify(classified.topics) &&
    JSON.stringify(currentToolStack) === JSON.stringify(classified.tool_stack)
  );
}

export function applyTaxonomyMigration(item: FAQItem): FAQItem {
  const classified = classifyLegacyFaq(item);
  return {
    ...item,
    primaryCategory: classified.primary_category,
    secondaryCategory: classified.secondary_category,
    patterns: classified.patterns,
    topics: classified.topics,
    toolStack: classified.tool_stack,
  };
}

export function migrateFaqItems(items: FAQItem[]): { items: FAQItem[]; summary: MigrationSummary } {
  const migrated = items.map(applyTaxonomyMigration);
  const summary: MigrationSummary = {
    total: items.length,
    changed: 0,
    mapped: 0,
    unmapped: 0,
    ambiguous: 0,
    primaryCategoryCounts: {},
    ambiguousRows: [],
  };

  for (let index = 0; index < items.length; index += 1) {
    const original = items[index];
    const next = migrated[index];
    const classified = classifyLegacyFaq(next);

    if (!taxonomyEquals(original, classified)) summary.changed += 1;

    if (next.primaryCategory) {
      summary.mapped += 1;
      summary.primaryCategoryCounts[next.primaryCategory] =
        (summary.primaryCategoryCounts[next.primaryCategory] ?? 0) + 1;
    } else {
      summary.unmapped += 1;
    }

    if (classified.ambiguous) {
      summary.ambiguous += 1;
      summary.ambiguousRows.push({
        id: original.id,
        question: original.question,
        primary: classified.primary_category,
        secondary: classified.secondary_category,
      });
    }
  }

  return { items: migrated, summary };
}

function printSummary(summary: MigrationSummary, dryRun: boolean): void {
  console.log(`FAQ taxonomy migration${dryRun ? " dry-run" : ""}`);
  console.log(`- total: ${summary.total}`);
  console.log(`- changed: ${summary.changed}`);
  console.log(`- mapped: ${summary.mapped}`);
  console.log(`- unmapped: ${summary.unmapped}`);
  console.log(`- ambiguous: ${summary.ambiguous}`);

  const categories = Object.entries(summary.primaryCategoryCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (categories.length > 0) {
    console.log("- by primary category:");
    for (const [category, count] of categories) {
      console.log(`  ${category}: ${count}`);
    }
  }

  if (summary.ambiguousRows.length > 0) {
    console.log("- ambiguous rows:");
    for (const row of summary.ambiguousRows.slice(0, 10)) {
      const label = row.id ? `#${row.id}` : "(no id)";
      console.log(`  ${label} ${row.question}`);
    }
  }
}

export function runMigration(options: { dryRun?: boolean; inputPath?: string } = {}): MigrationSummary {
  const faqPath = options.inputPath ? path.resolve(options.inputPath) : FAQ_PATH;
  const raw = fs.readFileSync(faqPath, "utf8");
  const items = JSON.parse(raw) as FAQItem[];
  const migrated = migrateFaqItems(items);

  if (!options.dryRun) {
    fs.writeFileSync(faqPath, `${JSON.stringify(migrated.items, null, 2)}\n`, "utf8");
  }

  printSummary(migrated.summary, Boolean(options.dryRun));
  return migrated.summary;
}

function getCliArgValue(flag: string): string | undefined {
  const prefix = `${flag}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

export function main(): void {
  const dryRun = process.argv.includes("--dry-run");
  const inputPath = getCliArgValue("--input");
  runMigration({ dryRun, inputPath });
}

if (process.argv[1]?.includes("migrate-faq-taxonomy.ts")) {
  main();
}

export type { LegacyFaqInput, Reference };
