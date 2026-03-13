# FAQ Taxonomy V2.1 Design

## Context

The current FAQ taxonomy has improved over the original mixed tag system, but two structural issues remain:

- `patterns` overlaps with learner-facing concepts and creates a second quasi-category layer.
- `retrieval_agent_systems` merges two different learning tracks: retrieval systems and agent systems.

The product is a learner FAQ site. The taxonomy should therefore prioritize stable learning tracks first, then use lightweight controlled vocabularies for supporting context.

## Approved Direction

This redesign adopts Scheme 2:

- keep `primary_category`
- keep optional `secondary_category`
- keep `topics`
- keep `tool_stack`
- remove `patterns`
- split `retrieval_agent_systems` into:
  - `retrieval_systems`
  - `agent_systems`

This makes the learner-facing hierarchy simpler while still preserving useful implementation context.

## Goals

1. Make the main taxonomy reflect learning tracks instead of system-shape labels.
2. Separate retrieval knowledge from agent knowledge at the first level.
3. Preserve tool/framework discoverability without letting tools become first-class navigation.
4. Reduce ambiguity in automated classification rules.
5. Keep migration auditable and reversible through deterministic backfill scripts.

## Non-Goals

- Reintroducing free-form tags as a visible taxonomy layer.
- Keeping `patterns` as a hidden but active classification dimension.
- Expanding the taxonomy to cover non-AI content such as generic algorithms.

## Final Taxonomy Model

Each FAQ has:

- exactly 1 `primary_category`
- 0 or 1 `secondary_category`
- 0 to N `topics`
- 0 to N `tool_stack`

`patterns` is removed from the model and from learner-facing UI.

## First-Level Categories

The final first-level category set is:

1. `fundamentals`
   - zh: `基础概念`
   - en: `Fundamentals`
   - scope: optimization basics, representation learning, mathematical intuition

2. `model_architecture`
   - zh: `模型结构`
   - en: `Model Architecture`
   - scope: Transformer internals, structure, components, architecture mechanisms

3. `pretraining_data`
   - zh: `预训练与数据`
   - en: `Pretraining & Data`
   - scope: tokenization, corpus, pretraining objectives, continued pretraining

4. `post_training_alignment`
   - zh: `后训练与对齐`
   - en: `Post-training & Alignment`
   - scope: instruction tuning, LoRA, DPO, reward model, distillation

5. `reinforcement_learning`
   - zh: `强化学习`
   - en: `Reinforcement Learning`
   - scope: PPO, GRPO, policy optimization, RLHF policy stage

6. `retrieval_systems`
   - zh: `检索系统`
   - en: `Retrieval Systems`
   - scope: RAG, chunking, reranking, retrieval pipelines, query transformation

7. `agent_systems`
   - zh: `Agent 系统`
   - en: `Agent Systems`
   - scope: tool use, planning, memory, multi-agent collaboration, HITL

8. `inference_deployment`
   - zh: `推理与部署`
   - en: `Inference & Deployment`
   - scope: KV cache, quantization, serving, context windows, deployment/runtime optimization

9. `evaluation_safety`
   - zh: `评测与安全`
   - en: `Evaluation & Safety`
   - scope: benchmark, hallucination, guardrails, red teaming, online evaluation

## Controlled Topics

The controlled `topic` vocabulary becomes the only learner-facing secondary label layer.

### Foundation and Architecture

- `optimization_basics`
- `representation_learning`
- `embedding`
- `transformer`
- `attention`
- `positional_encoding`
- `residual_connection`
- `normalization`
- `ffn`
- `moe`

### Pretraining and Data

- `tokenizer`
- `corpus_data`
- `data_processing`
- `pretraining_objective`
- `continued_pretraining`
- `synthetic_data`

### Post-training and RL

- `sft`
- `instruction_tuning`
- `lora`
- `dpo`
- `reward_model`
- `distillation`
- `rlhf`
- `ppo`
- `grpo`

### Retrieval Systems

- `rag`
- `chunking`
- `reranking`
- `query_rewrite`
- `hybrid_search`
- `knowledge_base`

### Agent Systems

- `tool_use`
- `planning`
- `memory`
- `single_agent`
- `multi_agent`
- `human_in_the_loop`
- `computer_use`

### Inference and Deployment

- `kv_cache`
- `quantization`
- `speculative_decoding`
- `serving`
- `batching`
- `context_window`

### Evaluation and Safety

- `benchmark`
- `hallucination`
- `guardrails`
- `red_teaming`
- `monitoring`
- `ab_testing`

## Tool Stack

`tool_stack` remains controlled and implementation-oriented:

- `pytorch`
- `transformers`
- `deepspeed`
- `trl`
- `vllm`
- `sglang`
- `llama_cpp`
- `faiss`
- `milvus`
- `qdrant`
- `elasticsearch`
- `langchain`
- `langgraph`
- `llamaindex`
- `smolagents`
- `autogen`

## Field Semantics

### primary_category

Answers: what is the main learning payoff of this FAQ?

### secondary_category

Answers: what is the strongest adjacent learning track involved?

### topics

Answers: what specific concepts would learners search for inside this FAQ?

### tool_stack

Answers: which concrete frameworks or runtimes are materially involved?

## Mapping Rules

- `RAG` is a `topic`, not a pattern.
- `tool use` is a `topic`, not a pattern.
- `workflow` is removed as a first-class controlled dimension.
- `memory` remains only when it refers to agent/system memory, not generic hardware memory.
- retrieval-first content goes to `retrieval_systems`
- agentic orchestration content goes to `agent_systems`
- deployment/runtime parameter questions stay in `inference_deployment`

## Data Model Changes

### Keep

- `primary_category`
- `secondary_category`
- `topics`
- `tool_stack`

### Remove

- `patterns`

### Taxonomy Source of Truth

The canonical taxonomy file must:

- remove `facets.pattern`
- replace category key `retrieval_agent_systems`
- add category keys:
  - `retrieval_systems`
  - `agent_systems`

## Migration Strategy

1. Update canonical taxonomy definitions and runtime helpers.
2. Remove `patterns` from visible UI, API contracts, AI prompts, and import/export flows.
3. Backfill existing DB rows:
   - rewrite `retrieval_agent_systems` to either `retrieval_systems` or `agent_systems`
   - map former pattern values into topics where applicable
4. Re-run deterministic dry-run reports until ambiguity is acceptable.
5. Execute production DB backfill.

## Residual Content Outside Scope

There are existing FAQs that are not AI taxonomy candidates, such as generic algorithm problems.

These should not be force-mapped. They should remain:

- `primary_category = null`
- `secondary_category = null`
- `topics = []`

until a separate product decision is made about non-AI content.

## Acceptance Criteria

- no learner-facing UI references `patterns`
- `retrieval_systems` and `agent_systems` both exist as first-level categories
- taxonomy helpers and prompts no longer reference `retrieval_agent_systems`
- DB backfill completes with deterministic output
- visible FAQ classification uses only:
  - primary category
  - optional secondary category
  - topics
  - optional tool stack
