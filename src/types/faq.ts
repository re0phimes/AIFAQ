export interface Reference {
  type: "blog" | "paper" | "other";
  title: string;
  url?: string;
  author?: string;
  platform?: string;
}

export interface FAQImage {
  url: string;
  caption: string;
  source: "blog" | "paper";
}

export interface FAQItem {
  id: number;
  question: string;
  questionEn?: string;
  date: string;
  tags: string[];
  categories: string[];
  references: Reference[];
  answer: string;
  answerBrief?: string;
  answerEn?: string;
  answerBriefEn?: string;
  images?: FAQImage[];
  upvoteCount: number;
  downvoteCount: number;
  difficulty?: "beginner" | "intermediate" | "advanced" | null;
  currentVersion?: number;
  lastUpdatedAt?: string; // ISO date string
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
