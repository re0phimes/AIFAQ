import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth";
import {
  createImportRecord,
  createAdminTask,
  updateImportStatus,
} from "@/lib/db";
import { dispatchAdminTask } from "@/lib/admin-task-dispatch";
import { normalizeExternalSubmissionPayload } from "@/lib/external-submission-types";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authed = await verifyAdmin(request);
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > 4 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 4MB)" }, { status: 400 });
  }

  const filename = file.name;
  const ext = filename.split(".").pop()?.toLowerCase();
  const formatHint = formData.get("format") as string | null;
  const fileType = formatHint || ext || "txt";

  if (!["md", "txt", "pdf"].includes(fileType)) {
    return NextResponse.json({ error: `Unsupported file type: ${fileType}` }, { status: 400 });
  }

  const importId = `imp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await createImportRecord(importId, filename, fileType);

  const arrayBuffer = await file.arrayBuffer();
  const fileBase64 = Buffer.from(arrayBuffer).toString("base64");
  const normalized = normalizeExternalSubmissionPayload({
    submission_type: "document",
    source: "admin_import",
    source_id: importId,
    import_id: importId,
    filename,
    file_type: fileType,
    mime_type: file.type || `text/${fileType}`,
    file_base64: fileBase64,
  });
  if (!normalized.ok) {
    await updateImportStatus(importId, "failed", { error_msg: normalized.error });
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }

  const task = await createAdminTask({
    taskType: "ingest_submission",
    source: "admin_import",
    payload: normalized.value,
    createdBy: "admin",
  });

  try {
    await dispatchAdminTask(task);
    await updateImportStatus(importId, "pending");
  } catch {
    await updateImportStatus(importId, "failed", {
      error_msg: "Import recorded but task dispatch failed",
    });
    return NextResponse.json(
      {
        importId,
        taskId: task.id,
        status: "failed",
        message: "文件已接收，但任务派发失败",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    importId,
    taskId: task.id,
    status: "pending",
    fileType,
    message: "文件已接收，正在处理...",
  }, { status: 202 });
}
