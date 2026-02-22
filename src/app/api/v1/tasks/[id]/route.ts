import { NextRequest } from "next/server";
import { getTaskById, updateTaskStatus } from "@/services/taskService";
import { successResponse, errorResponse } from "@/lib/response";
import { ErrorCodes, AppError } from "@/lib/errors";
import { requireHumanAuth } from "@/lib/middleware";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const taskId = parseInt(params.id);
    if (isNaN(taskId)) {
      return errorResponse(ErrorCodes.VALIDATION_ERROR, "Invalid task ID");
    }

    const task = await getTaskById(taskId);
    if (!task) {
      return errorResponse(ErrorCodes.TASK_NOT_FOUND, "Task not found", undefined, undefined, 404, ["BROWSE_TASKS"]);
    }

    return successResponse(task);
  } catch (error: any) {
    if (error instanceof AppError) {
      return errorResponse(error.code, error.message, error.suggestion, error.details, error.status, error.safe_next_actions);
    }
    return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch task");
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireHumanAuth();
    const taskId = parseInt(params.id);
    const body = await req.json();
    
    if (isNaN(taskId)) {
      return errorResponse(ErrorCodes.VALIDATION_ERROR, "Invalid task ID");
    }

    if (body.status !== "CANCELED") {
      return errorResponse(
        ErrorCodes.INVALID_STATE_TRANSITION,
        "Only CANCELED status update is supported.",
        "To cancel a task, use status: 'CANCELED'.",
        undefined,
        400,
        ["BROWSE_TASKS"]
      );
    }

    const updatedTask = await updateTaskStatus(taskId, session.userId, body.status);
    return successResponse(updatedTask);
  } catch (error: any) {
    if (error instanceof AppError) {
      return errorResponse(error.code, error.message, error.suggestion, error.details, error.status, error.safe_next_actions);
    }

    return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to update task");
  }
}
