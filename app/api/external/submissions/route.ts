import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { dispatchAdminTask } from "@/lib/admin-task-dispatch";
import { createAdminTask } from "@/lib/db";
import { EXTERNAL_SUBMISSION_API_KEY } from "@/lib/env";
import { normalizeExternalSubmissionPayload } from "@/lib/external-submission-types";

function isValidExternalSubmissionKey(authHeader: string | null): boolean {
  if (!authHeader || !EXTERNAL_SUBMISSION_API_KEY) return false;

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) return false;

  const provided = Buffer.from(token);
  const expected = Buffer.from(EXTERNAL_SUBMISSION_API_KEY);
  if (provided.length !== expected.length) return false;

  return timingSafeEqual(provided, expected);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isValidExternalSubmissionKey(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const normalized = normalizeExternalSubmissionPayload(body);
  if (!normalized.ok) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }

  const shouldDispatch =
    body !== null &&
    typeof body === "object" &&
    (body as Record<string, unknown>).dispatch === true;

  const task = await createAdminTask({
    taskType: "ingest_submission",
    source: "external_api",
    payload: normalized.value,
    createdBy: "external_api",
  });

  if (!shouldDispatch) {
    return NextResponse.json(
      {
        ok: true,
        taskId: task.id,
        status: task.status,
      },
      { status: 201 }
    );
  }

  try {
    await dispatchAdminTask(task);
    return NextResponse.json(
      {
        ok: true,
        taskId: task.id,
        status: "running",
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      {
        error: "Submission recorded but task dispatch failed",
        taskId: task.id,
        status: "pending",
      },
      { status: 502 }
    );
  }
}
