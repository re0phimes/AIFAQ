export interface Reference {
  type: "blog" | "paper" | "other";
  title: string;
  url?: string;
  author?: string;
  platform?: string;
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
  difficulty?: "beginner" | "intermediate" | "advanced" | null;
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
