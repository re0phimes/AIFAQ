import { sql } from "@vercel/postgres";
import { initDB } from "../../lib/db";
import * as fs from "fs";
import * as path from "path";

const SYNC_DIR = path.resolve(__dirname, "../../data/faq-sync");

interface PullOptions {
  all: boolean;
  flagged: boolean;
  ids: number[];
  status: string | null;
}

function parseArgs(): PullOptions | null {
  const args = process.argv.slice(2);
  if (args.length === 0) return null;

  const opts: PullOptions = { all: false, flagged: false, ids: [], status: null };

  for (const arg of args) {
    if (arg === "--all") {
      opts.all = true;
    } else if (arg === "--flagged") {
      opts.flagged = true;
    } else if (arg.startsWith("--ids=") || arg.startsWith("--ids ")) {
      const val = arg.startsWith("--ids=") ? arg.slice(6) : args[args.indexOf(arg) + 1];
      opts.ids = val.split(",").map(Number).filter((n) => !isNaN(n));
    } else if (arg.startsWith("--status=") || arg.startsWith("--status ")) {
      opts.status = arg.startsWith("--status=") ? arg.slice(9) : args[args.indexOf(arg) + 1];
    }
  }

  // Also handle --ids 42,108 (space-separated)
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--ids" && args[i + 1]) {
      opts.ids = args[i + 1].split(",").map(Number).filter((n) => !isNaN(n));
    }
    if (args[i] === "--status" && args[i + 1]) {
      opts.status = args[i + 1];
    }
  }

  const hasFilter = opts.all || opts.flagged || opts.ids.length > 0 || opts.status;
  return hasFilter ? opts : null;
}

function printHelp(): void {
  console.log(`Usage: faq:pull [options]

Options:
  --all              Export all published FAQ items
  --flagged          Only items where weighted downvotes > weighted upvotes
  --ids=42,108       Export specific IDs (comma-separated)
  --status=review    Filter by status (review|published|pending)

Examples:
  npx tsx -r ./scripts/env-loader.js tools/faq-sync/pull.ts --all
  npx tsx -r ./scripts/env-loader.js tools/faq-sync/pull.ts --flagged
  npx tsx -r ./scripts/env-loader.js tools/faq-sync/pull.ts --ids=42,108
  npx tsx -r ./scripts/env-loader.js tools/faq-sync/pull.ts --status=review`);
}

interface PulledItem {
  id: number;
  question: string;
  question_en: string | null;
  answer: string | null;
  answer_brief: string | null;
  answer_en: string | null;
  answer_brief_en: string | null;
  tags: string[];
  categories: string[];
  references: unknown[];
  images: unknown[];
  difficulty: string | null;
  status: string;
  current_version: number;
  votes_summary: { up: number; down: number };
  downvote_reasons: Record<string, number>;
  _pulled_at: string;
}

async function queryItems(opts: PullOptions): Promise<PulledItem[]> {
  let whereClause = "";
  let havingClause = "";

  if (opts.ids.length > 0) {
    whereClause = `WHERE f.id = ANY(ARRAY[${opts.ids.join(",")}])`;
  } else if (opts.status) {
    whereClause = `WHERE f.status = '${opts.status}'`;
  } else if (opts.all) {
    whereClause = `WHERE f.status = 'published'`;
  }
  // --flagged uses HAVING, no WHERE filter on status (queries all)

  if (opts.flagged) {
    havingClause = `HAVING SUM(CASE WHEN v.vote_type='downvote' THEN COALESCE(v.weight,1) ELSE 0 END) >
       SUM(CASE WHEN v.vote_type='upvote' THEN COALESCE(v.weight,1) ELSE 0 END)`;
  }

  const query = `
    SELECT
      f.id, f.question, f.question_en,
      f.answer, f.answer_brief, f.answer_en, f.answer_brief_en,
      f.tags, f.categories, f.references, f.images,
      f.difficulty, f.status, f.updated_at,
      COALESCE(SUM(CASE WHEN v.vote_type='upvote' THEN COALESCE(v.weight,1) ELSE 0 END), 0)::int AS up_votes,
      COALESCE(SUM(CASE WHEN v.vote_type='downvote' THEN COALESCE(v.weight,1) ELSE 0 END), 0)::int AS down_votes
    FROM faq_items f
    LEFT JOIN faq_votes v ON v.faq_id = f.id
    ${whereClause}
    GROUP BY f.id
    ${havingClause}
    ORDER BY f.id ASC
  `;

  const { rows } = await sql.query(query);

  // Fetch downvote reasons in bulk for all pulled IDs
  const pulledIds = rows.map((r) => r.id as number);
  const reasonsMap = await queryDownvoteReasons(pulledIds);

  const now = new Date().toISOString();

  return rows.map((r) => ({
    id: r.id as number,
    question: r.question as string,
    question_en: (r.question_en as string | null) ?? null,
    answer: (r.answer as string | null) ?? null,
    answer_brief: (r.answer_brief as string | null) ?? null,
    answer_en: (r.answer_en as string | null) ?? null,
    answer_brief_en: (r.answer_brief_en as string | null) ?? null,
    tags: (r.tags as string[]) ?? [],
    categories: (r.categories as string[]) ?? [],
    references: parseJsonField(r.references) as unknown[],
    images: parseJsonField(r.images) as unknown[],
    difficulty: (r.difficulty as string | null) ?? null,
    status: r.status as string,
    current_version: 1,
    votes_summary: {
      up: r.up_votes as number,
      down: r.down_votes as number,
    },
    downvote_reasons: reasonsMap.get(r.id as number) ?? {},
    _pulled_at: now,
  }));
}

async function queryDownvoteReasons(
  ids: number[]
): Promise<Map<number, Record<string, number>>> {
  const map = new Map<number, Record<string, number>>();
  if (ids.length === 0) return map;

  const { rows } = await sql.query(
    `SELECT faq_id, reason, COUNT(*)::int AS cnt
     FROM faq_votes
     WHERE faq_id = ANY($1)
       AND vote_type = 'downvote'
       AND reason IS NOT NULL
     GROUP BY faq_id, reason`,
    [ids]
  );

  for (const r of rows) {
    const faqId = r.faq_id as number;
    if (!map.has(faqId)) map.set(faqId, {});
    map.get(faqId)![r.reason as string] = r.cnt as number;
  }
  return map;
}

function parseJsonField(val: unknown): unknown {
  if (typeof val === "string") {
    try { return JSON.parse(val); } catch { return []; }
  }
  return val ?? [];
}

async function main(): Promise<void> {
  const opts = parseArgs();
  if (!opts) {
    printHelp();
    process.exit(0);
  }

  await initDB();

  const items = await queryItems(opts);

  if (items.length === 0) {
    console.log("No items matched the given filters.");
    process.exit(0);
  }

  // Ensure output directory exists
  if (!fs.existsSync(SYNC_DIR)) {
    fs.mkdirSync(SYNC_DIR, { recursive: true });
  }

  for (const item of items) {
    const filePath = path.join(SYNC_DIR, `${item.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(item, null, 2) + "\n", "utf-8");
  }

  console.log(`Pulled ${items.length} item(s) to ${SYNC_DIR}/`);
  for (const item of items) {
    const flag = item.votes_summary.down > item.votes_summary.up ? " [flagged]" : "";
    console.log(`  ${item.id}.json — ${item.question.slice(0, 60)}${flag}`);
  }
}

main().catch((err) => {
  console.error("Pull failed:", err);
  process.exit(1);
});
