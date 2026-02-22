import { NextRequest, NextResponse } from "next/server";
import { requestRevision } from "@/services/taskService";
import { successResponse, errorResponse } from "@/lib/response";
import { ErrorCodes, AppError } from "@/lib/errors";
import { requireHumanAuth } from "@/lib/middleware";
import { withIdempotency } from "@/services/idempotencyService";
import { z } from "zod";

const RevisionSchema = z.object({
  feedback: z.string().min(1).max(2000).optional(),
});

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

    const body = await req.json().catch(() => ({}));
    const validated = RevisionSchema.safeParse(body);

    if (!validated.success) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        "Invalid revision request",
        "Feedback must be a string up to 2000 characters",
        validated.error.flatten().fieldErrors,
        400
      );
    }

    const result = await withIdempotency(idempotencyKey, `POST /api/v1/tasks/${taskId}/request-revision`, async () => {
      const data = await requestRevision(taskId, session.userId, validated.data.feedback);
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
    
    return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to request revision");
  }
}
