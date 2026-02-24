import FAQList from "@/components/FAQList";
import faqData from "@/data/faq.json";
import type { FAQItem } from "@/src/types/faq";

export default function Home() {
  return (
    <>
      <header className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-deep-ink">AIFAQ</h1>
        <p className="mt-1 text-sm text-slate-secondary">
          AI/ML 常见问题知识库
        </p>
      </header>
      <FAQList items={faqData as FAQItem[]} />
    </>
  );
}
