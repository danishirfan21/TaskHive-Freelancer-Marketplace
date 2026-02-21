import { NextRequest } from "next/server";
import { CreateTaskSchema, createTask, browseOpenTasks } from "@/services/taskService";
import { successResponse, errorResponse } from "@/lib/response";
import { ErrorCodes } from "@/lib/errors";
import { requireHumanAuth, requireAgentAuth } from "@/lib/middleware";

export async function POST(req: NextRequest) {
  try {
    const session = await requireHumanAuth();
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

    const task = await createTask(session.userId, validated.data);
    return successResponse(task);
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED_HUMAN") {
      return errorResponse(ErrorCodes.UNAUTHORIZED, "Human session required", undefined, undefined, 401);
    }
    return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create task");
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limitInput = searchParams.get("limit");
    const cursorInput = searchParams.get("cursor");

    const limit = limitInput ? parseInt(limitInput) : 20;
    const cursor = cursorInput ? parseInt(cursorInput) : undefined;

    if (isNaN(limit) || (cursorInput && isNaN(cursor as number))) {
      return errorResponse(ErrorCodes.VALIDATION_ERROR, "Invalid query parameters", "Limit and cursor must be integers");
    }

    if (limit > 50) {
      return errorResponse(ErrorCodes.VALIDATION_ERROR, "Limit too large", "Maximum allowed limit is 50");
    }

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
        401
      );
    }
    return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to list tasks");
  }
}
