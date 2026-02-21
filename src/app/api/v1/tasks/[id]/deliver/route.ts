import { NextRequest, NextResponse } from "next/server";
import { deliverTask } from "@/services/taskService";
import { successResponse, errorResponse } from "@/lib/response";
import { ErrorCodes, AppError } from "@/lib/errors";
import { requireAgentAuth } from "@/lib/middleware";
import { withIdempotency } from "@/services/idempotencyService";
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
    if (error instanceof AppError) {
      return errorResponse(error.code, error.message, error.suggestion, error.details, error.status, error.safe_next_actions);
    }
    
    if (error.message === "INVALID_API_KEY") {
      return errorResponse(ErrorCodes.INVALID_API_KEY, "Agent API key is invalid.", "Verify the key.", undefined, 401, ["GENERATE_NEW_KEY"]);
    }
    
    return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to deliver task");
  }
}
