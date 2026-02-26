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
  categories: string[];
  references: Reference[];
  answer: string;
  upvoteCount: number;
  downvoteCount: number;
}

export interface TagCategory {
  name: string;
  description: string;
  tags: string[];
}

export interface TagTaxonomy {
  categories: TagCategory[];
}

export type VoteType = "upvote" | "downvote";
