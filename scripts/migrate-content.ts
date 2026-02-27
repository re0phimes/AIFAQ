import { sql } from "@vercel/postgres";
import { initDB } from "../lib/db";
import { analyzeFAQ } from "../lib/ai";
import { extractCandidateImages } from "../lib/image-extractor";
import type { Reference } from "../src/types/faq";

const DELAY_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function migrate(): Promise<void> {
  await initDB();

  const { rows } = await sql`
    SELECT id, question, answer_raw, answer, answer_brief, answer_en,
           references, status
    FROM faq_items
    ORDER BY id ASC
  `;

  const total = rows.length;
  let processed = 0;
  let skipped = 0;
  let failed = 0;

  console.log(`Found ${total} items to check.`);

  for (const row of rows) {
    // Skip items that already have bilingual content
    if (row.answer_brief && row.answer_en) {
      skipped++;
      continue;
    }

    processed++;
    console.log(`[${processed + skipped}/${total}] Processing #${row.id}: ${row.question.slice(0, 60)}...`);

    try {
      // Parse references for image extraction
      const refs: Reference[] = typeof row.references === "string"
        ? JSON.parse(row.references)
        : (row.references ?? []);

      const candidateImages = refs.length > 0
        ? await extractCandidateImages(refs.map((r) => ({ type: r.type, url: r.url })))
        : [];

      // Get existing tags for consistency
      const { rows: tagRows } = await sql`
        SELECT DISTINCT unnest(tags) AS tag FROM faq_items WHERE status IN ('published', 'ready')
      `;
      const existingTags = tagRows.map((r) => r.tag as string);

      const result = await analyzeFAQ(row.question, row.answer_raw, existingTags, candidateImages);

      await sql`
        UPDATE faq_items SET
          answer = ${result.answer},
          answer_brief = ${result.answer_brief},
          answer_en = ${result.answer_en},
          answer_brief_en = ${result.answer_brief_en},
          question_en = ${result.question_en},
          images = ${JSON.stringify(result.images)}::jsonb,
          updated_at = NOW()
        WHERE id = ${row.id}
      `;

      console.log(`  -> Done.`);
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  -> FAILED: ${msg}`);
    }

    await sleep(DELAY_MS);
  }

  console.log(`\nMigration complete: ${processed} processed, ${skipped} skipped, ${failed} failed.`);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
