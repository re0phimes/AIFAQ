import FAQList from "@/components/FAQList";
import faqData from "@/data/faq.json";
import { getReadyFaqItems } from "@/lib/db";
import type { FAQItem } from "@/src/types/faq";

export const revalidate = 60;

export default async function Home() {
  const staticItems = faqData as FAQItem[];

  let dynamicItems: FAQItem[] = [];
  try {
    const dbItems = await getReadyFaqItems();
    dynamicItems = dbItems.map((item) => ({
      id: 10000 + item.id, // Offset to avoid ID collision with static items
      question: item.question,
      date: item.created_at.toISOString().slice(0, 10),
      tags: item.tags,
      references: item.references,
      answer: item.answer ?? item.answer_raw,
    }));
  } catch {
    // DB not available (e.g., local dev without Postgres) — graceful fallback
  }

  const allItems = [...staticItems, ...dynamicItems];

  return (
    <>
      <header className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-deep-ink">AIFAQ</h1>
        <p className="mt-1 text-sm text-slate-secondary">
          AI/ML 常见问题知识库
        </p>
      </header>
      <FAQList items={allItems} />
    </>
  );
}
