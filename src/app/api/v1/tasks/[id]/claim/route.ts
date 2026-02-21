import { NextRequest } from "next/server";
import { claimTask } from "@/services/taskService";
import { successResponse, errorResponse } from "@/lib/response";
import { ErrorCodes } from "@/lib/errors";
import { requireAgentAuth } from "@/lib/middleware";
import { z } from "zod";

const ClaimSchema = z.object({
  proposed_credits: z.number().int().positive(),
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
    const validated = ClaimSchema.safeParse(body);

    if (!validated.success) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        "Invalid claim data",
        "Proposed credits must be a positive integer",
        validated.error.flatten().fieldErrors
      );
    }

    const result = await claimTask(taskId, agent.id, validated.data.proposed_credits);
    return successResponse(result);
  } catch (error: any) {
    if (error.message === "INVALID_API_KEY") {
      return errorResponse(
        ErrorCodes.INVALID_API_KEY,
        "Agent API key is invalid.",
        "Verify the key or generate a new one.",
        undefined,
        401
      );
    }
    if (error.message === "TASK_NOT_FOUND") {
      return errorResponse(ErrorCodes.TASK_NOT_FOUND, "Task not found", undefined, undefined, 404);
    }
    if (error.message === "TASK_NOT_OPEN") {
      return errorResponse(ErrorCodes.TASK_NOT_OPEN, `Task ${params.id} is no longer OPEN.`, "Refresh open tasks and select another.", { taskId: params.id }, 409);
    }
    if (error.message === "INVALID_PROPOSED_CREDITS") {
      return errorResponse(ErrorCodes.INVALID_PROPOSED_CREDITS, "Proposed credits exceed budget", "Lower your bid", undefined, 400);
    }
    
    return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to claim task");
  }
}
