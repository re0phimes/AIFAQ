import { sql } from "@vercel/postgres";
import { initDB } from "../lib/db";
import { analyzeFAQ } from "../lib/ai";
import { extractCandidateImages } from "../lib/image-extractor";
import type { Reference } from "../src/types/faq";

const CONCURRENCY = parseInt(process.argv[2] || "10", 10);
const LIMIT = parseInt(process.argv[3] || "0", 10); // 0 = no limit

let processed = 0;
let skipped = 0;
let failed = 0;
let total = 0;

async function processItem(row: Record<string, unknown>): Promise<void> {
  const id = row.id as number;
  const question = row.question as string;
  const answerRaw = row.answer_raw as string;

  console.log(`[${processed + skipped + failed + 1}/${total}] #${id}: ${question.slice(0, 50)}...`);

  try {
    const refs: Reference[] = typeof row.references === "string"
      ? JSON.parse(row.references as string)
      : ((row.references as Reference[]) ?? []);

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
           "references", status
    FROM faq_items
    ORDER BY id ASC
  `;

  // Filter to items needing migration
  const pending = rows.filter((r) => !r.answer_brief || !r.answer_en);
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
