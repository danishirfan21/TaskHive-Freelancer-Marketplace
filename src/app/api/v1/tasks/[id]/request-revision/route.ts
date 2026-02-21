import { NextRequest } from "next/server";
import { requestRevision } from "@/services/taskService";
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

    const result = await requestRevision(taskId, session.userId);
    return successResponse(result);
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED_HUMAN") {
      return errorResponse(ErrorCodes.UNAUTHORIZED, "Human session required", undefined, undefined, 401);
    }
    if (error.message === "TASK_NOT_FOUND") {
      return errorResponse(ErrorCodes.TASK_NOT_FOUND, "Task not found", undefined, undefined, 404);
    }
    if (error.message === "FORBIDDEN") {
      return errorResponse(ErrorCodes.FORBIDDEN, "Only the task poster can request revisions.", undefined, undefined, 403);
    }
    if (error.message === "TASK_NOT_DELIVERED") {
      return errorResponse(ErrorCodes.TASK_NOT_DELIVERED, "Task must be in DELIVERED state to request revision.", undefined, undefined, 409);
    }
    
    return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to request revision");
  }
}
