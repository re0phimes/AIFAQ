# FAQ Taxonomy Redesign Design

## Context

The current FAQ taxonomy mixes several incompatible dimensions in a single layer:

- discipline labels such as `深度学习` and `自然语言处理`
- technology-wave labels such as `生成式 AI / LLM`
- engineering-process labels such as `数据工程与 MLOps`
- tool labels such as `工具与框架`
- scenario labels such as `AI 应用场景`

This makes category boundaries unstable and hard to extend. It also makes navigation feel arbitrary for learners because the primary grouping does not reflect how people learn AI topics.

The product is a public FAQ website for learners at different levels, not a paper archive. The redesign therefore removes arXiv-based classification and replaces it with a product-native learning taxonomy.

## Goals

1. Make the primary taxonomy understandable to general learners.
2. Preserve an AI work-type perspective without forcing every topic into a pure workflow-stage bucket.
3. Separate stable primary categories from flexible secondary tags.
4. Prevent future taxonomy drift with explicit governance rules.
5. Support bilingual display without scattering mapping logic across multiple files.

## Non-Goals

- Reproducing arXiv subject classes.
- Using tools/frameworks as first-level navigation.
- Allowing arbitrary free-form category creation in production data.

## Design Summary

The new taxonomy uses:

- 8 fixed first-level learning categories
- exactly 1 required primary category per FAQ
- up to 1 optional secondary category per FAQ
- 3 controlled facet groups for secondary tagging:
  - `pattern`
  - `topic`
  - `tool_stack`

This creates a stable learner-facing navigation model while keeping enough flexibility for retrieval, agent, training, and deployment content.

## First-Level Categories

### 1. Fundamentals

- zh: `基础概念`
- en: `Fundamentals`
- scope: math intuition, optimization basics, representation learning basics
- examples: dimension, linear transform, gradient, loss, manifold

### 2. Model Architecture

- zh: `模型结构`
- en: `Model Architecture`
- scope: internal model components, structural mechanisms, composition patterns
- examples: Transformer, Attention, FFN, Embedding, RoPE, residual connection, normalization

### 3. Pretraining & Data

- zh: `预训练与数据`
- en: `Pretraining & Data`
- scope: tokenization, corpora, pretraining objectives, continued pretraining, data pipelines

### 4. Post-training & Alignment

- zh: `后训练与对齐`
- en: `Post-training & Alignment`
- scope: instruction tuning, SFT, PEFT, LoRA, DPO, reward modeling, distillation

### 5. Reinforcement Learning

- zh: `强化学习`
- en: `Reinforcement Learning`
- scope: reward-based learning, policy optimization, RLHF policy stage, multi-agent RL

### 6. Retrieval & Agent Systems

- zh: `检索与 Agent 系统`
- en: `Retrieval & Agent Systems`
- scope: retrieval pipelines, RAG, workflows, tool use, memory, planning, agent orchestration

### 7. Inference & Deployment

- zh: `推理与部署`
- en: `Inference & Deployment`
- scope: inference optimization, quantization, KV cache, serving, deployment frameworks

### 8. Evaluation & Safety

- zh: `评测与安全`
- en: `Evaluation & Safety`
- scope: benchmarking, hallucination analysis, red teaming, guardrails, review, governance

## Primary and Secondary Category Rules

Each FAQ must have:

- exactly 1 `primary_category`
- 0 or 1 `secondary_category`

Interpretation:

- primary category answers: what is the main learning payoff of this FAQ?
- secondary category answers: what is the strongest adjacent learning track that is meaningfully involved?

Rules:

- never assign 2 primary categories
- if the second dimension is weak or incidental, leave `secondary_category` empty
- a tool, framework, or hot term can never be used as a primary or secondary category

Examples:

- residual connection:
  - primary: `模型结构`
  - secondary: `基础概念`
- LoRA rank and memory/performance:
  - primary: `后训练与对齐`
  - secondary: `推理与部署`
- why RAG retrieves wrong documents:
  - primary: `检索与 Agent 系统`
  - secondary: `评测与安全`
- what PPO optimizes in RLHF:
  - primary: `强化学习`
  - secondary: `后训练与对齐`
- why KV cache reduces decoding cost:
  - primary: `推理与部署`
  - secondary: `模型结构`

## Facet Groups

Facet groups are controlled secondary labels. They support search, filtering, and detail-page context, but they do not define the main site navigation.

### pattern

Used for system shape and orchestration pattern.

Initial controlled values:

- `workflow`
- `rag`
- `tool_use`
- `single_agent`
- `multi_agent`
- `memory`
- `planner_executor`
- `human_in_the_loop`

### topic

Used for model or systems concepts that learners explicitly search for.

Initial controlled values:

- `transformer`
- `attention`
- `embedding`
- `rope`
- `residual_connection`
- `normalization`
- `lora`
- `sft`
- `dpo`
- `reward_model`
- `ppo`
- `grpo`
- `kv_cache`
- `quantization`
- `distillation`

### tool_stack

Used for concrete implementation stacks only.

Initial controlled values:

- `pytorch`
- `transformers`
- `trl`
- `vllm`
- `llama_cpp`
- `langchain`
- `smolagents`

## Governance Rules

### Fixed category policy

The 8 first-level categories are fixed. They should not be changed casually as content volume grows.

### Controlled vocabulary policy

All categories and facet values must come from a versioned taxonomy file. The application must not rely on free-form strings as the source of truth.

### New facet admission policy

A new controlled facet value should only be added when all of the following are true:

1. It is not already covered by an existing value.
2. Its meaning is stable enough to survive beyond a short-term trend.
3. It clearly belongs to one facet group.
4. It is expected to cover multiple FAQs rather than a single entry.
5. It has a bilingual display name and a short definition.

### Alias policy

Synonyms should be added as aliases to an existing value, not as separate formal values.

### Deprecation policy

Deprecated values should remain in taxonomy history with metadata such as:

- `status: deprecated`
- `merged_into`

They should not be hard-deleted if historical content still references them.

## Data Model Direction

The new taxonomy source of truth should move toward a structured JSON shape instead of distributing logic across:

- `data/tag-taxonomy.json`
- `lib/i18n.ts`
- hardcoded categorization logic in scripts

Suggested shape:

```json
{
  "categories": [
    { "key": "fundamentals", "zh": "基础概念", "en": "Fundamentals" },
    { "key": "model_architecture", "zh": "模型结构", "en": "Model Architecture" },
    { "key": "pretraining_data", "zh": "预训练与数据", "en": "Pretraining & Data" },
    { "key": "post_training_alignment", "zh": "后训练与对齐", "en": "Post-training & Alignment" },
    { "key": "reinforcement_learning", "zh": "强化学习", "en": "Reinforcement Learning" },
    { "key": "retrieval_agent_systems", "zh": "检索与 Agent 系统", "en": "Retrieval & Agent Systems" },
    { "key": "inference_deployment", "zh": "推理与部署", "en": "Inference & Deployment" },
    { "key": "evaluation_safety", "zh": "评测与安全", "en": "Evaluation & Safety" }
  ],
  "facets": {
    "pattern": [],
    "topic": [],
    "tool_stack": []
  }
}
```

FAQ item direction:

```json
{
  "primary_category": "model_architecture",
  "secondary_category": "fundamentals",
  "patterns": [],
  "topics": ["residual_connection"],
  "tool_stack": []
}
```

## Migration Principles

### Remove unstable old buckets

These existing first-level buckets should not survive as first-level categories:

- `深度学习`
- `生成式 AI / LLM`
- `工具与框架`

Reason:

- `深度学习` is too broad and hides multiple learning stages
- `生成式 AI / LLM` is a wave label, not a durable learner-facing taxonomy bucket
- `工具与框架` belongs in `tool_stack`, not in primary navigation

### Re-map by learning payoff

Old tags should be remapped based on what the FAQ mainly teaches, not by literal string matching alone.

Examples:

- `Transformer`, `RoPE`, `残差连接` -> usually `模型结构`
- `LoRA`, `DPO`, `SFT` -> usually `后训练与对齐`
- `PPO`, `GRPO` -> usually `强化学习`
- `RAG`, `tool use`, `memory` -> usually `检索与 Agent 系统`
- `KVCache`, `量化`, `推理优化` -> usually `推理与部署`

## External Grounding

This design no longer uses arXiv as a visible classification system. Instead, it is informed by official workflow-oriented sources that better match the product:

- Google ML Crash Course on LLM tuning:
  - foundation/pre-trained models, fine-tuning, distillation, prompt engineering
- Hugging Face TRL:
  - post-training methods such as SFT, DPO, GRPO, reward modeling, PPO
- Anthropic guidance on agentic systems:
  - workflows versus agents

These sources inform the conceptual boundaries, but the taxonomy itself is product-owned and learner-oriented.

## Recommended Next Step

Create an implementation plan to:

1. define the new taxonomy source file
2. migrate existing FAQ category/tag data into the new schema
3. update UI filters and i18n to read from the new taxonomy
4. update any AI-analysis prompts to emit primary/secondary categories plus facet labels
