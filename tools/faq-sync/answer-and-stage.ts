import * as fs from "fs";
import * as path from "path";
import { createFaqItem, getPublishedFaqItems, initDB, updateFaqStatus } from "../../lib/db";
import { computeEvidenceFlags, rankSources, type GroundingSource } from "./grounding";
import { extractQuestionsFromImages, normalizeQuestions, readQuestionsFile } from "./question-intake";
import taxonomy from "../../data/tag-taxonomy.json";
import type { Reference } from "../../src/types/faq";

interface Options {
  question?: string;
  questionsFile?: string;
  images: string[];
  max?: number;
  dryRun: boolean;
  help: boolean;
}

interface PipelineResult {
  question: string;
  draftAnswer: string;
  sources: GroundingSource[];
  final: {
    question_en: string;
    answer: string;
    answer_brief: string;
    answer_en: string;
    answer_brief_en: string;
    tags: string[];
    categories: string[];
    references: Reference[];
    verification_notes: string;
  };
  evidence: {
    sourceCount: number;
    hasPaper: boolean;
    needsManualVerification: boolean;
  };
  stagedFaqId: number | null;
}

interface AIResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

const OUT_DIR = path.resolve(__dirname, "../../data/faq-sync/grounded");
const CATEGORY_NAMES = (taxonomy as { categories: { name: string }[] }).categories.map((c) => c.name);

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    images: [],
    dryRun: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      opts.help = true;
      continue;
    }
    if (arg === "--dry-run") {
      opts.dryRun = true;
      continue;
    }
    if (arg.startsWith("--question=")) {
      opts.question = arg.slice("--question=".length).trim();
      continue;
    }
    if (arg === "--question" && argv[i + 1]) {
      opts.question = argv[++i].trim();
      continue;
    }
    if (arg.startsWith("--questions-file=")) {
      opts.questionsFile = arg.slice("--questions-file=".length).trim();
      continue;
    }
    if (arg === "--questions-file" && argv[i + 1]) {
      opts.questionsFile = argv[++i].trim();
      continue;
    }
    if (arg.startsWith("--images=")) {
      opts.images = arg
        .slice("--images=".length)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      continue;
    }
    if (arg === "--images" && argv[i + 1]) {
      opts.images = argv[++i]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      continue;
    }
    if (arg.startsWith("--max=")) {
      const n = Number(arg.slice("--max=".length));
      if (!Number.isNaN(n) && n > 0) opts.max = n;
      continue;
    }
    if (arg === "--max" && argv[i + 1]) {
      const n = Number(argv[++i]);
      if (!Number.isNaN(n) && n > 0) opts.max = n;
      continue;
    }
  }
  return opts;
}

function printHelp(): void {
  console.log(`Usage: faq:answer-and-stage [options]

Options:
  --question "text"            Single input question
  --questions-file <path>      Input file (.txt lines or .json string array)
  --images <a.png,b.jpg>       One or more image paths (OCR + question extraction)
  --max <N>                    Max questions to process
  --dry-run                    Run full pipeline without DB writes
  --help                       Show help

Examples:
  npm run faq:answer-and-stage -- --question "什么是Transformer中的自注意力？" --dry-run
  npm run faq:answer-and-stage -- --questions-file data/sample-questions.txt --max 5 --dry-run
  npm run faq:answer-and-stage -- --images data/samples/1.png,data/samples/2.jpg --dry-run
`);
}

function requireAIConfig(): { baseUrl: string; apiKey: string; model: string } {
  const baseUrl = process.env.AI_API_BASE_URL;
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;
  if (!baseUrl || !apiKey || !model) {
    throw new Error("Missing AI API config: AI_API_BASE_URL / AI_API_KEY / AI_MODEL");
  }
  return { baseUrl, apiKey, model };
}

async function callAIJSON(
  systemPrompt: string,
  userPrompt: string,
  temperature: number
): Promise<Record<string, unknown>> {
  const { baseUrl, apiKey, model } = requireAIConfig();
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
      temperature,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI API error (${response.status}): ${text}`);
  }

  const data = (await response.json()) as AIResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI returned empty response");
  return JSON.parse(content) as Record<string, unknown>;
}

async function generateDraftAnswer(question: string): Promise<string> {
  const systemPrompt = `你是 AI/ML 技术问答助手。给出一个可读、完整但简洁的中文 Markdown 草稿答案。
输出 JSON: { "answer": "..." }`;
  const parsed = await callAIJSON(systemPrompt, `问题: ${question}`, 0.3);
  const answer = typeof parsed.answer === "string" ? parsed.answer.trim() : "";
  if (!answer) throw new Error("Draft answer is empty");
  return answer;
}

function normalizeSource(input: Record<string, unknown>): GroundingSource | null {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const url = typeof input.url === "string" ? input.url.trim() : "";
  const rawType = typeof input.type === "string" ? input.type.toLowerCase() : "other";
  if (!title || !url) return null;

  let type: GroundingSource["type"] = "other";
  if (rawType === "paper") type = "paper";
  else if (rawType === "blog") type = "blog";

  return { title, url, type };
}

async function isReachableUrl(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const headRes = await fetch(url, { method: "HEAD", signal: controller.signal });
    if (headRes.ok) return true;
  } catch {
    // ignore and fallback to GET
  } finally {
    clearTimeout(timeout);
  }

  const controller2 = new AbortController();
  const timeout2 = setTimeout(() => controller2.abort(), 8000);
  try {
    const getRes = await fetch(url, { method: "GET", signal: controller2.signal });
    return getRes.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout2);
  }
}

async function retrieveEvidence(question: string, draftAnswer: string): Promise<GroundingSource[]> {
  const systemPrompt = `你是检索规划助手。为给定 AI/ML 问题返回候选引用来源，优先论文和知名专家博客。
返回 JSON: { "sources": [{ "type": "paper|blog|other", "title": "...", "url": "..." }] }
要求:
1) 至少给出 5 个来源
2) 优先 arXiv / 会议论文页
3) 博客优先专家作者内容
4) URL 必须是完整 http(s) 链接`;

  const parsed = await callAIJSON(
    systemPrompt,
    `问题: ${question}\n\n草稿答案:\n${draftAnswer}\n\n请返回候选 sources。`,
    0.2
  );
  const raw = Array.isArray(parsed.sources) ? parsed.sources : [];
  const normalized = raw
    .map((x) => (x && typeof x === "object" ? normalizeSource(x as Record<string, unknown>) : null))
    .filter((x): x is GroundingSource => Boolean(x));
  const ranked = rankSources(normalized);

  const validated: GroundingSource[] = [];
  for (const src of ranked) {
    if (await isReachableUrl(src.url)) {
      validated.push(src);
    }
    if (validated.length >= 5) break;
  }
  return validated;
}

function toReference(source: GroundingSource): Reference {
  if (source.type === "paper" || source.type === "blog") {
    return { type: source.type, title: source.title, url: source.url };
  }
  return { type: "other", title: source.title, url: source.url };
}

async function buildFinalAnswer(
  question: string,
  draftAnswer: string,
  sources: GroundingSource[],
  existingTags: string[]
): Promise<PipelineResult["final"]> {
  const systemPrompt = `你是 AI/ML FAQ 编辑器。请用证据列表校验并修订答案。
要求:
1) 生成最终中文答案 answer（Markdown）
2) 生成 answer_brief（<= 500 字）
3) 生成英文 answer_en 和 answer_brief_en
4) 生成 question_en
5) tags: 2-5 个中文技术标签，尽量复用: ${existingTags.join(", ")}
6) categories: 从以下分类选 1-2 个: ${CATEGORY_NAMES.join(", ")}
7) references: 基于证据输出 2-5 条，字段 type/title/url
8) verification_notes: 简述证据支持/冲突点

输出 JSON:
{
  "question_en": "...",
  "answer": "...",
  "answer_brief": "...",
  "answer_en": "...",
  "answer_brief_en": "...",
  "tags": ["..."],
  "categories": ["..."],
  "references": [{"type":"paper","title":"...","url":"..."}],
  "verification_notes": "..."
}`;

  const parsed = await callAIJSON(
    systemPrompt,
    `问题: ${question}\n\n草稿答案:\n${draftAnswer}\n\n证据列表:\n${JSON.stringify(sources, null, 2)}`,
    0.2
  );

  const refs = Array.isArray(parsed.references)
    ? parsed.references
        .map((x) => (x && typeof x === "object" ? normalizeSource(x as Record<string, unknown>) : null))
        .filter((x): x is GroundingSource => Boolean(x))
        .map(toReference)
    : [];

  return {
    question_en: typeof parsed.question_en === "string" ? parsed.question_en : "",
    answer: typeof parsed.answer === "string" ? parsed.answer : draftAnswer,
    answer_brief:
      typeof parsed.answer_brief === "string"
        ? parsed.answer_brief
        : (typeof parsed.answer === "string" ? parsed.answer : draftAnswer).slice(0, 500),
    answer_en: typeof parsed.answer_en === "string" ? parsed.answer_en : "",
    answer_brief_en: typeof parsed.answer_brief_en === "string" ? parsed.answer_brief_en : "",
    tags: Array.isArray(parsed.tags) ? parsed.tags.filter((x): x is string => typeof x === "string").slice(0, 5) : [],
    categories: Array.isArray(parsed.categories)
      ? parsed.categories.filter((x): x is string => typeof x === "string").slice(0, 2)
      : [],
    references: refs,
    verification_notes: typeof parsed.verification_notes === "string" ? parsed.verification_notes : "",
  };
}

async function stageToReview(
  question: string,
  draftAnswer: string,
  finalAnswer: PipelineResult["final"],
  dryRun: boolean
): Promise<number | null> {
  if (dryRun) return null;
  const item = await createFaqItem(question, draftAnswer);
  await updateFaqStatus(item.id, "review", {
    answer: finalAnswer.answer,
    answer_brief: finalAnswer.answer_brief,
    answer_en: finalAnswer.answer_en,
    answer_brief_en: finalAnswer.answer_brief_en,
    question_en: finalAnswer.question_en,
    tags: finalAnswer.tags,
    categories: finalAnswer.categories,
    references: finalAnswer.references,
  });
  return item.id;
}

async function collectQuestions(opts: Options): Promise<string[]> {
  const bucket: string[] = [];
  if (opts.question) bucket.push(opts.question);
  if (opts.questionsFile) bucket.push(...readQuestionsFile(opts.questionsFile));
  if (opts.images.length > 0) {
    const imageQs = await extractQuestionsFromImages(opts.images);
    bucket.push(...imageQs);
  }
  const normalized = normalizeQuestions(bucket);
  if (opts.max && opts.max > 0) return normalized.slice(0, opts.max);
  return normalized;
}

function ensureOutDir(): void {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

function writeArtifact(name: string, data: unknown): void {
  fs.writeFileSync(path.join(OUT_DIR, name), JSON.stringify(data, null, 2) + "\n", "utf-8");
}

function hasDbConnection(): boolean {
  return Boolean(
    process.env.POSTGRES_URL ||
      process.env.POSTGRES_PRISMA_URL ||
      process.env.POSTGRES_URL_NON_POOLING
  );
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    return;
  }
  if (!opts.question && !opts.questionsFile && opts.images.length === 0) {
    printHelp();
    throw new Error("No input provided: use --question, --questions-file, or --images");
  }

  ensureOutDir();
  const existingTags: string[] = [];
  if (opts.dryRun) {
    if (hasDbConnection()) {
      await initDB();
      existingTags.push(...new Set((await getPublishedFaqItems()).flatMap((item) => item.tags)));
    } else {
      console.log("No DB connection found; dry-run will use empty existingTags.");
    }
  } else {
    if (!hasDbConnection()) {
      throw new Error(
        "DB connection is required for write mode. Set POSTGRES_URL (or related Vercel Postgres env vars)."
      );
    }
    await initDB();
    existingTags.push(...new Set((await getPublishedFaqItems()).flatMap((item) => item.tags)));
  }
  const questions = await collectQuestions(opts);
  if (questions.length === 0) {
    console.log("No questions collected from input.");
    return;
  }

  console.log(`Processing ${questions.length} question(s)${opts.dryRun ? " [dry-run]" : ""}...`);

  const results: PipelineResult[] = [];
  const errors: Array<{ question: string; error: string }> = [];

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    console.log(`[${i + 1}/${questions.length}] ${question}`);
    try {
      const draftAnswer = await generateDraftAnswer(question);
      const sources = await retrieveEvidence(question, draftAnswer);
      const evidence = computeEvidenceFlags(sources);
      const final = await buildFinalAnswer(question, draftAnswer, sources, existingTags);

      if (evidence.needsManualVerification) {
        final.answer += `\n\n---\n\n> 验证备注: 证据不足（source_count=${evidence.sourceCount}, has_paper=${evidence.hasPaper}），请人工复核。`;
        final.verification_notes = [
          final.verification_notes,
          `needs_manual_verification=true (source_count=${evidence.sourceCount}, has_paper=${evidence.hasPaper})`,
        ]
          .filter(Boolean)
          .join(" | ");
      }

      const stagedFaqId = await stageToReview(question, draftAnswer, final, opts.dryRun);
      const output: PipelineResult = {
        question,
        draftAnswer,
        sources,
        final,
        evidence,
        stagedFaqId,
      };
      results.push(output);

      const fileName = `${Date.now()}-${String(i + 1).padStart(3, "0")}.json`;
      writeArtifact(fileName, output);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ question, error: msg });
      console.error(`  -> failed: ${msg}`);
    }
  }

  if (errors.length > 0) {
    writeArtifact("_errors.json", errors);
  }

  console.log(`Done. Success=${results.length}, Failed=${errors.length}`);
  console.log(`Artifacts: ${OUT_DIR}`);
}

main().catch((err) => {
  console.error("answer-and-stage failed:", err);
  process.exit(1);
});
