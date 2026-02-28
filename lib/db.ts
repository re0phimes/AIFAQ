import { sql } from "@vercel/postgres";
import type { Reference, FAQImage } from "@/src/types/faq";

let schemaReady = false;

/** Ensure DB schema is up-to-date. Runs once per cold start. */
async function ensureSchema(): Promise<void> {
  if (schemaReady) return;
  await initDB();
  schemaReady = true;
}

export interface DBFaqItem {
  id: number;
  question: string;
  question_en: string | null;
  answer_raw: string;
  answer: string | null;
  answer_brief: string | null;
  answer_en: string | null;
  answer_brief_en: string | null;
  tags: string[];
  categories: string[];
  references: Reference[];
  images: FAQImage[];
  upvote_count: number;
  downvote_count: number;
  date: string;
  difficulty: "beginner" | "intermediate" | "advanced" | null;
  status: "pending" | "processing" | "review" | "published" | "rejected" | "ready" | "failed";
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
  reviewed_at: Date | null;
  reviewed_by: string | null;
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
  await sql`ALTER TABLE faq_items ADD COLUMN IF NOT EXISTS downvote_count INTEGER DEFAULT 0`;
  await sql`ALTER TABLE faq_items ADD COLUMN IF NOT EXISTS date VARCHAR(10) DEFAULT ''`;
  await sql`ALTER TABLE faq_items ADD COLUMN IF NOT EXISTS difficulty VARCHAR(20)`;

  // Bilingual + image columns
  await sql`ALTER TABLE faq_items ADD COLUMN IF NOT EXISTS answer_brief TEXT`;
  await sql`ALTER TABLE faq_items ADD COLUMN IF NOT EXISTS answer_en TEXT`;
  await sql`ALTER TABLE faq_items ADD COLUMN IF NOT EXISTS answer_brief_en TEXT`;
  await sql`ALTER TABLE faq_items ADD COLUMN IF NOT EXISTS question_en TEXT`;
  await sql`ALTER TABLE faq_items ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'`;

  // Review tracking columns
  await sql`ALTER TABLE faq_items ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ`;
  await sql`ALTER TABLE faq_items ADD COLUMN IF NOT EXISTS reviewed_by TEXT`;

  // Migrate legacy 'ready' status to 'published'
  await sql`UPDATE faq_items SET status = 'published' WHERE status = 'ready'`;

  await sql`
    UPDATE faq_items
    SET downvote_count = COALESCE(outdated_count, 0) + COALESCE(inaccurate_count, 0)
    WHERE downvote_count = 0
      AND (COALESCE(outdated_count, 0) + COALESCE(inaccurate_count, 0)) > 0
  `;

  await sql`
    DELETE FROM faq_votes
    WHERE vote_type IN ('outdated', 'inaccurate')
      AND (faq_id, fingerprint) IN (
        SELECT faq_id, fingerprint FROM faq_votes WHERE vote_type = 'upvote'
      )
  `;
  await sql`
    DELETE FROM faq_votes a
    USING faq_votes b
    WHERE a.vote_type IN ('outdated', 'inaccurate')
      AND b.vote_type IN ('outdated', 'inaccurate')
      AND a.faq_id = b.faq_id
      AND a.fingerprint = b.fingerprint
      AND a.id < b.id
  `;
  await sql`UPDATE faq_votes SET vote_type = 'downvote' WHERE vote_type IN ('outdated', 'inaccurate')`;

  await sql`ALTER TABLE faq_votes DROP CONSTRAINT IF EXISTS faq_votes_faq_id_vote_type_fingerprint_key`;
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'faq_votes_faq_id_fingerprint_key'
      ) THEN
        ALTER TABLE faq_votes ADD CONSTRAINT faq_votes_faq_id_fingerprint_key UNIQUE (faq_id, fingerprint);
      END IF;
    END $$
  `;

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
  await ensureSchema();
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
  data?: {
    answer?: string;
    tags?: string[];
    categories?: string[];
    references?: Reference[];
    error_message?: string;
    answer_brief?: string;
    answer_en?: string;
    answer_brief_en?: string;
    question_en?: string;
    images?: FAQImage[];
    reviewed_at?: Date;
    reviewed_by?: string;
  }
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
          answer_brief = ${data.answer_brief ?? null},
          answer_en = ${data.answer_en ?? null},
          answer_brief_en = ${data.answer_brief_en ?? null},
          question_en = ${data.question_en ?? null},
          images = ${JSON.stringify(data.images ?? [])}::jsonb,
          error_message = NULL,
          updated_at = NOW()
      WHERE id = ${id}
    `;
  } else if (data?.reviewed_at) {
    await sql`
      UPDATE faq_items
      SET status = ${status},
          reviewed_at = ${data.reviewed_at.toISOString()},
          reviewed_by = ${data.reviewed_by ?? null},
          error_message = ${data?.error_message ?? null},
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
  await ensureSchema();
  const result = await sql`
    SELECT * FROM faq_items ORDER BY created_at DESC
  `;
  return result.rows.map(rowToFaqItem);
}

export async function getPublishedFaqItems(): Promise<DBFaqItem[]> {
  await ensureSchema();
  const result = await sql`
    SELECT * FROM faq_items WHERE status IN ('published', 'ready') ORDER BY created_at DESC
  `;
  return result.rows.map(rowToFaqItem);
}

export async function getFaqItemById(id: number): Promise<DBFaqItem | null> {
  await ensureSchema();
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
    question_en: (row.question_en as string | null) ?? null,
    answer_raw: row.answer_raw as string,
    answer: row.answer as string | null,
    answer_brief: (row.answer_brief as string | null) ?? null,
    answer_en: (row.answer_en as string | null) ?? null,
    answer_brief_en: (row.answer_brief_en as string | null) ?? null,
    tags: (row.tags as string[]) ?? [],
    categories: (row.categories as string[]) ?? [],
    references: (typeof row.references === "string"
      ? JSON.parse(row.references)
      : row.references) as Reference[],
    images: (typeof row.images === "string"
      ? JSON.parse(row.images)
      : row.images ?? []) as FAQImage[],
    upvote_count: (row.upvote_count as number) ?? 0,
    downvote_count: (row.downvote_count as number) ?? 0,
    date: (row.date as string) ?? "",
    difficulty: (row.difficulty as DBFaqItem["difficulty"]) ?? null,
    status: row.status as DBFaqItem["status"],
    error_message: row.error_message as string | null,
    created_at: new Date(row.created_at as string),
    updated_at: new Date(row.updated_at as string),
    reviewed_at: row.reviewed_at ? new Date(row.reviewed_at as string) : null,
    reviewed_by: (row.reviewed_by as string | null) ?? null,
  };
}

const VALID_VOTE_COLUMNS: Record<string, string> = {
  upvote: "upvote_count",
  downvote: "downvote_count",
};

export async function castVote(
  faqId: number,
  voteType: string,
  fingerprint: string,
  ipAddress: string | null,
  reason?: string,
  detail?: string
): Promise<{ inserted: boolean; switched: boolean }> {
  const column = VALID_VOTE_COLUMNS[voteType];
  if (!column) throw new Error(`Invalid vote type: ${voteType}`);

  const existing = await sql`
    SELECT vote_type FROM faq_votes
    WHERE faq_id = ${faqId} AND fingerprint = ${fingerprint}
  `;

  if (existing.rows.length > 0) {
    const oldType = existing.rows[0].vote_type as string;
    if (oldType === voteType) {
      return { inserted: false, switched: false };
    }
    const oldColumn = VALID_VOTE_COLUMNS[oldType];
    if (oldColumn) {
      await sql.query(
        `UPDATE faq_items SET ${oldColumn} = GREATEST(${oldColumn} - 1, 0) WHERE id = $1`,
        [faqId]
      );
    }
    await sql`DELETE FROM faq_votes WHERE faq_id = ${faqId} AND fingerprint = ${fingerprint}`;
  }

  await sql`
    INSERT INTO faq_votes (faq_id, vote_type, fingerprint, ip_address, reason, detail)
    VALUES (${faqId}, ${voteType}, ${fingerprint}, ${ipAddress}, ${reason ?? null}, ${detail ?? null})
  `;
  await sql.query(
    `UPDATE faq_items SET ${column} = ${column} + 1 WHERE id = $1`,
    [faqId]
  );

  return { inserted: true, switched: existing.rows.length > 0 };
}

export async function revokeVote(
  faqId: number,
  fingerprint: string
): Promise<boolean> {
  const existing = await sql`
    SELECT vote_type FROM faq_votes
    WHERE faq_id = ${faqId} AND fingerprint = ${fingerprint}
  `;
  if (existing.rows.length === 0) return false;

  const voteType = existing.rows[0].vote_type as string;
  const column = VALID_VOTE_COLUMNS[voteType];

  await sql`DELETE FROM faq_votes WHERE faq_id = ${faqId} AND fingerprint = ${fingerprint}`;
  if (column) {
    await sql.query(
      `UPDATE faq_items SET ${column} = GREATEST(${column} - 1, 0) WHERE id = $1`,
      [faqId]
    );
  }
  return true;
}

export async function getVotesByFingerprint(
  fingerprint: string
): Promise<Record<number, string>> {
  const result = await sql`
    SELECT faq_id, vote_type FROM faq_votes WHERE fingerprint = ${fingerprint}
  `;
  const map: Record<number, string> = {};
  for (const row of result.rows) {
    map[row.faq_id as number] = row.vote_type as string;
  }
  return map;
}

export async function getVoteCounts(
  faqIds: number[]
): Promise<Map<number, { upvote: number; downvote: number }>> {
  if (faqIds.length === 0) return new Map();
  const result = await sql.query(
    `SELECT faq_id, vote_type, COUNT(*)::int as count
     FROM faq_votes
     WHERE faq_id = ANY($1)
     GROUP BY faq_id, vote_type`,
    [faqIds]
  );
  const map = new Map<number, { upvote: number; downvote: number }>();
  for (const row of result.rows) {
    const faqId = row.faq_id as number;
    if (!map.has(faqId)) map.set(faqId, { upvote: 0, downvote: 0 });
    const entry = map.get(faqId)!;
    const type = row.vote_type as string;
    if (type === "upvote") entry.upvote = row.count as number;
    else if (type === "downvote") entry.downvote = row.count as number;
  }
  return map;
}
