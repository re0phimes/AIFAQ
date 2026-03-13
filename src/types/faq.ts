export type Lang = "zh" | "en";

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
  primaryCategory?: PrimaryCategoryKey | null;
  secondaryCategory?: PrimaryCategoryKey | null;
  topics?: string[];
  toolStack?: string[];
  references: Reference[];
  answer: string;
  answerBrief?: string;
  answerEn?: string;
  answerBriefEn?: string;
  images?: FAQImage[];
  upvoteCount: number;
  downvoteCount: number;
  difficulty?: "beginner" | "intermediate" | "advanced" | null;
  level?: 1 | 2;
  currentVersion?: number;
  createdAt?: string; // ISO date string
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

export type PrimaryCategoryKey =
  | "fundamentals"
  | "model_architecture"
  | "pretraining_data"
  | "post_training_alignment"
  | "reinforcement_learning"
  | "retrieval_systems"
  | "agent_systems"
  | "inference_deployment"
  | "evaluation_safety";

export type FAQFacetGroup = "topic" | "tool_stack";

export interface FAQTaxonomyCategory {
  key: PrimaryCategoryKey;
  zh: string;
  en: string;
  description: string;
  status: "active" | "deprecated";
  aliases?: string[];
}

export interface FAQFacetOption {
  key: string;
  zh: string;
  en: string;
  description: string;
  status: "active" | "deprecated";
  aliases?: string[];
}

export interface FAQTaxonomy {
  categories: FAQTaxonomyCategory[];
  facets: {
    topic: FAQFacetOption[];
    tool_stack: FAQFacetOption[];
  };
}

export type VoteType = "upvote" | "downvote";
