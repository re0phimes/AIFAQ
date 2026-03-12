import test from "node:test";
import assert from "node:assert/strict";
import { classifyLegacyFaq } from "./migrate-faq-taxonomy";

test("Transformer + 残差连接 maps to model_architecture", () => {
  const result = classifyLegacyFaq({
    question: "残差连接中 F(x) 代表什么？",
    tags: ["残差连接", "Transformer"],
    categories: ["深度学习"],
    references: [],
  });

  assert.equal(result.primary_category, "model_architecture");
  assert.deepEqual(result.topics, ["transformer", "residual_connection"]);
});

test("LoRA content maps to post_training_alignment", () => {
  const result = classifyLegacyFaq({
    question: "LoRA 的 rank 为什么影响显存和效果？",
    tags: ["LoRA", "量化"],
    categories: ["生成式 AI / LLM"],
    references: [],
  });

  assert.equal(result.primary_category, "post_training_alignment");
  assert.deepEqual(result.topics, ["lora", "quantization"]);
});

test("PPO content maps to reinforcement_learning", () => {
  const result = classifyLegacyFaq({
    question: "PPO 在 RLHF 里实际优化的目标是什么？",
    tags: ["PPO", "RLHF"],
    categories: ["强化学习"],
    references: [],
  });

  assert.equal(result.primary_category, "reinforcement_learning");
  assert.deepEqual(result.topics, ["ppo"]);
});

test("RAG content maps to retrieval_agent_systems", () => {
  const result = classifyLegacyFaq({
    question: "RAG 为什么会检索错文档？",
    tags: ["RAG", "LangChain"],
    categories: ["生成式 AI / LLM"],
    references: [],
  });

  assert.equal(result.primary_category, "retrieval_agent_systems");
  assert.deepEqual(result.patterns, ["rag"]);
  assert.deepEqual(result.tool_stack, ["langchain"]);
});

test("KVCache content maps to inference_deployment", () => {
  const result = classifyLegacyFaq({
    question: "KVCache 为什么能降低自回归推理延迟？",
    tags: ["KVCache", "量化", "vLLM"],
    categories: ["数据工程与 MLOps"],
    references: [],
  });

  assert.equal(result.primary_category, "inference_deployment");
  assert.deepEqual(result.topics, ["kv_cache", "quantization"]);
  assert.deepEqual(result.tool_stack, ["vllm"]);
});

test("full finetuning memory question maps to post_training_alignment without agent-memory false positive", () => {
  const result = classifyLegacyFaq({
    question: "分析一下一个参数量为4B的模型，精度为bf16的情况下，我们在全量微调的时候需要多少显存？",
    tags: ["深度学习", "内存管理", "GPU优化"],
    categories: [],
    references: [],
  });

  assert.equal(result.primary_category, "post_training_alignment");
  assert.equal(result.ambiguous, false);
  assert.deepEqual(result.patterns, []);
});

test("max_position_embeddings maps to model_architecture", () => {
  const result = classifyLegacyFaq({
    question: "max_position_embeddings 是什么？超过会怎样？",
    tags: ["Context Engineering", "推理框架"],
    categories: [],
    references: [],
  });

  assert.equal(result.primary_category, "model_architecture");
  assert.equal(result.ambiguous, false);
});

test("bucketing experiment question maps to evaluation_safety", () => {
  const result = classifyLegacyFaq({
    question: "你说线上提升2.1%，实验分桶方案是什么？",
    tags: ["工程实践", "优化理论", "数据工程与 MLOps"],
    categories: ["数据工程与 MLOps"],
    references: [],
  });

  assert.equal(result.primary_category, "evaluation_safety");
  assert.equal(result.ambiguous, false);
});

test("LoRA ablation question maps to post_training_alignment without ambiguity", () => {
  const result = classifyLegacyFaq({
    question: "LoRA rank为什么这么选？有没有做过ablation？",
    tags: ["LoRA", "训练技巧", "优化目标", "工程实践", "公式推导"],
    categories: ["深度学习", "生成式 AI / LLM"],
    references: [],
  });

  assert.equal(result.primary_category, "post_training_alignment");
  assert.equal(result.ambiguous, false);
});

test("llama.cpp n_keep maps to inference_deployment", () => {
  const result = classifyLegacyFaq({
    question: "llama.cpp 的 n_keep 参数如何工作？",
    tags: ["llama.cpp", "Context Engineering"],
    categories: [],
    references: [],
  });

  assert.equal(result.primary_category, "inference_deployment");
  assert.equal(result.ambiguous, false);
  assert.deepEqual(result.tool_stack, ["llama_cpp"]);
});
