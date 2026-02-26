import * as fs from "fs";
import * as path from "path";

const FAQ_PATH = path.resolve(__dirname, "../data/faq.json");
const TAXONOMY_PATH = path.resolve(__dirname, "../data/tag-taxonomy.json");

const TAG_TO_CATEGORIES: Record<string, string[]> = {
  "Transformer": ["深度学习"],
  "残差连接": ["深度学习"],
  "Add&Norm": ["深度学习"],
  "注意力机制": ["深度学习"],
  "多头注意力": ["深度学习"],
  "FFN": ["深度学习"],
  "Embedding": ["深度学习"],
  "位置编码": ["深度学习"],
  "RoPE": ["深度学习"],
  "DecoupledRoPE": ["深度学习"],
  "QKV": ["深度学习"],
  "缩放点积": ["深度学习"],
  "点积": ["深度学习"],
  "GQA": ["深度学习"],
  "MQA": ["深度学习"],
  "MLA": ["深度学习"],
  "MoE": ["深度学习"],
  "CLS": ["深度学习", "自然语言处理"],
  "恒等映射": ["深度学习"],
  "网络退化": ["深度学习"],
  "特征融合": ["深度学习"],
  "模型设计": ["深度学习"],
  "深度学习": ["深度学习"],
  "归一化": ["深度学习"],
  "LayerNorm": ["深度学习"],
  "BatchNorm": ["深度学习"],
  "RMSNorm": ["深度学习"],
  "InstanceNorm": ["深度学习"],
  "激活函数": ["深度学习"],
  "ReLU": ["深度学习"],
  "GELU": ["深度学习"],
  "ELU": ["深度学习"],
  "SwiGLU": ["深度学习"],
  "GLU": ["深度学习"],
  "神经元死亡": ["深度学习"],
  "有界性": ["深度学习"],
  "训练技巧": ["机器学习基础", "深度学习"],
  "训练稳定性": ["深度学习"],
  "训练过程": ["深度学习"],
  "梯度": ["机器学习基础", "深度学习"],
  "损失曲面": ["机器学习基础"],
  "优化理论": ["机器学习基础"],
  "优化目标": ["机器学习基础"],
  "仿射变换": ["AI 基础概念"],
  "线性变换": ["AI 基础概念"],
  "维度": ["AI 基础概念"],
  "维度变换": ["AI 基础概念"],
  "公式": ["AI 基础概念"],
  "公式推导": ["AI 基础概念"],
  "流形": ["AI 基础概念"],
  "流形假说": ["AI 基础概念"],
  "作用域": ["AI 基础概念"],
  "反面题": ["AI 基础概念"],
  "NLP": ["自然语言处理"],
  "BERT": ["自然语言处理", "深度学习"],
  "GPT": ["生成式 AI / LLM"],
  "上下文长度": ["生成式 AI / LLM"],
  "上下文管理": ["生成式 AI / LLM"],
  "logprob": ["生成式 AI / LLM"],
  "推理优化": ["数据工程与 MLOps"],
  "推理阶段": ["数据工程与 MLOps"],
  "推理框架": ["工具与框架"],
  "KVCache": ["深度学习", "数据工程与 MLOps"],
  "Attention优化": ["深度学习", "数据工程与 MLOps"],
  "计算复杂度": ["深度学习"],
  "矩阵吸收": ["深度学习"],
  "ComputeBound": ["数据工程与 MLOps"],
  "MemoryBound": ["数据工程与 MLOps"],
  "内存墙": ["数据工程与 MLOps"],
  "GEMM": ["数据工程与 MLOps"],
  "GEMV": ["数据工程与 MLOps"],
  "量化": ["数据工程与 MLOps"],
  "LoRA": ["生成式 AI / LLM"],
  "RAG": ["生成式 AI / LLM"],
  "llama.cpp": ["工具与框架"],
  "工程实践": ["数据工程与 MLOps"],
};

function main(): void {
  const faqItems = JSON.parse(fs.readFileSync(FAQ_PATH, "utf-8")) as Record<string, unknown>[];
  const taxonomy = JSON.parse(fs.readFileSync(TAXONOMY_PATH, "utf-8")) as {
    categories: { name: string; description: string; tags: string[] }[];
  };

  // Build category -> tags
  const categoryTags = new Map<string, Set<string>>();
  for (const cat of taxonomy.categories) {
    categoryTags.set(cat.name, new Set());
  }
  for (const [tag, cats] of Object.entries(TAG_TO_CATEGORIES)) {
    for (const cat of cats) {
      categoryTags.get(cat)?.add(tag);
    }
  }

  // Update taxonomy
  for (const cat of taxonomy.categories) {
    cat.tags = [...(categoryTags.get(cat.name) ?? [])].sort();
  }
  fs.writeFileSync(TAXONOMY_PATH, JSON.stringify(taxonomy, null, 2) + "\n", "utf-8");

  // Update FAQ items
  for (const item of faqItems) {
    const tags = (item.tags as string[]) ?? [];
    const categories = new Set<string>();
    for (const tag of tags) {
      const cats = TAG_TO_CATEGORIES[tag];
      if (cats) for (const c of cats) categories.add(c);
    }
    item.categories = [...categories];
    if (item.upvoteCount === undefined) item.upvoteCount = 0;
    if (item.outdatedCount === undefined) item.outdatedCount = 0;
    if (item.inaccurateCount === undefined) item.inaccurateCount = 0;
  }
  fs.writeFileSync(FAQ_PATH, JSON.stringify(faqItems, null, 2) + "\n", "utf-8");

  console.log(`Updated ${faqItems.length} FAQ items`);
  for (const cat of taxonomy.categories) {
    console.log(`  ${cat.name}: ${cat.tags.length} tags`);
  }
}

main();
