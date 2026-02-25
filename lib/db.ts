import { sql } from "@vercel/postgres";
import type { Reference } from "@/src/types/faq";

export interface DBFaqItem {
  id: number;
  question: string;
  answer_raw: string;
  answer: string | null;
  tags: string[];
  references: Reference[];
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
      references    JSONB DEFAULT '[]',
      status        VARCHAR(20) DEFAULT 'pending',
      error_message TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;
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
  data?: { answer?: string; tags?: string[]; references?: Reference[]; error_message?: string }
): Promise<void> {
  if (data?.answer !== undefined) {
    const tagsLiteral = `{${(data.tags ?? []).map((t) => `"${t}"`).join(",")}}`;
    await sql`
      UPDATE faq_items
      SET status = ${status},
          answer = ${data.answer},
          tags = ${tagsLiteral}::text[],
          references = ${JSON.stringify(data.references ?? [])}::jsonb,
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
    references: (typeof row.references === "string"
      ? JSON.parse(row.references)
      : row.references) as Reference[],
    status: row.status as DBFaqItem["status"],
    error_message: row.error_message as string | null,
    created_at: new Date(row.created_at as string),
    updated_at: new Date(row.updated_at as string),
  };
}
