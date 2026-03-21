import type { FAQImage, Reference } from "@/src/types/faq";
import type { RegenerateTaskResult } from "./admin-task-types";
import type {
  ExternalDocumentSubmissionTaskResult,
  ExternalIngestedFaqItem,
} from "./external-submission-types";

export interface SanitizedRunnerCallbackPayload {
  ok: boolean;
  error?: string;
  result?: RegenerateTaskResult;
}

export interface SanitizedDocumentRunnerCallbackPayload {
  ok: boolean;
  error?: string;
  result?: ExternalDocumentSubmissionTaskResult;
}

function sanitizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    ),
  ];
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

function sanitizeDocumentItem(value: unknown): ExternalIngestedFaqItem | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const item = value as Record<string, unknown>;
  const question = sanitizeText(item.question);
  const answer = sanitizeText(item.answer);
  if (!question || !answer) {
    return null;
  }

  const sanitized: ExternalIngestedFaqItem = {
    question,
    answer,
  };

  const answerRaw = sanitizeText(item.answer_raw);
  if (answerRaw) sanitized.answer_raw = answerRaw;

  const answerBrief = sanitizeText(item.answer_brief);
  if (answerBrief) sanitized.answer_brief = answerBrief;

  const answerEn = sanitizeText(item.answer_en);
  if (answerEn) sanitized.answer_en = answerEn;

  const answerBriefEn = sanitizeText(item.answer_brief_en);
  if (answerBriefEn) sanitized.answer_brief_en = answerBriefEn;

  const questionEn = sanitizeText(item.question_en);
  if (questionEn) sanitized.question_en = questionEn;

  const primaryCategory = sanitizeText(item.primary_category);
  if (primaryCategory) sanitized.primary_category = primaryCategory;

  const secondaryCategory = sanitizeText(item.secondary_category);
  if (secondaryCategory) sanitized.secondary_category = secondaryCategory;

  const tags = sanitizeStringArray(item.tags);
  if (tags.length > 0) sanitized.tags = tags;

  const topics = sanitizeStringArray(item.topics);
  if (topics.length > 0) sanitized.topics = topics;

  const toolStack = sanitizeStringArray(item.tool_stack);
  if (toolStack.length > 0) sanitized.tool_stack = toolStack;

  const references = sanitizeReferences(item.references);
  if (references.length > 0) sanitized.references = references;

  const images = sanitizeImages(item.images);
  if (images.length > 0) sanitized.images = images;

  return sanitized;
}

function sanitizeNonNegativeInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return null;
  }
  return value;
}

export function sanitizeRunnerCallbackPayload(input: unknown): SanitizedRunnerCallbackPayload {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "Invalid callback payload" };
  }

  const payload = input as Record<string, unknown>;
  if (payload.status !== "succeeded" && payload.status !== "failed") {
    return { ok: false, error: "Invalid callback status" };
  }

  if (payload.status === "failed") {
    return {
      ok: true,
      result: {
        status: "failed",
        error_message: sanitizeText(payload.error_message) ?? "Runner task failed",
      },
    };
  }

  const answer = sanitizeText(payload.answer);
  if (!answer) {
    return { ok: false, error: "Succeeded callback must include answer" };
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

  return { ok: true, result };
}

export function sanitizeDocumentRunnerCallbackPayload(
  input: unknown
): SanitizedDocumentRunnerCallbackPayload {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "Invalid callback payload" };
  }

  const payload = input as Record<string, unknown>;
  if (payload.status !== "succeeded" && payload.status !== "failed") {
    return { ok: false, error: "Invalid callback status" };
  }

  if (payload.status === "failed") {
    return {
      ok: true,
      result: {
        status: "failed",
        error_message: sanitizeText(payload.error_message) ?? "Runner task failed",
      },
    };
  }

  if (!Array.isArray(payload.items)) {
    return { ok: false, error: "Succeeded document callback must include items" };
  }

  const items = payload.items
    .map((item) => sanitizeDocumentItem(item))
    .filter((item): item is ExternalIngestedFaqItem => item !== null);

  const totalQa = sanitizeNonNegativeInteger(payload.total_qa) ?? items.length;
  const passedQa = sanitizeNonNegativeInteger(payload.passed_qa) ?? items.length;

  return {
    ok: true,
    result: {
      status: "succeeded",
      items,
      total_qa: totalQa,
      passed_qa: passedQa,
    },
  };
}
