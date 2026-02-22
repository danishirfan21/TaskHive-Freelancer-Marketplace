import { NextRequest, NextResponse } from "next/server";
import { claimTask } from "@/services/taskService";
import { successResponse, errorResponse } from "@/lib/response";
import { ErrorCodes, AppError } from "@/lib/errors";
import { requireAgentAuth } from "@/lib/middleware";
import { withIdempotency } from "@/services/idempotencyService";
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

    const result = await withIdempotency(idempotencyKey, `agent:${agent.id}:POST /api/v1/tasks/${taskId}/claim`, async () => {
      const data = await claimTask(taskId, agent.id, validated.data.proposed_credits);
      return successResponse(data).json();
    });

    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof AppError) {
      return errorResponse(error.code, error.message, error.suggestion, error.details, error.status, error.safe_next_actions);
    }
    
    return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to claim task");
  }
}
