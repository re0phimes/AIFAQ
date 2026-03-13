import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { initDB } from "@/lib/db";
import { verifyAdmin } from "@/lib/auth";
import faqData from "@/data/faq.json";
import type { FAQItem } from "@/src/types/faq";

function escapePgArrayValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function toTextArrayLiteral(values: string[]): string {
  return `{${values.map((value) => `"${escapePgArrayValue(value)}"`).join(",")}}`;
}

export async function POST(): Promise<NextResponse> {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await initDB();

    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS faq_items_question_unique
      ON faq_items (question)
    `;

    const items = faqData as unknown as FAQItem[];
    let seeded = 0;
    let skipped = 0;

    for (const item of items) {
      const tagsLiteral = toTextArrayLiteral(item.tags);
      const categoriesLiteral = toTextArrayLiteral(item.categories);
      const topicsLiteral = toTextArrayLiteral(item.topics ?? []);
      const toolStackLiteral = toTextArrayLiteral(item.toolStack ?? []);
      const refsJson = JSON.stringify(item.references);

      const result = await sql`
        INSERT INTO faq_items (
          question, answer_raw, answer, tags, categories,
          primary_category, secondary_category, topics, tool_stack,
          "references", status, date, upvote_count, downvote_count
        )
        VALUES (
          ${item.question},
          ${item.answer},
          ${item.answer},
          ${tagsLiteral}::text[],
          ${categoriesLiteral}::text[],
          ${item.primaryCategory ?? null},
          ${item.secondaryCategory ?? null},
          ${topicsLiteral}::text[],
          ${toolStackLiteral}::text[],
          ${refsJson}::jsonb,
          'published',
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

    return NextResponse.json({ seeded, skipped, total: items.length });
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
