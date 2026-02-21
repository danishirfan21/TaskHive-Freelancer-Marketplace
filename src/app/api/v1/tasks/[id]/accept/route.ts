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

    const result = await withIdempotency(idempotencyKey, `POST /api/v1/tasks/${taskId}/accept`, async () => {
      const data = await acceptTask(taskId, session.userId);
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
    
    if (error.message === "UNAUTHORIZED_HUMAN") {
      return errorResponse(ErrorCodes.UNAUTHORIZED, "Human session required", undefined, undefined, 401, ["LOGIN"]);
    }
    
    return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to accept task");
  }
}
