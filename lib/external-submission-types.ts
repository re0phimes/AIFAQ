export const EXTERNAL_SUBMISSION_TYPE_VALUES = ["qa", "document"] as const;

export type ExternalSubmissionType = (typeof EXTERNAL_SUBMISSION_TYPE_VALUES)[number];

export interface ExternalQaSubmissionTaskPayload {
  submission_type: "qa";
  source: string;
  source_id: string | null;
  question: string;
  answer: string;
  metadata: Record<string, unknown> | null;
}

export interface ExternalDocumentSubmissionTaskPayload {
  submission_type: "document";
  source: string;
  source_id: string | null;
  import_id: string | null;
  filename: string | null;
  file_type: string | null;
  mime_type: string | null;
  file_base64: string | null;
  content_text: string | null;
  document_url: string | null;
  metadata: Record<string, unknown> | null;
}

export type ExternalSubmissionTaskPayload =
  | ExternalQaSubmissionTaskPayload
  | ExternalDocumentSubmissionTaskPayload;

export interface ExternalIngestedFaqItem {
  question: string;
  answer: string;
  answer_raw?: string | null;
  answer_brief?: string | null;
  answer_en?: string | null;
  answer_brief_en?: string | null;
  question_en?: string | null;
  tags?: string[];
  primary_category?: string | null;
  secondary_category?: string | null;
  topics?: string[];
  tool_stack?: string[];
  references?: Array<{
    type: "blog" | "paper" | "other";
    title: string;
    url?: string;
    author?: string;
    platform?: string;
  }>;
  images?: Array<{
    url: string;
    caption: string;
    source: "blog" | "paper";
  }>;
}

export interface ExternalDocumentSubmissionTaskResult {
  status: "succeeded" | "failed";
  items?: ExternalIngestedFaqItem[];
  total_qa?: number;
  passed_qa?: number;
  error_message?: string | null;
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeMetadata(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function normalizeExternalSubmissionPayload(input: unknown):
  | { ok: true; value: ExternalSubmissionTaskPayload }
  | { ok: false; error: string } {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "Invalid submission payload" };
  }

  const payload = input as Record<string, unknown>;
  const submissionType = payload.submission_type;
  const source = normalizeText(payload.source);
  const sourceId = normalizeText(payload.source_id);
  const metadata = normalizeMetadata(payload.metadata);

  if (!source) {
    return { ok: false, error: "Submission source is required" };
  }

  if (submissionType === "qa") {
    const question = normalizeText(payload.question);
    const answer = normalizeText(payload.answer);
    if (!question || !answer) {
      return { ok: false, error: "QA submission requires question and answer" };
    }

    return {
      ok: true,
      value: {
        submission_type: "qa",
        source,
        source_id: sourceId,
        question,
        answer,
        metadata,
      },
    };
  }

  if (submissionType === "document") {
    const contentText = normalizeText(payload.content_text);
    const documentUrl = normalizeText(payload.document_url);
    const fileBase64 = normalizeText(payload.file_base64);
    const filename = normalizeText(payload.filename);
    const mimeType = normalizeText(payload.mime_type);

    if (!contentText && !documentUrl && !fileBase64) {
      return {
        ok: false,
        error: "Document submission requires content_text, document_url, or file_base64",
      };
    }

    return {
      ok: true,
      value: {
        submission_type: "document",
        source,
        source_id: sourceId,
        import_id: normalizeText(payload.import_id),
        filename,
        file_type: normalizeText(payload.file_type),
        mime_type: mimeType,
        file_base64: fileBase64,
        content_text: contentText,
        document_url: documentUrl,
        metadata,
      },
    };
  }

  return { ok: false, error: "Unsupported submission type" };
}
