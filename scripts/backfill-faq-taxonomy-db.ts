import { sql } from "@vercel/postgres";
import { initDB } from "../lib/db";
import { normalizePrimaryCategoryKey } from "../lib/taxonomy";
import { classifyLegacyFaq, type MigrationSummary } from "./migrate-faq-taxonomy";
import type { FAQItem, Reference } from "../src/types/faq";

interface CliOptions {
  dryRun: boolean;
  ids: number[];
  status: string | null;
}

interface DbRow {
  id: number;
  question: string;
  answer_raw: string;
  answer: string | null;
  tags: string[] | null;
  categories: string[] | null;
  primary_category: string | null;
  secondary_category: string | null;
  patterns: string[] | null;
  topics: string[] | null;
  tool_stack: string[] | null;
  references: Reference[] | string | null;
  status: string;
}

function parseArgs(): CliOptions {
  const idsArg = process.argv.find((arg) => arg.startsWith("--ids="))?.slice("--ids=".length);
  const statusArg = process.argv.find((arg) => arg.startsWith("--status="))?.slice("--status=".length);

  return {
    dryRun: process.argv.includes("--dry-run"),
    ids: idsArg
      ? idsArg
          .split(",")
          .map((value) => Number(value.trim()))
          .filter((value) => Number.isInteger(value) && value > 0)
      : [],
    status: statusArg?.trim() ? statusArg.trim() : null,
  };
}

function parseReferences(value: DbRow["references"]): Reference[] {
  if (Array.isArray(value)) return value as Reference[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? (parsed as Reference[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function escapePgArrayValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function toTextArrayLiteral(values: string[]): string {
  return `{${values.map((value) => `"${escapePgArrayValue(value)}"`).join(",")}}`;
}

function toFaqItem(row: DbRow): FAQItem {
  return {
    id: row.id,
    question: row.question,
    questionEn: undefined,
    date: "",
    tags: row.tags ?? [],
    categories: row.categories ?? [],
    primaryCategory: normalizePrimaryCategoryKey(row.primary_category),
    secondaryCategory: normalizePrimaryCategoryKey(row.secondary_category),
    patterns: row.patterns ?? [],
    topics: row.topics ?? [],
    toolStack: row.tool_stack ?? [],
    references: parseReferences(row.references),
    answer: row.answer ?? row.answer_raw,
    upvoteCount: 0,
    downvoteCount: 0,
  };
}

function createSummary(total: number): MigrationSummary {
  return {
    total,
    changed: 0,
    mapped: 0,
    unmapped: 0,
    ambiguous: 0,
    primaryCategoryCounts: {},
    ambiguousRows: [],
  };
}

function printSummary(summary: MigrationSummary, dryRun: boolean): void {
  console.log(`FAQ DB taxonomy backfill${dryRun ? " dry-run" : ""}`);
  console.log(`- total: ${summary.total}`);
  console.log(`- changed: ${summary.changed}`);
  console.log(`- mapped: ${summary.mapped}`);
  console.log(`- unmapped: ${summary.unmapped}`);
  console.log(`- ambiguous: ${summary.ambiguous}`);

  const categories = Object.entries(summary.primaryCategoryCounts).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  );

  if (categories.length > 0) {
    console.log("- by primary category:");
    for (const [category, count] of categories) {
      console.log(`  ${category}: ${count}`);
    }
  }

  if (summary.ambiguousRows.length > 0) {
    console.log("- ambiguous rows:");
    for (const row of summary.ambiguousRows.slice(0, 20)) {
      const label = row.id ? `#${row.id}` : "(no id)";
      console.log(`  ${label} ${row.question}`);
    }
  }
}

async function loadRows(options: CliOptions): Promise<DbRow[]> {
  const clauses: string[] = [];
  const values: unknown[] = [];

  if (options.ids.length > 0) {
    values.push(options.ids);
    clauses.push(`id = ANY($${values.length})`);
  }

  if (options.status) {
    values.push(options.status);
    clauses.push(`status = $${values.length}`);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

  const query = `
    SELECT
      id,
      question,
      answer_raw,
      answer,
      tags,
      categories,
      primary_category,
      secondary_category,
      patterns,
      topics,
      tool_stack,
      "references",
      status
    FROM faq_items
    ${where}
    ORDER BY id ASC
  `;

  const result = values.length > 0 ? await sql.query(query, values) : await sql.query(query);
  return result.rows as DbRow[];
}

async function backfill(): Promise<void> {
  const options = parseArgs();
  await initDB();

  const rows = await loadRows(options);
  const summary = createSummary(rows.length);

  for (const row of rows) {
    const item = toFaqItem(row);
    const classified = classifyLegacyFaq(item);

    const changed =
      item.primaryCategory !== classified.primary_category ||
      item.secondaryCategory !== classified.secondary_category ||
      JSON.stringify(item.patterns ?? []) !== JSON.stringify(classified.patterns) ||
      JSON.stringify(item.topics ?? []) !== JSON.stringify(classified.topics) ||
      JSON.stringify(item.toolStack ?? []) !== JSON.stringify(classified.tool_stack);

    if (changed) summary.changed += 1;

    if (classified.primary_category) {
      summary.mapped += 1;
      summary.primaryCategoryCounts[classified.primary_category] =
        (summary.primaryCategoryCounts[classified.primary_category] ?? 0) + 1;
    } else {
      summary.unmapped += 1;
    }

    if (classified.ambiguous) {
      summary.ambiguous += 1;
      summary.ambiguousRows.push({
        id: row.id,
        question: row.question,
        primary: classified.primary_category,
        secondary: classified.secondary_category,
      });
    }

    if (!changed || options.dryRun) continue;

    const patternsLiteral = toTextArrayLiteral(classified.patterns);
    const topicsLiteral = toTextArrayLiteral(classified.topics);
    const toolStackLiteral = toTextArrayLiteral(classified.tool_stack);

    await sql`
      UPDATE faq_items
      SET
        primary_category = ${classified.primary_category},
        secondary_category = ${classified.secondary_category},
        patterns = ${patternsLiteral}::text[],
        topics = ${topicsLiteral}::text[],
        tool_stack = ${toolStackLiteral}::text[],
        updated_at = NOW()
      WHERE id = ${row.id}
    `;
  }

  printSummary(summary, options.dryRun);
}

backfill().catch((error) => {
  console.error("FAQ DB taxonomy backfill failed:", error);
  process.exit(1);
});
