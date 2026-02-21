import { NextRequest, NextResponse } from "next/server";
import { acceptTask } from "@/services/taskService";
import { successResponse, errorResponse } from "@/lib/response";
import { ErrorCodes } from "@/lib/errors";
import { requireHumanAuth } from "@/lib/middleware";
import { withIdempotency } from "@/lib/idempotency";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireHumanAuth();
    const taskId = parseInt(params.id);

    if (isNaN(taskId)) {
      return errorResponse(ErrorCodes.VALIDATION_ERROR, "Invalid task ID");
    }

    const idempotencyKey = req.headers.get("Idempotency-Key");
    if (!idempotencyKey) {
      return errorResponse(
        ErrorCodes.IDEMPOTENCY_KEY_REQUIRED,
        "Mutating requests must include Idempotency-Key header.",
        "Generate a UUID and retry the request.",
        undefined,
        400,
        ["RETRY_WITH_IDEMPOTENCY_KEY"]
      );
    }

    const result = await withIdempotency(idempotencyKey, `POST /api/v1/tasks/${taskId}/accept`, async () => {
      const data = await acceptTask(taskId, session.userId);
      return {
        meta: {
          request_id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          version: "1.0"
        },
        status: "SUCCESS" as const,
        data,
        error: null
      };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED_HUMAN") {
      return errorResponse(ErrorCodes.UNAUTHORIZED, "Human session required", undefined, undefined, 401, ["LOGIN"]);
    }
    if (error.message === "TASK_NOT_FOUND") {
      return errorResponse(ErrorCodes.TASK_NOT_FOUND, "Task not found", undefined, undefined, 404, ["BROWSE_TASKS"]);
    }
    if (error.message === "FORBIDDEN") {
      return errorResponse(ErrorCodes.FORBIDDEN, "Only the task poster can accept the delivery.", undefined, undefined, 403, ["BROWSE_TASKS"]);
    }
    if (error.message === "TASK_ALREADY_ACCEPTED") {
      return errorResponse(ErrorCodes.TASK_ALREADY_ACCEPTED, "Task has already been accepted.", undefined, undefined, 409, ["BROWSE_TASKS"]);
    }
    if (error.message === "TASK_NOT_DELIVERED") {
      return errorResponse(ErrorCodes.TASK_NOT_DELIVERED, "Task has not been delivered yet.", undefined, undefined, 409, ["BROWSE_TASKS"]);
    }
    if (error.message === "DELIVERABLE_NOT_FOUND") {
      return errorResponse(ErrorCodes.DELIVERABLE_NOT_FOUND, "No deliverable found to accept.", undefined, undefined, 409, ["BROWSE_TASKS"]);
    }
    if (error.message === "IDEMPOTENCY_CONFLICT") {
      return errorResponse(ErrorCodes.IDEMPOTENCY_CONFLICT, "Idempotency key already used for different operation.", undefined, undefined, 409, ["GENERATE_NEW_KEY"]);
    }
    
    return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to accept task");
  }
}
