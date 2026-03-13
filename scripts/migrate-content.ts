import { sql } from "@vercel/postgres";
import { initDB } from "../lib/db";
import { analyzeFAQ } from "../lib/ai";
import { extractCandidateImages } from "../lib/image-extractor";
import { normalizePrimaryCategoryKey } from "../lib/taxonomy";
import type { Reference } from "../src/types/faq";
import { classifyLegacyFaq, type LegacyFaqInput } from "./migrate-faq-taxonomy";

const CONCURRENCY = parseInt(process.argv[2] || "10", 10);
const LIMIT = parseInt(process.argv[3] || "0", 10); // 0 = no limit
// --ids=9,19,27 to force re-process specific IDs (even if already done)
const idsArg = process.argv.find((a) => a.startsWith("--ids="));
const forceIds = idsArg
  ? new Set(idsArg.replace("--ids=", "").split(",").map(Number))
  : null;

let processed = 0;
let skipped = 0;
let failed = 0;
let total = 0;

function escapePgArrayValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function toTextArrayLiteral(values: string[]): string {
  return `{${values.map((value) => `"${escapePgArrayValue(value)}"`).join(",")}}`;
}

async function processItem(row: Record<string, unknown>): Promise<void> {
  const id = row.id as number;
  const question = row.question as string;
  const answerRaw = row.answer_raw as string;
  const needsAnswerMigration = !row.answer_brief || !row.answer_en;

  console.log(`[${processed + skipped + failed + 1}/${total}] #${id}: ${question.slice(0, 50)}...`);

  try {
    const refs: Reference[] = typeof row.references === "string"
      ? JSON.parse(row.references as string)
      : ((row.references as Reference[]) ?? []);

    const taxonomy = classifyLegacyFaq({
      id,
      question,
      answer: answerRaw,
      tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
      categories: Array.isArray(row.categories) ? (row.categories as string[]) : [],
      references: refs,
      primaryCategory:
        typeof row.primary_category === "string"
          ? normalizePrimaryCategoryKey(row.primary_category)
          : null,
      secondaryCategory:
        typeof row.secondary_category === "string"
          ? normalizePrimaryCategoryKey(row.secondary_category)
          : null,
      patterns: Array.isArray(row.patterns) ? (row.patterns as string[]) : [],
      topics: Array.isArray(row.topics) ? (row.topics as string[]) : [],
      toolStack: Array.isArray(row.tool_stack) ? (row.tool_stack as string[]) : [],
    } satisfies LegacyFaqInput);

    const topicsLiteral = toTextArrayLiteral(taxonomy.topics);
    const toolStackLiteral = toTextArrayLiteral(taxonomy.tool_stack);

    if (!needsAnswerMigration) {
      await sql`
        UPDATE faq_items SET
          primary_category = ${taxonomy.primary_category},
          secondary_category = ${taxonomy.secondary_category},
          topics = ${topicsLiteral}::text[],
          tool_stack = ${toolStackLiteral}::text[],
          updated_at = NOW()
        WHERE id = ${id}
      `;

      processed++;
      console.log(`  #${id} -> Taxonomy backfilled. (${processed} done, ${failed} failed)`);
      return;
    }

    const candidateImages = refs.length > 0
      ? await extractCandidateImages(refs.map((r) => ({ type: r.type, url: r.url })))
      : [];

    const { rows: tagRows } = await sql`
      SELECT DISTINCT unnest(tags) AS tag FROM faq_items WHERE status IN ('published', 'ready')
    `;
    const existingTags = tagRows.map((r) => r.tag as string);

    const result = await analyzeFAQ(question, answerRaw, existingTags, candidateImages);

    await sql`
      UPDATE faq_items SET
        answer = ${result.answer},
        answer_brief = ${result.answer_brief},
        answer_en = ${result.answer_en},
        answer_brief_en = ${result.answer_brief_en},
        question_en = ${result.question_en},
        images = ${JSON.stringify(result.images)}::jsonb,
        primary_category = ${taxonomy.primary_category},
        secondary_category = ${taxonomy.secondary_category},
        topics = ${topicsLiteral}::text[],
        tool_stack = ${toolStackLiteral}::text[],
        updated_at = NOW()
      WHERE id = ${id}
    `;

    processed++;
    console.log(`  #${id} -> Done. (${processed} done, ${failed} failed)`);
  } catch (err) {
    failed++;
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  #${id} -> FAILED: ${msg}`);
  }
}

async function migrate(): Promise<void> {
  await initDB();

  const { rows } = await sql`
    SELECT id, question, answer_raw, answer, answer_brief, answer_en,
           tags, categories, primary_category, secondary_category, patterns, topics, tool_stack,
           "references", status
    FROM faq_items
    ORDER BY id ASC
  `;

  // Filter to items needing migration
  const pending = forceIds
    ? rows.filter((r) => forceIds.has(r.id as number))
    : rows.filter(
      (r) =>
        !r.answer_brief ||
        !r.answer_en ||
        !r.primary_category ||
        !Array.isArray(r.topics) ||
        !Array.isArray(r.tool_stack)
    );
  skipped = rows.length - pending.length;
  const toProcess = LIMIT > 0 ? pending.slice(0, LIMIT) : pending;
  total = rows.length;

  console.log(`Found ${rows.length} items: ${skipped} already done, ${toProcess.length} to process (concurrency: ${CONCURRENCY})`);

  // Process in batches of CONCURRENCY
  for (let i = 0; i < toProcess.length; i += CONCURRENCY) {
    const batch = toProcess.slice(i, i + CONCURRENCY);
    console.log(`\n--- Batch ${Math.floor(i / CONCURRENCY) + 1}: items ${i + 1}-${i + batch.length} ---`);
    await Promise.all(batch.map(processItem));
  }

  console.log(`\nMigration complete: ${processed} processed, ${skipped} skipped, ${failed} failed.`);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
