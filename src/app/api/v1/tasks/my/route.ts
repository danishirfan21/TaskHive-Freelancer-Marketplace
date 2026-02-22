import { NextRequest } from "next/server";
import { db } from "@/db";
import { tasks, deliverables } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/response";
import { requireHumanAuth } from "@/lib/middleware";
import { AppError, ErrorCodes } from "@/lib/errors";

/**
 * GET /api/v1/tasks/my
 * Returns all tasks posted by the authenticated user (no pagination — dashboard use).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireHumanAuth();

    const myTasks = await db.query.tasks.findMany({
      where: eq(tasks.posterId, session.userId),
      orderBy: [desc(tasks.createdAt)],
      with: {
        deliverables: {
          orderBy: [desc(deliverables.revisionNumber)],
          limit: 1,
        }
      }
    });

    return successResponse(myTasks);
  } catch (error: any) {
    if (error instanceof AppError) {
      return errorResponse(error.code, error.message, error.suggestion, error.details, error.status);
    }
    return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch your tasks");
  }
}
