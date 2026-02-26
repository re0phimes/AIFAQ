import { sql } from "@vercel/postgres";
import type { Reference } from "@/src/types/faq";

export interface DBFaqItem {
  id: number;
  question: string;
  answer_raw: string;
  answer: string | null;
  tags: string[];
  categories: string[];
  references: Reference[];
  upvote_count: number;
  outdated_count: number;
  inaccurate_count: number;
  status: "pending" | "processing" | "ready" | "failed";
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
}

export async function initDB(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS faq_items (
      id            SERIAL PRIMARY KEY,
      question      TEXT NOT NULL,
      answer_raw    TEXT NOT NULL,
      answer        TEXT,
      tags          TEXT[] DEFAULT '{}',
      "references"  JSONB DEFAULT '[]',
      status        VARCHAR(20) DEFAULT 'pending',
      error_message TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`ALTER TABLE faq_items ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT '{}'`;
  await sql`ALTER TABLE faq_items ADD COLUMN IF NOT EXISTS upvote_count INTEGER DEFAULT 0`;
  await sql`ALTER TABLE faq_items ADD COLUMN IF NOT EXISTS outdated_count INTEGER DEFAULT 0`;
  await sql`ALTER TABLE faq_items ADD COLUMN IF NOT EXISTS inaccurate_count INTEGER DEFAULT 0`;

  await sql`
    CREATE TABLE IF NOT EXISTS faq_votes (
      id          SERIAL PRIMARY KEY,
      faq_id      INTEGER NOT NULL,
      vote_type   VARCHAR(20) NOT NULL,
      fingerprint VARCHAR(64) NOT NULL,
      ip_address  VARCHAR(45),
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(faq_id, vote_type, fingerprint)
    )
  `;

  await sql`ALTER TABLE faq_votes ADD COLUMN IF NOT EXISTS reason VARCHAR(50)`;
  await sql`ALTER TABLE faq_votes ADD COLUMN IF NOT EXISTS detail TEXT`;
}

export async function createFaqItem(
  question: string,
  answerRaw: string
): Promise<DBFaqItem> {
  const result = await sql`
    INSERT INTO faq_items (question, answer_raw)
    VALUES (${question}, ${answerRaw})
    RETURNING *
  `;
  return rowToFaqItem(result.rows[0]);
}

export async function updateFaqStatus(
  id: number,
  status: string,
  data?: { answer?: string; tags?: string[]; categories?: string[]; references?: Reference[]; error_message?: string }
): Promise<void> {
  if (data?.answer !== undefined) {
    const tagsLiteral = `{${(data.tags ?? []).map((t) => `"${t}"`).join(",")}}`;
    const categoriesLiteral = `{${(data.categories ?? []).map((c) => `"${c}"`).join(",")}}`;
    await sql`
      UPDATE faq_items
      SET status = ${status},
          answer = ${data.answer},
          tags = ${tagsLiteral}::text[],
          categories = ${categoriesLiteral}::text[],
          "references" = ${JSON.stringify(data.references ?? [])}::jsonb,
          error_message = NULL,
          updated_at = NOW()
      WHERE id = ${id}
    `;
  } else {
    await sql`
      UPDATE faq_items
      SET status = ${status},
          error_message = ${data?.error_message ?? null},
          updated_at = NOW()
      WHERE id = ${id}
    `;
  }
}

export async function getAllFaqItems(): Promise<DBFaqItem[]> {
  const result = await sql`
    SELECT * FROM faq_items ORDER BY created_at DESC
  `;
  return result.rows.map(rowToFaqItem);
}

export async function getReadyFaqItems(): Promise<DBFaqItem[]> {
  const result = await sql`
    SELECT * FROM faq_items WHERE status = 'ready' ORDER BY created_at DESC
  `;
  return result.rows.map(rowToFaqItem);
}

export async function getFaqItemById(id: number): Promise<DBFaqItem | null> {
  const result = await sql`
    SELECT * FROM faq_items WHERE id = ${id}
  `;
  if (result.rows.length === 0) return null;
  return rowToFaqItem(result.rows[0]);
}

function rowToFaqItem(row: Record<string, unknown>): DBFaqItem {
  return {
    id: row.id as number,
    question: row.question as string,
    answer_raw: row.answer_raw as string,
    answer: row.answer as string | null,
    tags: (row.tags as string[]) ?? [],
    categories: (row.categories as string[]) ?? [],
    references: (typeof row.references === "string"
      ? JSON.parse(row.references)
      : row.references) as Reference[],
    upvote_count: (row.upvote_count as number) ?? 0,
    outdated_count: (row.outdated_count as number) ?? 0,
    inaccurate_count: (row.inaccurate_count as number) ?? 0,
    status: row.status as DBFaqItem["status"],
    error_message: row.error_message as string | null,
    created_at: new Date(row.created_at as string),
    updated_at: new Date(row.updated_at as string),
  };
}

const VALID_VOTE_COLUMNS: Record<string, string> = {
  upvote: "upvote_count",
  outdated: "outdated_count",
  inaccurate: "inaccurate_count",
};

export async function castVote(
  faqId: number,
  voteType: string,
  fingerprint: string,
  ipAddress: string | null,
  reason?: string,
  detail?: string
): Promise<boolean> {
  const result = await sql`
    INSERT INTO faq_votes (faq_id, vote_type, fingerprint, ip_address, reason, detail)
    VALUES (${faqId}, ${voteType}, ${fingerprint}, ${ipAddress}, ${reason ?? null}, ${detail ?? null})
    ON CONFLICT (faq_id, vote_type, fingerprint) DO NOTHING
    RETURNING id
  `;
  if (result.rows.length === 0) return false;

  // Update aggregate count - column name is validated against a whitelist
  const column = VALID_VOTE_COLUMNS[voteType];
  if (!column) throw new Error(`Invalid vote type: ${voteType}`);
  await sql.query(
    `UPDATE faq_items SET ${column} = ${column} + 1 WHERE id = $1`,
    [faqId]
  );
  return true;
}

export async function getVoteCounts(
  faqIds: number[]
): Promise<Map<number, { upvote: number; outdated: number; inaccurate: number }>> {
  if (faqIds.length === 0) return new Map();
  const result = await sql.query(
    `SELECT faq_id, vote_type, COUNT(*)::int as count
     FROM faq_votes
     WHERE faq_id = ANY($1)
     GROUP BY faq_id, vote_type`,
    [faqIds]
  );
  const map = new Map<number, { upvote: number; outdated: number; inaccurate: number }>();
  for (const row of result.rows) {
    const faqId = row.faq_id as number;
    if (!map.has(faqId)) map.set(faqId, { upvote: 0, outdated: 0, inaccurate: 0 });
    const entry = map.get(faqId)!;
    const type = row.vote_type as string;
    if (type === "upvote") entry.upvote = row.count as number;
    else if (type === "outdated") entry.outdated = row.count as number;
    else if (type === "inaccurate") entry.inaccurate = row.count as number;
  }
  return map;
}
