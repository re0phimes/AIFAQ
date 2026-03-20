import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth";
import { getAdminTaskById } from "@/lib/db";
import {
  AdminTaskDispatchDeliveryError,
  AdminTaskDispatchStateError,
  dispatchAdminTask,
} from "@/lib/admin-task-dispatch";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const authed = await verifyAdmin(request);
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const task = await getAdminTaskById(id);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  if (task.status !== "pending") {
    return NextResponse.json({ error: "Task not pending" }, { status: 409 });
  }

  try {
    await dispatchAdminTask(task);
  } catch (error) {
    if (error instanceof AdminTaskDispatchStateError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof AdminTaskDispatchDeliveryError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    throw error;
  }

  return NextResponse.json({ ok: true });
}
