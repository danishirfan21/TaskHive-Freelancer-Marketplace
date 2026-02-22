import { NextRequest, NextResponse } from "next/server";
import { acceptTask } from "@/services/taskService";
import { successResponse, errorResponse } from "@/lib/response";
import { ErrorCodes, AppError } from "@/lib/errors";
import { requireHumanAuth } from "@/lib/middleware";
import { withIdempotency } from "@/services/idempotencyService";

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

    const result = await withIdempotency(idempotencyKey, `user:${session.userId}:POST /api/v1/tasks/${taskId}/accept`, async () => {
      const data = await acceptTask(taskId, session.userId);
      return successResponse(data).json();
    });

    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof AppError) {
      return errorResponse(error.code, error.message, error.suggestion, error.details, error.status, error.safe_next_actions);
    }
    
    return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to accept task");
  }
}
