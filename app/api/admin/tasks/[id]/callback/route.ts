import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  createFaqItem,
  getAdminTaskById,
  getFaqItemById,
  transitionAdminTaskStatus,
  updateImportStatus,
  updateFaqStatus,
} from "@/lib/db";
import { RUNNER_SHARED_SECRET } from "@/lib/env";
import type {
  ExternalDocumentSubmissionTaskResult,
  ExternalSubmissionTaskPayload,
} from "@/lib/external-submission-types";
import type { RegenerateTaskPayload, RegenerateTaskResult } from "@/lib/admin-task-types";
import {
  sanitizeDocumentRunnerCallbackPayload,
  sanitizeRunnerCallbackPayload,
} from "@/lib/sanitize";
import { normalizePrimaryCategoryKey } from "@/lib/taxonomy";

const CALLBACK_ACCEPTED_TASK_STATUSES = ["pending", "running"] as const;

function isCallbackReadyTaskStatus(status: string): boolean {
  return CALLBACK_ACCEPTED_TASK_STATUSES.includes(
    status as (typeof CALLBACK_ACCEPTED_TASK_STATUSES)[number]
  );
}

function isValidRunnerSecret(authHeader: string | null): boolean {
  if (!authHeader || !RUNNER_SHARED_SECRET) return false;

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) return false;

  const provided = Buffer.from(token);
  const expected = Buffer.from(RUNNER_SHARED_SECRET);
  if (provided.length !== expected.length) return false;

  return timingSafeEqual(provided, expected);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  if (!isValidRunnerSecret(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const { id } = await params;
  const task = await getAdminTaskById(id);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  if (!isCallbackReadyTaskStatus(task.status)) {
    return NextResponse.json({ error: "Task not ready for callback" }, { status: 409 });
  }

  const taskPayload =
    task.task_type === "ingest_submission"
      ? (task.payload_json as ExternalSubmissionTaskPayload)
      : null;
  const isDocumentIngestTask =
    task.task_type === "ingest_submission" && taskPayload?.submission_type === "document";
  const sanitizedPayload =
    isDocumentIngestTask
      ? sanitizeDocumentRunnerCallbackPayload(body)
      : sanitizeRunnerCallbackPayload(body);
  if (!sanitizedPayload.ok || !sanitizedPayload.result) {
    return NextResponse.json(
      { error: sanitizedPayload.error ?? "Invalid runner callback payload" },
      { status: 400 }
    );
  }
  const sanitized = sanitizedPayload.result;

  try {
    if (sanitized.status === "failed") {
      if (task.task_type === "ingest_submission" && taskPayload?.submission_type === "document" && taskPayload.import_id) {
        await updateImportStatus(taskPayload.import_id, "failed", {
          error_msg: sanitized.error_message ?? "Runner task failed",
        });
      }
      const updatedTask = await transitionAdminTaskStatus(
        id,
        [...CALLBACK_ACCEPTED_TASK_STATUSES],
        "failed",
        {
          resultJson: sanitized as unknown as Record<string, unknown>,
          errorMessage: sanitized.error_message ?? "Runner task failed",
        }
      );
      if (!updatedTask) {
        return NextResponse.json({ error: "Task not ready for callback" }, { status: 409 });
      }
      return NextResponse.json({ ok: true });
    }

    if (task.task_type === "ingest_submission") {
      if (!taskPayload) {
        return NextResponse.json({ error: "Invalid ingest submission payload" }, { status: 409 });
      }
      if (taskPayload.submission_type === "document") {
        const documentResult = sanitized as ExternalDocumentSubmissionTaskResult;
        const createdFaqIds: number[] = [];
        for (const item of documentResult.items ?? []) {
          const created = await createFaqItem(item.question, item.answer_raw ?? item.answer);
          await updateFaqStatus(created.id, "review", {
            answer: item.answer,
            answer_brief: item.answer_brief ?? undefined,
            answer_en: item.answer_en ?? undefined,
            answer_brief_en: item.answer_brief_en ?? undefined,
            question_en: item.question_en ?? undefined,
            tags: item.tags ?? [],
            categories: [],
            primary_category: normalizePrimaryCategoryKey(item.primary_category),
            secondary_category: normalizePrimaryCategoryKey(item.secondary_category),
            topics: item.topics ?? [],
            tool_stack: item.tool_stack ?? [],
            references: item.references ?? [],
            images: item.images ?? [],
            change_reason: `${task.source}:${id}`,
          });
          createdFaqIds.push(created.id);
        }

        if (taskPayload.import_id) {
          await updateImportStatus(taskPayload.import_id, "completed", {
            total_qa: documentResult.total_qa ?? createdFaqIds.length,
            passed_qa: documentResult.passed_qa ?? createdFaqIds.length,
          });
        }

        const updatedTask = await transitionAdminTaskStatus(
          id,
          [...CALLBACK_ACCEPTED_TASK_STATUSES],
          "succeeded",
          { resultJson: sanitized as unknown as Record<string, unknown> }
        );
        if (!updatedTask) {
          return NextResponse.json({ error: "Task not ready for callback" }, { status: 409 });
        }

        return NextResponse.json({ ok: true, faqIds: createdFaqIds });
      }

      if (taskPayload.submission_type !== "qa") {
        return NextResponse.json({ error: "Unsupported ingest submission type for callback" }, { status: 409 });
      }

      const qaResult = sanitized as RegenerateTaskResult;
      const item = await createFaqItem(taskPayload.question, taskPayload.answer);
      await updateFaqStatus(item.id, "review", {
        answer: qaResult.answer,
        answer_brief: qaResult.answer_brief ?? undefined,
        answer_en: qaResult.answer_en ?? undefined,
        answer_brief_en: qaResult.answer_brief_en ?? undefined,
        question_en: qaResult.question_en ?? undefined,
        tags: qaResult.tags ?? [],
        categories: [],
        primary_category: normalizePrimaryCategoryKey(qaResult.primary_category),
        secondary_category: normalizePrimaryCategoryKey(qaResult.secondary_category),
        topics: qaResult.topics ?? [],
        tool_stack: qaResult.tool_stack ?? [],
        references: qaResult.references ?? [],
        images: qaResult.images ?? [],
        change_reason: `${task.source}:${id}`,
      });

      const updatedTask = await transitionAdminTaskStatus(
        id,
        [...CALLBACK_ACCEPTED_TASK_STATUSES],
        "succeeded",
        { resultJson: sanitized as unknown as Record<string, unknown> }
      );
      if (!updatedTask) {
        return NextResponse.json({ error: "Task not ready for callback" }, { status: 409 });
      }

      return NextResponse.json({ ok: true, faqId: item.id });
    }

    if (task.task_type !== "regenerate") {
      return NextResponse.json({ error: "Unsupported task type for callback" }, { status: 409 });
    }

    const faqId = (task.payload_json as RegenerateTaskPayload).faqId;
    const regenerateResult = sanitized as RegenerateTaskResult;
    const existingItem = await getFaqItemById(faqId);
    if (!existingItem) {
      await transitionAdminTaskStatus(
        id,
        [...CALLBACK_ACCEPTED_TASK_STATUSES],
        "failed",
        {
          resultJson: sanitized as unknown as Record<string, unknown>,
          errorMessage: "FAQ not found for runner callback",
        }
      );
      return NextResponse.json({ error: "FAQ not found" }, { status: 404 });
    }

    await updateFaqStatus(faqId, "review", {
      answer: regenerateResult.answer,
      answer_brief: regenerateResult.answer_brief ?? existingItem.answer_brief ?? undefined,
      answer_en: regenerateResult.answer_en ?? existingItem.answer_en ?? undefined,
      answer_brief_en:
        regenerateResult.answer_brief_en ?? existingItem.answer_brief_en ?? undefined,
      question_en: regenerateResult.question_en ?? existingItem.question_en ?? undefined,
      tags: regenerateResult.tags ?? existingItem.tags,
      categories: existingItem.categories,
      primary_category:
        normalizePrimaryCategoryKey(regenerateResult.primary_category) ??
        existingItem.primary_category,
      secondary_category:
        normalizePrimaryCategoryKey(regenerateResult.secondary_category) ??
        existingItem.secondary_category,
      topics: regenerateResult.topics ?? existingItem.topics,
      tool_stack: regenerateResult.tool_stack ?? existingItem.tool_stack,
      references: regenerateResult.references ?? existingItem.references,
      images: regenerateResult.images ?? existingItem.images,
      change_reason: `reject_auto:${id}`,
    });

    const updatedTask = await transitionAdminTaskStatus(
      id,
      [...CALLBACK_ACCEPTED_TASK_STATUSES],
      "succeeded",
      { resultJson: sanitized as unknown as Record<string, unknown> }
    );
    if (!updatedTask) {
      return NextResponse.json({ error: "Task not ready for callback" }, { status: 409 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Runner callback handling failed";
    await transitionAdminTaskStatus(
      id,
      [...CALLBACK_ACCEPTED_TASK_STATUSES],
      "failed",
      {
        resultJson: sanitized as unknown as Record<string, unknown>,
        errorMessage: message,
      }
    );
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
