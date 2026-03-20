import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  getAdminTaskById,
  getFaqItemById,
  transitionAdminTaskStatus,
  updateFaqStatus,
} from "@/lib/db";
import { RUNNER_SHARED_SECRET } from "@/lib/env";
import { sanitizeRunnerCallbackPayload } from "@/lib/sanitize";

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
  const sanitized = sanitizeRunnerCallbackPayload(body);
  if (!sanitized) {
    return NextResponse.json({ error: "Invalid runner callback payload" }, { status: 400 });
  }

  const { id } = await params;
  const task = await getAdminTaskById(id);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  if (!isCallbackReadyTaskStatus(task.status)) {
    return NextResponse.json({ error: "Task not ready for callback" }, { status: 409 });
  }

  try {
    if (sanitized.status === "failed") {
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

    const faqId = task.payload_json.faqId;
    const item = await getFaqItemById(faqId);
    if (!item) {
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
      answer: sanitized.answer,
      answer_brief: sanitized.answer_brief ?? item.answer_brief ?? undefined,
      answer_en: sanitized.answer_en ?? item.answer_en ?? undefined,
      answer_brief_en: sanitized.answer_brief_en ?? item.answer_brief_en ?? undefined,
      question_en: sanitized.question_en ?? item.question_en ?? undefined,
      tags: sanitized.tags ?? item.tags,
      categories: item.categories,
      primary_category: sanitized.primary_category ?? item.primary_category,
      secondary_category: sanitized.secondary_category ?? item.secondary_category,
      topics: sanitized.topics ?? item.topics,
      tool_stack: sanitized.tool_stack ?? item.tool_stack,
      references: sanitized.references ?? item.references,
      images: sanitized.images ?? item.images,
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
