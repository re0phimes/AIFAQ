export interface Reference {
  type: "blog" | "paper" | "other";
  title: string;
  url?: string;
}

export interface FAQItem {
  id: number;
  question: string;
  date: string;
  tags: string[];
  references: Reference[];
  answer: string;
}
