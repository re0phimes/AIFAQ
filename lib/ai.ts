import type { Reference, FAQImage } from "@/src/types/faq";
import type { CandidateImage } from "./image-extractor";
import taxonomy from "@/data/tag-taxonomy.json";

const CATEGORY_NAMES = (taxonomy as { categories: { name: string }[] }).categories.map(c => c.name);

interface AIAnalysisResult {
  tags: string[];
  categories: string[];
  references: Reference[];
  answer: string;
  answer_brief: string;
  answer_en: string;
  answer_brief_en: string;
  question_en: string;
  images: FAQImage[];
}

export async function analyzeFAQ(
  question: string,
  answerRaw: string,
  existingTags: string[],
  candidateImages?: CandidateImage[]
): Promise<AIAnalysisResult> {
  const baseUrl = process.env.AI_API_BASE_URL;
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;

  if (!baseUrl || !apiKey || !model) {
    throw new Error("AI API configuration is incomplete");
  }

  const hasImages = candidateImages && candidateImages.length > 0;

  const systemPrompt = `你是一个 AI/ML 知识库助手。你的任务是分析用户提交的问答对，并输出结构化的 JSON。

要求:
1. tags: 为这个问答生成 2-5 个标签。尽量复用已有标签列表中的标签，保持一致性。标签应该是中文的技术术语。
2. references: 根据问答内容，推荐 1-3 个相关的论文 (arXiv) 或技术博客文章。每个引用包含 type ("paper" 或 "blog")、title 和 url。
3. answer: 对原始答案进行扩展和深化，补充更多推导过程、示例、对比分析，使其更完整、准确。保持 Markdown 格式，支持 LaTeX 公式 (用 $ 或 $$ 包裹)。中文输出。
4. answer_brief: 中文简要版答案。如果原始答案不超过 500 字符，则保持原文不变；如果超过 500 字符，则压缩为不超过 500 字符的精炼摘要。
5. answer_en: answer 的英文翻译。保持 Markdown 格式和 LaTeX 公式。
6. answer_brief_en: answer_brief 的英文翻译。
7. question_en: 问题的英文翻译。
8. categories: 从以下大标签列表中选择 1-2 个最匹配的分类: ${CATEGORY_NAMES.join(", ")}
${hasImages ? `9. images: 从候选图片列表中选择 0-3 张与答案内容最相关的图片。输出数组，每项包含 url、caption (简短中文描述)、source ("blog" 或 "paper")。选择标准：图片的 caption/alt/context 与答案内容匹配度高，优先选择架构图和流程图，避免选择数据表格截图。如果没有合适的图片，返回空数组 []。` : ""}

已有标签列表: ${existingTags.join(", ")}

只输出 JSON，不要输出其他内容。`;

  let userPrompt = `问题: ${question}

原始答案:
${answerRaw}`;

  if (hasImages) {
    userPrompt += `\n\n候选图片列表:\n${candidateImages.map((img, i) =>
      `${i + 1}. URL: ${img.url}\n   Alt: ${img.alt}\n   Caption: ${img.caption}\n   Context: ${img.context}\n   Source: ${img.source}`
    ).join("\n")}`;
  }

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

  // Validate core structure
  if (!Array.isArray(parsed.tags) || !Array.isArray(parsed.references) || typeof parsed.answer !== "string") {
    throw new Error("AI returned invalid JSON structure");
  }
  if (!Array.isArray(parsed.categories)) {
    parsed.categories = [];
  }

  // Defaults for bilingual fields
  if (typeof parsed.answer_brief !== "string") parsed.answer_brief = answerRaw;
  if (typeof parsed.answer_en !== "string") parsed.answer_en = "";
  if (typeof parsed.answer_brief_en !== "string") parsed.answer_brief_en = "";
  if (typeof parsed.question_en !== "string") parsed.question_en = "";
  if (!Array.isArray(parsed.images)) parsed.images = [];

  return parsed;
}
