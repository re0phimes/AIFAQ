import type { FAQImage, Reference } from "@/src/types/faq";
import type { RegenerateTaskResult } from "./admin-task-types";

function sanitizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function sanitizeReferenceType(value: unknown): Reference["type"] | null {
  return value === "blog" || value === "paper" || value === "other" ? value : null;
}

function sanitizeImageSource(value: unknown): FAQImage["source"] | null {
  return value === "blog" || value === "paper" ? value : null;
}

function sanitizeReferences(value: unknown): Reference[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      return [];
    }

    const reference = item as Record<string, unknown>;
    const type = sanitizeReferenceType(reference.type);
    const title = sanitizeText(reference.title);
    if (!type || !title) {
      return [];
    }

    const sanitized: Reference = { type, title };
    const url = sanitizeText(reference.url);
    const author = sanitizeText(reference.author);
    const platform = sanitizeText(reference.platform);

    if (url) sanitized.url = url;
    if (author) sanitized.author = author;
    if (platform) sanitized.platform = platform;

    return [sanitized];
  });
}

function sanitizeImages(value: unknown): FAQImage[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      return [];
    }

    const image = item as Record<string, unknown>;
    const url = sanitizeText(image.url);
    const caption = sanitizeText(image.caption);
    const source = sanitizeImageSource(image.source);

    if (!url || !caption || !source) {
      return [];
    }

    return [{ url, caption, source }];
  });
}

export function sanitizeRunnerCallbackPayload(input: unknown): RegenerateTaskResult | null {
  const payload =
    typeof input === "object" && input !== null && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : null;

  if (!payload) {
    return null;
  }

  if (payload.status === "failed") {
    return {
      status: "failed",
      error_message: sanitizeText(payload.error_message) ?? "Runner task failed",
    };
  }

  if (payload.status !== "succeeded") {
    return null;
  }

  const answer = sanitizeText(payload.answer);
  if (!answer) {
    return null;
  }

  const result: RegenerateTaskResult = {
    status: "succeeded",
    answer,
  };

  const answerBrief = sanitizeText(payload.answer_brief);
  if (answerBrief) result.answer_brief = answerBrief;

  const answerEn = sanitizeText(payload.answer_en);
  if (answerEn) result.answer_en = answerEn;

  const answerBriefEn = sanitizeText(payload.answer_brief_en);
  if (answerBriefEn) result.answer_brief_en = answerBriefEn;

  const questionEn = sanitizeText(payload.question_en);
  if (questionEn) result.question_en = questionEn;

  const primaryCategory = sanitizeText(payload.primary_category);
  if (primaryCategory) result.primary_category = primaryCategory;

  const secondaryCategory = sanitizeText(payload.secondary_category);
  if (secondaryCategory) result.secondary_category = secondaryCategory;

  const tags = sanitizeStringArray(payload.tags);
  if (tags.length > 0) result.tags = tags;

  const topics = sanitizeStringArray(payload.topics);
  if (topics.length > 0) result.topics = topics;

  const toolStack = sanitizeStringArray(payload.tool_stack);
  if (toolStack.length > 0) result.tool_stack = toolStack;

  const references = sanitizeReferences(payload.references);
  if (references.length > 0) result.references = references;

  const images = sanitizeImages(payload.images);
  if (images.length > 0) result.images = images;

  return result;
}
