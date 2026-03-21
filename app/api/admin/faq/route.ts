import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth";
import { createAdminTask, getAllFaqItems } from "@/lib/db";
import { dispatchAdminTask } from "@/lib/admin-task-dispatch";
import { normalizeExternalSubmissionPayload } from "@/lib/external-submission-types";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authed = await verifyAdmin(request);
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await getAllFaqItems();
  return NextResponse.json(items);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authed = await verifyAdmin(request);
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { question, answer } = await request.json();
  if (!question?.trim() || !answer?.trim()) {
    return NextResponse.json({ error: "问题和答案不能为空" }, { status: 400 });
  }

  const normalized = normalizeExternalSubmissionPayload({
    submission_type: "qa",
    source: "admin_manual",
    question,
    answer,
  });
  if (!normalized.ok) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }

  const task = await createAdminTask({
    taskType: "ingest_submission",
    source: "admin_manual",
    payload: normalized.value,
    createdBy: "admin",
  });

  try {
    await dispatchAdminTask(task);
    return NextResponse.json({ ok: true, taskId: task.id, status: "running" }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "提交已记录，但任务派发失败", taskId: task.id, status: "pending" },
      { status: 502 }
    );
  }
}
