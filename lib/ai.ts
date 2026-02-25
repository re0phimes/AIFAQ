import type { Reference } from "@/src/types/faq";

interface AIAnalysisResult {
  tags: string[];
  references: Reference[];
  answer: string;
}

export async function analyzeFAQ(
  question: string,
  answerRaw: string,
  existingTags: string[]
): Promise<AIAnalysisResult> {
  const baseUrl = process.env.AI_API_BASE_URL;
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;

  if (!baseUrl || !apiKey || !model) {
    throw new Error("AI API configuration is incomplete");
  }

  const systemPrompt = `你是一个 AI/ML 知识库助手。你的任务是分析用户提交的问答对，并输出结构化的 JSON。

要求:
1. tags: 为这个问答生成 2-5 个标签。尽量复用已有标签列表中的标签，保持一致性。标签应该是中文的技术术语。
2. references: 根据问答内容，推荐 1-3 个相关的论文 (arXiv) 或技术博客文章。每个引用包含 type ("paper" 或 "blog")、title 和 url。
3. answer: 对原始答案进行润色和补充，使其更完整、准确。保持 Markdown 格式，支持 LaTeX 公式 (用 $ 或 $$ 包裹)。

已有标签列表: ${existingTags.join(", ")}

只输出 JSON，不要输出其他内容。`;

  const userPrompt = `问题: ${question}

原始答案:
${answerRaw}`;

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

  const parsed = JSON.parse(content) as AIAnalysisResult;

  // Validate structure
  if (!Array.isArray(parsed.tags) || !Array.isArray(parsed.references) || typeof parsed.answer !== "string") {
    throw new Error("AI returned invalid JSON structure");
  }

  return parsed;
}
