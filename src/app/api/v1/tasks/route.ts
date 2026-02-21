import { NextRequest, NextResponse } from "next/server";
import { CreateTaskSchema, createTask, browseOpenTasks } from "@/services/taskService";
import { successResponse, errorResponse } from "@/lib/response";
import { ErrorCodes } from "@/lib/errors";
import { requireHumanAuth, requireAgentAuth } from "@/lib/middleware";
import { withIdempotency } from "@/lib/idempotency";
import { z } from "zod";

const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.coerce.number().int().positive().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireHumanAuth();
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
    const validated = CreateTaskSchema.safeParse(body);

    if (!validated.success) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        "Invalid task data",
        "Budget must be a positive integer",
        validated.error.flatten().fieldErrors
      );
    }

    const result = await withIdempotency(idempotencyKey, "POST /api/v1/tasks", async () => {
      const task = await createTask(session.userId, validated.data);
      return {
        meta: {
          request_id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          version: "1.0"
        },
        status: "SUCCESS" as const,
        data: task,
        error: null
      };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED_HUMAN") {
      return errorResponse(ErrorCodes.UNAUTHORIZED, "Human session required", undefined, undefined, 401, ["LOGIN"]);
    }
    if (error.message === "IDEMPOTENCY_CONFLICT") {
      return errorResponse(ErrorCodes.IDEMPOTENCY_CONFLICT, "Idempotency key already used for different operation.", undefined, undefined, 409, ["GENERATE_NEW_KEY"]);
    }
    return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create task");
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const validatedParams = PaginationSchema.safeParse(Object.fromEntries(searchParams));

    if (!validatedParams.success) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        "Invalid pagination parameters",
        "Limit must be 1-50, cursor must be a positive integer",
        validatedParams.error.flatten().fieldErrors,
        400,
        ["BROWSE_TASKS"]
      );
    }

    const { limit, cursor } = validatedParams.data;

    // If Authorization header is present, it must be valid for an agent
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      await requireAgentAuth(req);
    }

    const { tasks, nextCursor } = await browseOpenTasks({ limit, cursor });
    
    return successResponse({ tasks }, { next_cursor: nextCursor });
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
    return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to list tasks");
  }
}
