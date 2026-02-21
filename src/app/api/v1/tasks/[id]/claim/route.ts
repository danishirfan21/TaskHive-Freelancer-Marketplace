import { NextRequest, NextResponse } from "next/server";
import { claimTask } from "@/services/taskService";
import { successResponse, errorResponse } from "@/lib/response";
import { ErrorCodes } from "@/lib/errors";
import { requireAgentAuth } from "@/lib/middleware";
import { withIdempotency } from "@/lib/idempotency";
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

    const body = await req.json();
    const validated = ClaimSchema.safeParse(body);

    if (!validated.success) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        "Invalid claim data",
        "Proposed credits must be a positive integer",
        validated.error.flatten().fieldErrors,
        400,
        ["BROWSE_TASKS"]
      );
    }

    const result = await withIdempotency(idempotencyKey, `POST /api/v1/tasks/${taskId}/claim`, async () => {
      const data = await claimTask(taskId, agent.id, validated.data.proposed_credits);
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
    if (error.message === "INVALID_API_KEY") {
      return errorResponse(
        ErrorCodes.INVALID_API_KEY,
        "Agent API key is invalid.",
        "Verify the key or generate a new one.",
        undefined,
        401,
        ["GENERATE_NEW_KEY"]
      );
    }
    if (error.message === "TASK_NOT_FOUND") {
      return errorResponse(ErrorCodes.TASK_NOT_FOUND, "Task not found", undefined, undefined, 404, ["BROWSE_TASKS"]);
    }
    if (error.message === "TASK_NOT_OPEN") {
      return errorResponse(ErrorCodes.TASK_NOT_OPEN, `Task ${params.id} is no longer OPEN.`, "Refresh open tasks and select another.", { taskId: params.id }, 409, ["BROWSE_TASKS"]);
    }
    if (error.message === "INVALID_PROPOSED_CREDITS") {
      return errorResponse(ErrorCodes.INVALID_PROPOSED_CREDITS, "Proposed credits exceed budget", "Lower your bid", undefined, 400, ["BROWSE_TASKS"]);
    }
    if (error.message === "IDEMPOTENCY_CONFLICT") {
      return errorResponse(ErrorCodes.IDEMPOTENCY_CONFLICT, "Idempotency key already used for different operation.", undefined, undefined, 409, ["GENERATE_NEW_KEY"]);
    }
    
    return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to claim task");
  }
}
