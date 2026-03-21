import type { DBAdminTask } from "./db";
import { transitionAdminTaskStatus } from "./db";
import { RUNNER_DISPATCH_URL, RUNNER_SHARED_SECRET } from "./env";

export class AdminTaskDispatchStateError extends Error {
  constructor(message = "Task not pending") {
    super(message);
    this.name = "AdminTaskDispatchStateError";
  }
}

export class AdminTaskDispatchDeliveryError extends Error {
  constructor(message = "Failed to dispatch task") {
    super(message);
    this.name = "AdminTaskDispatchDeliveryError";
  }
}

export async function sendRunnerDispatch(
  task: Pick<DBAdminTask, "id" | "task_type" | "source" | "payload_json">
): Promise<void> {
  if (!RUNNER_DISPATCH_URL || !RUNNER_SHARED_SECRET) {
    throw new Error("Runner dispatch env is not configured");
  }

  const response = await fetch(RUNNER_DISPATCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RUNNER_SHARED_SECRET}`,
    },
    body: JSON.stringify({
      taskId: task.id,
      taskType: task.task_type,
      source: task.source,
      payload: task.payload_json,
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed to dispatch task (${response.status})`);
  }
}

export async function dispatchAdminTask(
  task: Pick<DBAdminTask, "id" | "task_type" | "source" | "payload_json">
): Promise<void> {
  const reserved = await transitionAdminTaskStatus(task.id, ["pending"], "running");
  if (!reserved) {
    throw new AdminTaskDispatchStateError();
  }

  try {
    await sendRunnerDispatch(task);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to dispatch task";
    await transitionAdminTaskStatus(task.id, ["running"], "pending", {
      errorMessage: message,
    });
    throw new AdminTaskDispatchDeliveryError(message);
  }
}
