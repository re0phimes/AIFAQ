import * as fs from "fs";
import * as path from "path";
import { sql } from "@vercel/postgres";
import { initDB } from "../lib/db";
import type { FAQItem } from "../src/types/faq";

const FAQ_PATH = path.resolve(__dirname, "../data/faq.json");

async function ensureQuestionUnique(): Promise<void> {
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS faq_items_question_unique
    ON faq_items (question)
  `;
}

async function seedFaq(): Promise<void> {
  const raw = fs.readFileSync(FAQ_PATH, "utf-8");
  const items: FAQItem[] = JSON.parse(raw);

  console.log(`Found ${items.length} FAQ items in faq.json`);

  await initDB();
  await ensureQuestionUnique();

  let seeded = 0;
  let skipped = 0;

  for (const item of items) {
    const tagsLiteral = `{${item.tags.map((t) => `"${t}"`).join(",")}}`;
    const categoriesLiteral = `{${item.categories.map((c) => `"${c}"`).join(",")}}`;
    const refsJson = JSON.stringify(item.references);

    const result = await sql`
      INSERT INTO faq_items (
        question, answer_raw, answer, tags, categories,
        "references", status, date, upvote_count, downvote_count
      )
      VALUES (
        ${item.question},
        ${item.answer},
        ${item.answer},
        ${tagsLiteral}::text[],
        ${categoriesLiteral}::text[],
        ${refsJson}::jsonb,
        'ready',
        ${item.date},
        ${item.upvoteCount},
        ${item.downvoteCount}
      )
      ON CONFLICT (question) DO NOTHING
    `;

    if (result.rowCount && result.rowCount > 0) {
      seeded++;
    } else {
      skipped++;
    }
  }

  console.log(`Seeded ${seeded} items, skipped ${skipped} duplicates`);
}

seedFaq()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
