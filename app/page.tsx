import FAQPage from "./FAQPage";
import { getServerSession } from "@/auth";
import { getPublishedFaqItems } from "@/lib/db";
import { resolveAllowedLevels } from "@/lib/faq-level-access";
import type { FAQItem } from "@/src/types/faq";

export const revalidate = 60;

export default async function Home() {
  let items: FAQItem[] = [];
  let session = null;

  try {
    session = await getServerSession();
    const allowedLevels = new Set(
      resolveAllowedLevels(
        session?.user
          ? { role: session.user.role, tier: session.user.tier }
          : undefined,
        "all"
      )
    );

    const dbItems = await getPublishedFaqItems();
    items = dbItems
      .filter((item) => allowedLevels.has(item.level ?? 1))
      .map((item) => ({
        id: item.id,
        question: item.question,
        questionEn: item.question_en ?? undefined,
        date: item.date || item.created_at.toISOString().slice(0, 10),
        tags: item.tags,
        categories: item.categories,
        primaryCategory: item.primary_category,
        secondaryCategory: item.secondary_category,
        topics: item.topics,
        toolStack: item.tool_stack,
        references: item.references,
        answer: item.answer ?? item.answer_raw,
        answerBrief: item.answer_brief ?? undefined,
        answerEn: item.answer_en ?? undefined,
        answerBriefEn: item.answer_brief_en ?? undefined,
        images: item.images ?? [],
        upvoteCount: item.upvote_count,
        downvoteCount: item.downvote_count,
        difficulty: item.difficulty,
        level: item.level,
        currentVersion: item.current_version,
        createdAt: item.created_at?.toISOString(),
        lastUpdatedAt: item.last_updated_at?.toISOString(),
      }));
  } catch {
    // DB not available - empty list fallback
  }

  return (
    <main id="top" className="mx-auto max-w-2xl px-4 py-4 md:py-6 md:max-w-4xl md:px-8">
      <FAQPage items={items} initialSession={session} />
    </main>
  );
}
