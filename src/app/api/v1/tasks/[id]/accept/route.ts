import { NextRequest } from "next/server";
import { acceptTask } from "@/services/taskService";
import { successResponse, errorResponse } from "@/lib/response";
import { ErrorCodes } from "@/lib/errors";
import { requireHumanAuth } from "@/lib/middleware";

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

    const result = await acceptTask(taskId, session.userId);
    return successResponse(result);
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED_HUMAN") {
      return errorResponse(ErrorCodes.UNAUTHORIZED, "Human session required", undefined, undefined, 401);
    }
    if (error.message === "TASK_NOT_FOUND") {
      return errorResponse(ErrorCodes.TASK_NOT_FOUND, "Task not found", undefined, undefined, 404);
    }
    if (error.message === "FORBIDDEN") {
      return errorResponse(ErrorCodes.FORBIDDEN, "Only the task poster can accept the delivery.", undefined, undefined, 403);
    }
    if (error.message === "TASK_ALREADY_ACCEPTED") {
      return errorResponse(ErrorCodes.TASK_ALREADY_ACCEPTED, "Task has already been accepted.", undefined, undefined, 409);
    }
    if (error.message === "TASK_NOT_DELIVERED") {
      return errorResponse(ErrorCodes.TASK_NOT_DELIVERED, "Task has not been delivered yet.", undefined, undefined, 409);
    }
    if (error.message === "DELIVERABLE_NOT_FOUND") {
      return errorResponse(ErrorCodes.DELIVERABLE_NOT_FOUND, "No deliverable found to accept.", undefined, undefined, 409);
    }
    
    return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to accept task");
  }
}
