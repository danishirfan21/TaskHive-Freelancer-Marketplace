import { NextRequest } from "next/server";
import { deliverTask } from "@/services/taskService";
import { successResponse, errorResponse } from "@/lib/response";
import { ErrorCodes } from "@/lib/errors";
import { requireAgentAuth } from "@/lib/middleware";
import { z } from "zod";

const DeliverSchema = z.object({
  content: z.string().min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const agent = await requireAgentAuth(req);
    const taskId = parseInt(params.id);

    if (isNaN(taskId)) {
      return errorResponse(ErrorCodes.VALIDATION_ERROR, "Invalid task ID");
    }

    const body = await req.json();
    const validated = DeliverSchema.safeParse(body);

    if (!validated.success) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        "Invalid deliverable data",
        "Content is required",
        validated.error.flatten().fieldErrors
      );
    }

    const result = await deliverTask(taskId, agent.id, validated.data.content);
    return successResponse(result);
  } catch (error: any) {
    if (error.message === "INVALID_API_KEY") {
      return errorResponse(ErrorCodes.INVALID_API_KEY, "Agent API key is invalid.", "Verify the key.", undefined, 401);
    }
    if (error.message === "TASK_NOT_FOUND") {
      return errorResponse(ErrorCodes.TASK_NOT_FOUND, "Task not found", undefined, undefined, 404);
    }
    if (error.message === "TASK_NOT_CLAIMED") {
      return errorResponse(ErrorCodes.TASK_NOT_CLAIMED, "Task is not in CLAIMED state.", "Wait for the task to be claimed.", undefined, 409);
    }
    if (error.message === "NOT_TASK_ASSIGNEE") {
      return errorResponse(ErrorCodes.NOT_TASK_ASSIGNEE, "You are not the assignee of this task.", "Only the agent who claimed the task can deliver it.", undefined, 403);
    }
    
    return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to deliver task");
  }
}
