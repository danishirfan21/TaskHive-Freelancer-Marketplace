import { NextRequest } from "next/server";
import { getTaskById, updateTaskStatus } from "@/services/taskService";
import { successResponse, errorResponse } from "@/lib/response";
import { ErrorCodes } from "@/lib/errors";
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
      return errorResponse(ErrorCodes.TASK_NOT_FOUND, "Task not found", null, null, 404);
    }

    return successResponse(task);
  } catch (error) {
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
        "Only CANCELED status update is allowed in this version",
        "Try status: 'CANCELED'"
      );
    }

    const updatedTask = await updateTaskStatus(taskId, session.userId, body.status);
    return successResponse(updatedTask);
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED_HUMAN") {
      return errorResponse(ErrorCodes.UNAUTHORIZED, "Human session required", null, null, 401);
    }
    if (error.message === "TASK_NOT_FOUND") {
      return errorResponse(ErrorCodes.TASK_NOT_FOUND, "Task not found", null, null, 404);
    }
    if (error.message === "FORBIDDEN") {
      return errorResponse(ErrorCodes.FORBIDDEN, "Only the poster can cancel a task", null, null, 403);
    }
    if (error.message === "INVALID_STATE_TRANSITION") {
      return errorResponse(ErrorCodes.INVALID_STATE_TRANSITION, "Invalid state transition", "Tasks can only be canceled if they are OPEN");
    }
    return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to update task");
  }
}
