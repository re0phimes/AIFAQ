import { redirect } from "next/navigation";
import { getServerSession } from "@/auth";
import { cookies } from "next/headers";
import { sql } from "@vercel/postgres";
import { initDB } from "@/lib/db";
import { computeFavoriteStats, enrichFavoriteForDisplay } from "@/lib/favorite-reminder";
import ProfileClient from "./ProfileClient";

export default async function ProfilePage() {
  const session = await getServerSession();

  if (!session?.user) {
    redirect('/');
  }

  // Get language preference from cookie or default to 'zh'
  const cookieStore = await cookies();
  const langCookie = cookieStore.get('aifaq-lang');
  const lang = (langCookie?.value === 'en' ? 'en' : 'zh') as "zh" | "en";

  // Fetch favorites directly from database
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
      fi.categories,
      fi.references,
      fi.images,
      fi.upvote_count,
      fi.downvote_count,
      fi.difficulty,
      fi.date
    FROM user_favorites uf
    LEFT JOIN faq_items fi ON uf.faq_id = fi.id
    WHERE uf.user_id = ${session.user.id}
    ORDER BY uf.created_at DESC
  `;

  const favorites = result.rows
    .filter(row => row.question !== null)
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
        tags: row.tags || [],
        categories: row.categories || [],
        references: (typeof row.references === 'string' ? JSON.parse(row.references) : row.references) || [],
        images: (typeof row.images === 'string' ? JSON.parse(row.images) : row.images) || [],
        upvoteCount: row.upvote_count || 0,
        downvoteCount: row.downvote_count || 0,
        difficulty: row.difficulty,
        date: row.date,
      }
    }));

  const enrichedFavorites = favorites.map((favorite) =>
    enrichFavoriteForDisplay(favorite, lang)
  );

  const data = {
    favorites: enrichedFavorites,
    stats: computeFavoriteStats(enrichedFavorites)
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-4 md:py-6 md:max-w-4xl md:px-8">
      <ProfileClient
        favorites={data.favorites || []}
        stats={data.stats || { total: 0, unread: 0, learning: 0, mastered: 0, stale: 0 }}
        lang={lang}
        sessionUser={session?.user}
      />
    </main>
  );
}
