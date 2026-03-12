import {
  getFacetOptions,
  getPrimaryCategoryOptions,
  normalizeFacetValue,
  normalizePrimaryCategoryKey,
} from "./taxonomy";

const PRIMARY_CATEGORY_OPTIONS = getPrimaryCategoryOptions();
const PRIMARY_CATEGORY_NAMES = PRIMARY_CATEGORY_OPTIONS.map(
  (category) => `${category.key} (${category.zh})`
);
const PATTERN_OPTIONS = getFacetOptions("pattern");
const TOPIC_OPTIONS = getFacetOptions("topic");
const TOOL_STACK_OPTIONS = getFacetOptions("tool_stack");

export interface GeneratedQA {
  question: string;
  answer: string;
  tags: string[]; 
  primary_category: string | null;
  secondary_category: string | null;
  patterns: string[];
  topics: string[];
  tool_stack: string[];
  confidence: number;
}

export interface JudgeScore {
  question_scores: {
    naturalness: number;
    context_relevance: number;
    knowledge_clarity: number;
    phrasing: number;
  };
  answer_scores: {
    accuracy: number;
    completeness: number;
    mastery: number;
    independence: number;
  };
  average: number;
  verdict: "pass" | "fail";
  question_suggestion: string;
  answer_suggestion: string;
}

export interface JudgeResult {
  results: JudgeScore[];
  summary: { total: number; passed: number; failed: number };
}

const JUDGE_THRESHOLD = 3.5;

export async function generateQAPairs(
  documentText: string,
  existingTags: string[]
): Promise<GeneratedQA[]> {
  const baseUrl = process.env.AI_API_BASE_URL;
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;
  if (!baseUrl || !apiKey || !model) throw new Error("AI API configuration is incomplete");

  const systemPrompt = `你是一个 AI/ML 领域的技术教育专家。你的任务是阅读一篇技术文档，提取核心知识点，生成高质量的问答对。

要求:
1. 每个问答对包含: question (中文), answer (中文 Markdown，支持 LaTeX 公式用 $ 或 $$ 包裹), tags (2-5个中文技术标签), primary_category (1个一级主类 canonical key), secondary_category (可选一级主类 canonical key 或 null), patterns (0-3个 pattern key), topics (0-4个 topic key), tool_stack (0-3个 tool_stack key), confidence (0-1 的置信度)
2. 问题要像真实用户会问的，自然、有场景感，不要生硬拼凑
3. 答案要完整、准确，读者不需要看原文也能理解
4. 根据文档长度自适应生成数量（约每 1000 字 1-2 个 QA）
5. 尽量复用已有标签: ${existingTags.join(", ")}
6. primary_category 只能从以下一级主类 canonical key 中选择: ${PRIMARY_CATEGORY_NAMES.join(", ")}
7. secondary_category 可选；如果没有强相关第二主线，返回 null。只能从同一份一级主类 canonical key 列表中选择
8. patterns 只能从以下 pattern key 中选择: ${PATTERN_OPTIONS.map((option) => `${option.key} (${option.zh})`).join(", ")}
9. topics 只能从以下 topic key 中选择: ${TOPIC_OPTIONS.map((option) => `${option.key} (${option.zh})`).join(", ")}
10. tool_stack 只能从以下 tool_stack key 中选择: ${TOOL_STACK_OPTIONS.map((option) => `${option.key} (${option.zh})`).join(", ")}

只输出 JSON: { "qa_pairs": [...] }`;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `文档内容:\n\n${documentText}` },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI API error (${response.status}): ${text}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI returned empty response");

  const parsed = JSON.parse(content);
  if (!Array.isArray(parsed.qa_pairs)) return [];

  return parsed.qa_pairs.map((qa: unknown) => {
    const item = typeof qa === "object" && qa !== null ? (qa as Record<string, unknown>) : {};

    return {
      question: typeof item.question === "string" ? item.question : "",
      answer: typeof item.answer === "string" ? item.answer : "",
      tags: Array.isArray(item.tags)
        ? item.tags.filter((tag: unknown): tag is string => typeof tag === "string")
        : [],
      primary_category:
        typeof item.primary_category === "string"
          ? normalizePrimaryCategoryKey(item.primary_category)
          : null,
      secondary_category:
        typeof item.secondary_category === "string"
          ? normalizePrimaryCategoryKey(item.secondary_category)
          : null,
      patterns: Array.isArray(item.patterns)
        ? [
            ...new Set(
              item.patterns
                .map((value: unknown) =>
                  normalizeFacetValue("pattern", typeof value === "string" ? value : null)
                )
                .filter((value: string | null): value is string => value !== null)
            ),
          ]
        : [],
      topics: Array.isArray(item.topics)
        ? [
            ...new Set(
              item.topics
                .map((value: unknown) =>
                  normalizeFacetValue("topic", typeof value === "string" ? value : null)
                )
                .filter((value: string | null): value is string => value !== null)
            ),
          ]
        : [],
      tool_stack: Array.isArray(item.tool_stack)
        ? [
            ...new Set(
              item.tool_stack
                .map((value: unknown) =>
                  normalizeFacetValue("tool_stack", typeof value === "string" ? value : null)
                )
                .filter((value: string | null): value is string => value !== null)
            ),
          ]
        : [],
      confidence: typeof item.confidence === "number" ? item.confidence : 0,
    };
  });
}

export async function judgeQAPairs(
  qaPairs: GeneratedQA[],
  documentSummary: string
): Promise<JudgeResult> {
  const baseUrl = process.env.AI_API_BASE_URL;
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;
  if (!baseUrl || !apiKey || !model) throw new Error("AI API configuration is incomplete");

  const systemPrompt = `你是一个 QA 质量评审专家。评估每个问答对的质量。

评分维度 (每项 1-5 分):

问题评分:
- naturalness: 是否像真实用户会问的，不是生硬拼凑
- context_relevance: 脱离原文后问题是否还有意义
- knowledge_clarity: 是否清楚在考什么知识
- phrasing: 结合场景的问法是否恰当

答案评分:
- accuracy: 答案是否正确
- completeness: 是否充分回答了问题
- mastery: 读者看完能否真正理解这个知识点
- independence: 不依赖原文上下文也能理解

对每个 QA:
1. 给出各维度分数
2. 计算平均分 (8个维度的平均)
3. 平均分 >= ${JUDGE_THRESHOLD} 为 pass，否则 fail
4. 给出 question_suggestion (问题改进建议，包括更好的问法)
5. 给出 answer_suggestion (答案改进建议)

只输出 JSON: { "results": [...], "summary": { "total": N, "passed": N, "failed": N } }`;

  const userPrompt = `原文摘要:\n${documentSummary}\n\n待评估的 QA 对:\n${qaPairs.map((qa, i) => `--- QA ${i + 1} ---\n问题: ${qa.question}\n答案: ${qa.answer}`).join("\n\n")}`;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI API error (${response.status}): ${text}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI returned empty response");

  return JSON.parse(content);
}
