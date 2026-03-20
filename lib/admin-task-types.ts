import type { FAQImage, Reference } from "@/src/types/faq";

export const REJECT_REASON_VALUES = [
  "images_missing",
  "content_incomplete",
  "formula_missing",
  "reference_weak",
  "format_issue",
  "language_issue",
  "policy_risk",
] as const;

export type RejectReason = (typeof REJECT_REASON_VALUES)[number];

export const ADMIN_TASK_STATUS_VALUES = [
  "pending",
  "running",
  "succeeded",
  "failed",
] as const;

export type AdminTaskStatus = (typeof ADMIN_TASK_STATUS_VALUES)[number];

export const ADMIN_TASK_TYPE_VALUES = ["regenerate"] as const;
export type AdminTaskType = (typeof ADMIN_TASK_TYPE_VALUES)[number];

export const ADMIN_TASK_SOURCE_VALUES = ["reject_auto"] as const;
export type AdminTaskSource = (typeof ADMIN_TASK_SOURCE_VALUES)[number];

export interface RegenerateTaskPayload {
  faqId: number;
  rejectEventId: number;
  question: string;
  answerRaw: string;
  existingReferences: Array<{ type: string; url: string }>;
  reasons: RejectReason[];
  note: string | null;
}

export interface RegenerateTaskResult {
  status: "succeeded" | "failed";
  answer?: string;
  answer_brief?: string | null;
  answer_en?: string | null;
  answer_brief_en?: string | null;
  question_en?: string | null;
  tags?: string[];
  primary_category?: string | null;
  secondary_category?: string | null;
  topics?: string[];
  tool_stack?: string[];
  references?: Reference[];
  images?: FAQImage[];
  error_message?: string | null;
}
