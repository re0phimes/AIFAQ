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

  const { id } = await params;
  const task = await getAdminTaskById(id);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  if (task.status !== "running") {
    return NextResponse.json({ error: "Task not running" }, { status: 409 });
  }

  let rawPayload: unknown;
  try {
    rawPayload = await request.json();
  } catch {
    await transitionAdminTaskStatus(id, ["running"], "failed", {
      errorMessage: "Invalid callback JSON",
    });
    return NextResponse.json({ error: "Invalid callback JSON" }, { status: 400 });
  }

  const sanitization = sanitizeRunnerCallbackPayload(rawPayload);
  if (!sanitization.ok || !sanitization.result) {
    await transitionAdminTaskStatus(id, ["running"], "failed", {
      errorMessage: sanitization.error ?? "Invalid callback payload",
    });
    return NextResponse.json(
      { error: sanitization.error ?? "Invalid callback payload" },
      { status: 400 }
    );
  }

  const sanitized = sanitization.result;

  try {
    if (sanitized.status === "failed") {
      const updatedTask = await transitionAdminTaskStatus(
        id,
        ["running"],
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
        ["running"],
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
      ["running"],
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
      ["running"],
      "failed",
      {
        resultJson: sanitized as unknown as Record<string, unknown>,
        errorMessage: message,
      }
    );
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
