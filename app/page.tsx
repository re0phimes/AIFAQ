import FAQList from "@/components/FAQList";
import faqData from "@/data/faq.json";
import { getReadyFaqItems } from "@/lib/db";
import type { FAQItem } from "@/src/types/faq";

export const revalidate = 60;

export default async function Home() {
  const staticItems: FAQItem[] = (faqData as Record<string, unknown>[]).map((item) => ({
    id: item.id as number,
    question: item.question as string,
    date: item.date as string,
    tags: (item.tags as string[]) ?? [],
    categories: (item.categories as string[]) ?? [],
    references: item.references as FAQItem["references"],
    answer: item.answer as string,
    upvoteCount: (item.upvoteCount as number) ?? 0,
    outdatedCount: (item.outdatedCount as number) ?? 0,
    inaccurateCount: (item.inaccurateCount as number) ?? 0,
  }));

  let dynamicItems: FAQItem[] = [];
  try {
    const dbItems = await getReadyFaqItems();
    dynamicItems = dbItems.map((item) => ({
      id: 10000 + item.id, // Offset to avoid ID collision with static items
      question: item.question,
      date: item.created_at.toISOString().slice(0, 10),
      tags: item.tags,
      categories: item.categories,
      references: item.references,
      answer: item.answer ?? item.answer_raw,
      upvoteCount: item.upvote_count,
      outdatedCount: item.outdated_count,
      inaccurateCount: item.inaccurate_count,
    }));
  } catch {
    // DB not available (e.g., local dev without Postgres) — graceful fallback
  }

  const allItems = [...staticItems, ...dynamicItems];

  return <FAQList items={allItems} />;
}
