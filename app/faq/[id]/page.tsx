import { notFound } from "next/navigation";
import { getServerSession } from "@/auth";
import { getFaqItemById, getUserPreferences } from "@/lib/db";
import { canAccessFaqLevel } from "@/lib/faq-level-access";
import { sql } from "@vercel/postgres";
import { cookies } from "next/headers";
import FAQDetailClient from "./FAQDetailClient";

export default async function FAQDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const faqId = Number(id);
  if (!Number.isInteger(faqId) || faqId <= 0) {
    notFound();
  }

  const faqItem = await getFaqItemById(faqId);
  if (!faqItem) {
    notFound();
  }
  const session = await getServerSession();
  const viewer = session?.user
    ? { role: session.user.role, tier: session.user.tier }
    : undefined;
  if (!canAccessFaqLevel(viewer, faqItem.level ?? 1)) {
    notFound();
  }

  // Get language preference from cookie or default to 'zh'
  const cookieStore = await cookies();
  const langCookie = cookieStore.get('aifaq-lang');
  let lang = (langCookie?.value === 'en' ? 'en' : 'zh') as "zh" | "en";

  if (session?.user?.id) {
    const prefs = await getUserPreferences(session.user.id);
    if (prefs?.language) {
      lang = prefs.language;
    }
  }
  let isFavorited = false;
  let learningStatus: string | null = null;

  if (session?.user?.id) {
    // Check if favorited and get status
    const result = await sql`
      SELECT learning_status FROM user_favorites
      WHERE user_id = ${session.user.id} AND faq_id = ${faqId}
    `;

    if (result.rows.length > 0) {
      isFavorited = true;
      learningStatus = result.rows[0].learning_status as string;

      // Auto-update to 'learning' if currently 'unread'
      if (learningStatus === 'unread') {
        await sql`
          UPDATE user_favorites
          SET learning_status = 'learning', last_viewed_at = NOW(), updated_at = NOW()
          WHERE user_id = ${session.user.id} AND faq_id = ${faqId}
        `;
        learningStatus = 'learning';
      }
    }
  }

  const faq = {
    id: faqItem.id,
    question: faqItem.question,
    questionEn: faqItem.question_en ?? undefined,
    answer: faqItem.answer ?? faqItem.answer_raw,
    answerBrief: faqItem.answer_brief ?? undefined,
    answerEn: faqItem.answer_en ?? undefined,
    answerBriefEn: faqItem.answer_brief_en ?? undefined,
    tags: faqItem.tags,
    categories: faqItem.categories || [],
    primaryCategory: faqItem.primary_category,
    secondaryCategory: faqItem.secondary_category,
    patterns: faqItem.patterns,
    topics: faqItem.topics,
    toolStack: faqItem.tool_stack,
    difficulty: faqItem.difficulty,
    date: faqItem.date,
    references: faqItem.references,
    images: faqItem.images || [],
    upvoteCount: faqItem.upvote_count || 0,
    downvoteCount: faqItem.downvote_count || 0,
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 md:max-w-4xl md:px-8 md:py-8">
      <FAQDetailClient
        faq={faq}
        isFavorited={isFavorited}
        learningStatus={learningStatus}
        lang={lang}
      />
    </main>
  );
}
