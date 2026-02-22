import { getSession } from "@/lib/session";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/response";
import { ErrorCodes } from "@/lib/errors";

/**
 * GET /api/v1/auth/me
 * Returns the authenticated user's id and email, or 401.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, "Not authenticated.", undefined, undefined, 401);
    }

    const [user] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    if (!user) {
      return errorResponse(ErrorCodes.UNAUTHORIZED, "Session user not found.", undefined, undefined, 401);
    }

    return successResponse(user);
  } catch {
    return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch session.", undefined, undefined, 500);
  }
}
