import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SYNC_DIR = path.resolve(__dirname, "../../data/faq-sync");
const API_BASE = process.env.AI_API_BASE_URL ?? "https://api.openai.com/v1";
const API_KEY = process.env.AI_API_KEY!;
const MODEL = process.env.AI_MODEL ?? "gpt-4o";

const JUDGE_THRESHOLD = 3.5;
const AUTO_FAIL_THRESHOLD = 2; // scenario_completeness or formula_rigor <= 2 → auto fail

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuestionScores {
  naturalness: number;
  context_relevance: number;
  knowledge_clarity: number;
  phrasing: number;
  scenario_completeness: number;
}

interface AnswerScores {
  accuracy: number;
  completeness: number;
  mastery: number;
  independence: number;
  formula_rigor: number;
}

interface JudgeResponse {
  question_scores: QuestionScores;
  answer_scores: AnswerScores;
  question_suggestion: string;
  answer_suggestion: string;
}

interface EvalResult {
  id: number;
  file: string;
  question_scores: QuestionScores;
  answer_scores: AnswerScores;
  average: number;
  verdict: "pass" | "fail";
  fail_reason: string | null;
  question_suggestion: string;
  answer_suggestion: string;
}

// ---------------------------------------------------------------------------
// System prompt — based on faq-judge skill scoring dimensions
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `你是一个 QA 质量评审专家。评估给定问答对的质量。

评分维度 (每项 1-5 分):

问题评分:
- naturalness: 是否像真实用户会问的，不是生硬拼凑
- context_relevance: 脱离原文后问题是否还有意义
- knowledge_clarity: 是否清楚在考什么知识
- phrasing: 结合场景的问法是否恰当
- scenario_completeness: 问题是否包含足够的场景信息（模型名、参数量、硬件等），让读者无需猜测背景

答案评分:
- accuracy: 答案是否正确
- completeness: 是否充分回答了问题
- mastery: 读者看完能否真正理解这个知识点
- independence: 不依赖原文上下文也能理解
- formula_rigor: 涉及公式/数值时，推导是否严谨、单位是否正确；无公式时给 4 分

对这个 QA:
1. 给出各维度分数 (整数 1-5)
2. 给出 question_suggestion (问题改进建议)
3. 给出 answer_suggestion (答案改进建议)

只输出 JSON:
{
  "question_scores": { "naturalness": N, "context_relevance": N, "knowledge_clarity": N, "phrasing": N, "scenario_completeness": N },
  "answer_scores": { "accuracy": N, "completeness": N, "mastery": N, "independence": N, "formula_rigor": N },
  "question_suggestion": "...",
  "answer_suggestion": "..."
}`;

// ---------------------------------------------------------------------------
// AI API call
// ---------------------------------------------------------------------------

async function callAI(question: string, answer: string): Promise<JudgeResponse> {
  const userPrompt = `问题: ${question}\n\n答案: ${answer}`;

  const response = await fetch(`${API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
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

  return JSON.parse(content) as JudgeResponse;
}

// ---------------------------------------------------------------------------
// Verdict logic
// ---------------------------------------------------------------------------

function computeVerdict(
  qs: QuestionScores,
  as_: AnswerScores
): { average: number; verdict: "pass" | "fail"; fail_reason: string | null } {
  const allScores = [
    qs.naturalness, qs.context_relevance, qs.knowledge_clarity, qs.phrasing, qs.scenario_completeness,
    as_.accuracy, as_.completeness, as_.mastery, as_.independence, as_.formula_rigor,
  ];
  const average = Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 100) / 100;

  // Auto-fail checks
  if (qs.scenario_completeness <= AUTO_FAIL_THRESHOLD) {
    return { average, verdict: "fail", fail_reason: `scenario_completeness=${qs.scenario_completeness} (<=2 auto-fail)` };
  }
  if (as_.formula_rigor <= AUTO_FAIL_THRESHOLD) {
    return { average, verdict: "fail", fail_reason: `formula_rigor=${as_.formula_rigor} (<=2 auto-fail)` };
  }

  if (average >= JUDGE_THRESHOLD) {
    return { average, verdict: "pass", fail_reason: null };
  }
  return { average, verdict: "fail", fail_reason: `average=${average} (<${JUDGE_THRESHOLD})` };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (!API_KEY) {
    console.error("Error: AI_API_KEY is not set. Check .env.local");
    process.exit(1);
  }

  if (!fs.existsSync(SYNC_DIR)) {
    console.error(`Error: ${SYNC_DIR} does not exist. Run "npm run faq:pull" first.`);
    process.exit(1);
  }

  const files = fs.readdirSync(SYNC_DIR).filter(
    (f) => f.endsWith(".json") && !f.startsWith("_")
  );

  if (files.length === 0) {
    console.log("No FAQ files found in data/faq-sync/. Nothing to evaluate.");
    return;
  }

  console.log(`Found ${files.length} FAQ files to evaluate.\n`);

  const results: EvalResult[] = [];
  let passed = 0;
  let failed = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = path.join(SYNC_DIR, file);
    const qa = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const id = qa.id as number;

    console.log(`[${i + 1}/${files.length}] #${id}: ${(qa.question as string).slice(0, 60)}...`);

    try {
      const judgeRes = await callAI(qa.question, qa.answer);
      const { average, verdict, fail_reason } = computeVerdict(
        judgeRes.question_scores,
        judgeRes.answer_scores
      );

      const result: EvalResult = {
        id,
        file,
        question_scores: judgeRes.question_scores,
        answer_scores: judgeRes.answer_scores,
        average,
        verdict,
        fail_reason,
        question_suggestion: judgeRes.question_suggestion,
        answer_suggestion: judgeRes.answer_suggestion,
      };

      results.push(result);

      if (verdict === "pass") {
        passed++;
        console.log(`  -> PASS (avg=${average})`);
      } else {
        failed++;
        console.log(`  -> FAIL (${fail_reason})`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  -> ERROR: ${msg}`);
      results.push({
        id,
        file,
        question_scores: { naturalness: 0, context_relevance: 0, knowledge_clarity: 0, phrasing: 0, scenario_completeness: 0 },
        answer_scores: { accuracy: 0, completeness: 0, mastery: 0, independence: 0, formula_rigor: 0 },
        average: 0,
        verdict: "fail",
        fail_reason: `API error: ${msg}`,
        question_suggestion: "",
        answer_suggestion: "",
      });
      failed++;
    }
  }

  // Write report
  const report = {
    evaluated_at: new Date().toISOString(),
    model: MODEL,
    threshold: JUDGE_THRESHOLD,
    auto_fail_threshold: AUTO_FAIL_THRESHOLD,
    total: results.length,
    passed,
    failed,
    results,
  };

  const reportPath = path.join(SYNC_DIR, "_report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // Console summary
  console.log(`\n${"=".repeat(50)}`);
  console.log(`Evaluation complete: ${passed} passed, ${failed} failed (total: ${results.length})`);
  console.log(`Report: data/faq-sync/_report.json`);

  if (failed > 0) {
    console.log(`\nFailed items:`);
    for (const r of results.filter((r) => r.verdict === "fail")) {
      console.log(`  #${r.id} (${r.file}): ${r.fail_reason}`);
    }
  }
}

main().catch((err) => {
  console.error("Evaluate failed:", err);
  process.exit(1);
});
