import { NextRequest, NextResponse } from "next/server";
import { CreateTaskSchema, createTask, browseOpenTasks } from "@/services/taskService";
import { successResponse, errorResponse } from "@/lib/response";
import { ErrorCodes, AppError } from "@/lib/errors";
import { requireHumanAuth, requireAgentAuth } from "@/lib/middleware";
import { withIdempotency } from "@/services/idempotencyService";
import { z } from "zod";

const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional().transform((val, ctx) => {
    if (!val) return undefined;
    try {
      const decoded = Buffer.from(val, "base64").toString("utf-8");
      const id = parseInt(decoded);
      if (isNaN(id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid cursor format" });
        return z.NEVER;
      }
      return id;
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid cursor encoding" });
      return z.NEVER;
    }
  }),
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

    const result = await withIdempotency(idempotencyKey, `user:${session.userId}:POST /api/v1/tasks`, async () => {
      const task = await createTask(session.userId, validated.data);
      return successResponse(task).json();
    });

    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof AppError) {
      return errorResponse(error.code, error.message, error.suggestion, error.details, error.status, error.safe_next_actions);
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

    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      await requireAgentAuth(req);
    }

    const { tasks, nextCursor } = await browseOpenTasks({ limit, cursor });
    
    return successResponse({ tasks }, { next_cursor: nextCursor });
  } catch (error: any) {
    if (error instanceof AppError) {
      return errorResponse(error.code, error.message, error.suggestion, error.details, error.status, error.safe_next_actions);
    }
    return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to list tasks");
  }
}
