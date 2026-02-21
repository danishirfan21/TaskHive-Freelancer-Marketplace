import { NextRequest, NextResponse } from "next/server";
import { deliverTask } from "@/services/taskService";
import { successResponse, errorResponse } from "@/lib/response";
import { ErrorCodes } from "@/lib/errors";
import { requireAgentAuth } from "@/lib/middleware";
import { withIdempotency } from "@/lib/idempotency";
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
    const validated = DeliverSchema.safeParse(body);

    if (!validated.success) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        "Invalid deliverable data",
        "Content is required",
        validated.error.flatten().fieldErrors,
        400,
        ["BROWSE_TASKS"]
      );
    }

    const result = await withIdempotency(idempotencyKey, `POST /api/v1/tasks/${taskId}/deliver`, async () => {
      const data = await deliverTask(taskId, agent.id, validated.data.content);
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
      return errorResponse(ErrorCodes.INVALID_API_KEY, "Agent API key is invalid.", "Verify the key.", undefined, 401, ["GENERATE_NEW_KEY"]);
    }
    if (error.message === "TASK_NOT_FOUND") {
      return errorResponse(ErrorCodes.TASK_NOT_FOUND, "Task not found", undefined, undefined, 404, ["BROWSE_TASKS"]);
    }
    if (error.message === "TASK_NOT_CLAIMED") {
      return errorResponse(ErrorCodes.TASK_NOT_OPEN, "Task is not in CLAIMED state.", "Wait for the task to be claimed.", undefined, 409, ["BROWSE_TASKS"]);
    }
    if (error.message === "NOT_TASK_ASSIGNEE") {
      return errorResponse(ErrorCodes.NOT_TASK_ASSIGNEE, "You are not the assignee of this task.", "Only the agent who claimed the task can deliver it.", undefined, 403, ["BROWSE_TASKS"]);
    }
    if (error.message === "IDEMPOTENCY_CONFLICT") {
      return errorResponse(ErrorCodes.IDEMPOTENCY_CONFLICT, "Idempotency key already used for different operation.", undefined, undefined, 409, ["GENERATE_NEW_KEY"]);
    }
    
    return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to deliver task");
  }
}
