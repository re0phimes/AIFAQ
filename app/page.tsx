import FAQList from "@/components/FAQList";
import { getPublishedFaqItems } from "@/lib/db";
import type { FAQItem } from "@/src/types/faq";

export const revalidate = 60;

export default async function Home() {
  let items: FAQItem[] = [];
  try {
    const dbItems = await getPublishedFaqItems();
    items = dbItems.map((item) => ({
      id: item.id,
      question: item.question,
      questionEn: item.question_en ?? undefined,
      date: item.date || item.created_at.toISOString().slice(0, 10),
      tags: item.tags,
      categories: item.categories,
      references: item.references,
      answer: item.answer ?? item.answer_raw,
      answerBrief: item.answer_brief ?? undefined,
      answerEn: item.answer_en ?? undefined,
      answerBriefEn: item.answer_brief_en ?? undefined,
      images: item.images ?? [],
      upvoteCount: item.upvote_count,
      downvoteCount: item.downvote_count,
      difficulty: item.difficulty,
    }));
  } catch {
    // DB not available — empty list fallback
  }

  return <FAQList items={items} />;
}
