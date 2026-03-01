import { NextResponse } from "next/server";
import { getServerSession } from "@/auth";
import { sql } from "@vercel/postgres";
import { initDB } from "@/lib/db";

export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await initDB();

    const result = await sql`
      SELECT
        uf.faq_id,
        uf.learning_status,
        uf.created_at,
        uf.last_viewed_at,
        fi.question,
        fi.question_en,
        fi.answer,
        fi.answer_brief,
        fi.answer_en,
        fi.answer_brief_en,
        fi.tags,
        fi.difficulty,
        fi.date
      FROM user_favorites uf
      LEFT JOIN faq_items fi ON uf.faq_id = fi.id
      WHERE uf.user_id = ${session.user.id}
      ORDER BY uf.created_at DESC
    `;

    const favorites = result.rows
      .filter(row => row.question !== null) // Filter out deleted FAQs
      .map(row => ({
      faq_id: row.faq_id,
      learning_status: row.learning_status,
      created_at: row.created_at,
      last_viewed_at: row.last_viewed_at,
      faq: {
        id: row.faq_id,
        question: row.question,
        questionEn: row.question_en,
        answer: row.answer,
        answerBrief: row.answer_brief,
        answerEn: row.answer_en,
        answerBriefEn: row.answer_brief_en,
        tags: row.tags,
        difficulty: row.difficulty,
        date: row.date,
      }
    }));

    // Calculate stats
    const total = favorites.length;
    const unread = favorites.filter(f => f.learning_status === 'unread').length;
    const learning = favorites.filter(f => f.learning_status === 'learning').length;
    const mastered = favorites.filter(f => f.learning_status === 'mastered').length;

    // Calculate stale (90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const stale = favorites.filter(f =>
      f.learning_status === 'unread' &&
      new Date(f.created_at) < ninetyDaysAgo
    ).length;

    return NextResponse.json({
      favorites,
      stats: { total, unread, learning, mastered, stale }
    });
  } catch (error) {
    console.error("Failed to fetch favorites:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
