import { sql } from "@vercel/postgres";
import { initDB } from "../lib/db";

type Difficulty = "beginner" | "intermediate" | "advanced";

interface FaqRow {
  id: number;
  question: string;
  answer: string;
  tags: string[];
}

// ---------------------------------------------------------------------------
// AI API configuration
// ---------------------------------------------------------------------------

const AI_API_KEY = process.env.AI_API_KEY ?? "";
const AI_API_BASE = process.env.AI_API_BASE ?? "https://api.openai.com/v1";
const AI_MODEL = process.env.AI_MODEL ?? "gpt-4o-mini";

// ---------------------------------------------------------------------------
// Heuristic fallback (no API key)
// ---------------------------------------------------------------------------

function heuristicDifficulty(answer: string): Difficulty {
  const len = answer.length;
  if (len < 500) return "beginner";
  if (len <= 1500) return "intermediate";
  return "advanced";
}

// ---------------------------------------------------------------------------
// AI-based classification
// ---------------------------------------------------------------------------

async function classifyWithAI(row: FaqRow): Promise<Difficulty> {
  const answerSnippet = row.answer.slice(0, 500);
  const tagsStr = row.tags.join(", ");

  const prompt = [
    "You are a difficulty classifier for AI/ML FAQ items.",
    "Based on the question, answer excerpt, and tags below, classify the FAQ",
    'into exactly one of: "beginner", "intermediate", "advanced".',
    "Reply with ONLY the single word (no quotes, no explanation).",
    "",
    `Question: ${row.question}`,
    `Tags: ${tagsStr}`,
    `Answer (first 500 chars): ${answerSnippet}`,
  ].join("\n");

  const url = `${AI_API_BASE.replace(/\/+$/, "")}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 16,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AI API error ${res.status}: ${body}`);
  }

  const json = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  const raw = json.choices[0]?.message?.content?.trim().toLowerCase() ?? "";

  const VALID: Difficulty[] = ["beginner", "intermediate", "advanced"];
  const matched = VALID.find((v) => raw.includes(v));
  if (!matched) {
    console.warn(`  [warn] Unexpected AI response "${raw}", falling back to heuristic`);
    return heuristicDifficulty(row.answer);
  }
  return matched;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  await initDB();

  const { rows } = await sql<FaqRow>`
    SELECT id, question, answer, tags
    FROM faq_items
    WHERE difficulty IS NULL
  `;

  if (rows.length === 0) {
    console.log("No FAQ items need difficulty analysis.");
    return;
  }

  console.log(`Found ${rows.length} FAQ items without difficulty.`);

  const useAI = AI_API_KEY.length > 0;
  if (useAI) {
    console.log(`Using AI API (model: ${AI_MODEL}, base: ${AI_API_BASE})`);
  } else {
    console.log("AI_API_KEY not set, using heuristic fallback.");
  }

  const stats: Record<Difficulty, number> = {
    beginner: 0,
    intermediate: 0,
    advanced: 0,
  };

  for (const row of rows) {
    let difficulty: Difficulty;
    try {
      difficulty = useAI ? await classifyWithAI(row) : heuristicDifficulty(row.answer);
    } catch (err) {
      console.error(`  [error] Failed to classify FAQ #${row.id}: ${err}`);
      console.log(`  -> Falling back to heuristic for FAQ #${row.id}`);
      difficulty = heuristicDifficulty(row.answer);
    }

    await sql`UPDATE faq_items SET difficulty = ${difficulty} WHERE id = ${row.id}`;
    stats[difficulty]++;
    console.log(`  #${row.id} -> ${difficulty}`);
  }

  console.log("\n--- Statistics ---");
  console.log(`Total analyzed: ${rows.length}`);
  console.log(`  beginner:     ${stats.beginner}`);
  console.log(`  intermediate: ${stats.intermediate}`);
  console.log(`  advanced:     ${stats.advanced}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Analyze difficulty failed:", err);
    process.exit(1);
  });
