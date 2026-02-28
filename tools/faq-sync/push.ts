/**
 * push.ts — Sync local FAQ JSON files to DB with versioning.
 *
 * Reads data/faq-sync/*.json (excluding _-prefixed files),
 * compares each item's answer with the DB, and updates changed items
 * while archiving old versions via createVersion().
 *
 * Usage:
 *   npx tsx -r ./scripts/env-loader.js tools/faq-sync/push.ts [--dry-run]
 */

import * as fs from "fs";
import * as path from "path";
import { sql } from "@vercel/postgres";
import { getFaqItemById, createVersion, initDB } from "../../lib/db";

const DATA_DIR = path.resolve(__dirname, "../../data/faq-sync");
const DRY_RUN = process.argv.includes("--dry-run");

interface LocalFaqItem {
  id: number;
  question?: string;
  answer: string;
  answer_brief?: string | null;
  answer_en?: string | null;
  answer_brief_en?: string | null;
  tags?: string[];
  categories?: string[];
  _change_reason?: string;
  [key: string]: unknown;
}

async function push(): Promise<void> {
  await initDB();

  if (!fs.existsSync(DATA_DIR)) {
    console.error(`Data directory not found: ${DATA_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"));

  if (files.length === 0) {
    console.log("No JSON files found in data/faq-sync/.");
    return;
  }

  if (DRY_RUN) console.log("[DRY RUN] No changes will be written.\n");

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    let local: LocalFaqItem;
    try {
      local = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch (err) {
      console.error(`  Skipping ${file}: invalid JSON`);
      continue;
    }

    if (!local.id) {
      console.error(`  Skipping ${file}: missing id`);
      continue;
    }

    const dbItem = await getFaqItemById(local.id);
    if (!dbItem) {
      console.log(`  #${local.id} (${file}): not found in DB`);
      notFound++;
      continue;
    }

    // Compare answer field
    if (dbItem.answer === local.answer) {
      console.log(`  #${local.id} (${file}): unchanged, skipping`);
      skipped++;
      continue;
    }

    // Archive old version
    const oldVersion = dbItem.current_version ?? 1;
    const newVersion = oldVersion + 1;

    if (DRY_RUN) {
      console.log(`  #${local.id} (${file}): WOULD update v${oldVersion} -> v${newVersion}`);
      console.log(`    answer diff: ${(dbItem.answer ?? "").slice(0, 60)}... -> ${local.answer.slice(0, 60)}...`);
      updated++;
      continue;
    }

    // Create version record for the OLD answer
    await createVersion(local.id, oldVersion, {
      answer: dbItem.answer ?? "",
      answer_brief: dbItem.answer_brief,
      answer_en: dbItem.answer_en,
      answer_brief_en: dbItem.answer_brief_en,
      change_reason: local._change_reason,
    });

    // Build tags/categories array literals
    const tagsLiteral = `{${(local.tags ?? dbItem.tags ?? []).map((t) => `"${t}"`).join(",")}}`;
    const categoriesLiteral = `{${(local.categories ?? dbItem.categories ?? []).map((c) => `"${c}"`).join(",")}}`;

    // Update faq_items with new content
    await sql`
      UPDATE faq_items SET
        answer = ${local.answer},
        answer_brief = ${local.answer_brief ?? null},
        answer_en = ${local.answer_en ?? null},
        answer_brief_en = ${local.answer_brief_en ?? null},
        tags = ${tagsLiteral}::text[],
        categories = ${categoriesLiteral}::text[],
        current_version = ${newVersion},
        last_updated_at = NOW(),
        updated_at = NOW()
      WHERE id = ${local.id}
    `;

    console.log(`  #${local.id} (${file}): updated v${oldVersion} -> v${newVersion}`);
    updated++;
  }

  console.log(
    `\nDone${DRY_RUN ? " (dry run)" : ""}: ${updated} updated, ${skipped} skipped, ${notFound} not found`
  );
}

push().catch((err) => {
  console.error("Push failed:", err);
  process.exit(1);
});
