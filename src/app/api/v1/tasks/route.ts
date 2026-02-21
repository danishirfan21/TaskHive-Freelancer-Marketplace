import { NextRequest } from "next/server";
import { CreateTaskSchema, createTask, listOpenTasks } from "@/services/taskService";
import { successResponse, errorResponse } from "@/lib/response";
import { ErrorCodes } from "@/lib/errors";
import { requireHumanAuth, requireAnyAuth } from "@/lib/middleware";

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
      return errorResponse(ErrorCodes.UNAUTHORIZED, "Human session required", null, null, 401);
    }
    return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create task");
  }
}

export async function GET(req: NextRequest) {
  try {
    // Tasks are public or agent accessible
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "10");
    const cursor = searchParams.get("cursor") ? parseInt(searchParams.get("cursor")!) : undefined;

    const { items, nextCursor } = await listOpenTasks(limit, cursor);
    
    return successResponse(items, { next_cursor: nextCursor });
  } catch (error) {
    return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to list tasks");
  }
}
