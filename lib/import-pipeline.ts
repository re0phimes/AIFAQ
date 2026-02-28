export interface GeneratedQA {
  question: string;
  answer: string;
  tags: string[];
  categories: string[];
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
1. 每个问答对包含: question (中文), answer (中文 Markdown，支持 LaTeX 公式用 $ 或 $$ 包裹), tags (2-5个中文技术标签), categories (1-2个分类), confidence (0-1 的置信度)
2. 问题要像真实用户会问的，自然、有场景感，不要生硬拼凑
3. 答案要完整、准确，读者不需要看原文也能理解
4. 根据文档长度自适应生成数量（约每 1000 字 1-2 个 QA）
5. 尽量复用已有标签: ${existingTags.join(", ")}

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
  return parsed.qa_pairs ?? [];
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
