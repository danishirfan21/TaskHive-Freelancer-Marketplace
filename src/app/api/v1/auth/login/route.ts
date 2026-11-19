import { NextRequest } from "next/server";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { LoginSchema, loginUser } from "@/services/authService";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError, ErrorCodes } from "@/lib/errors";
import { setSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    rateLimit(`login:${clientIp(req)}`, 10, 60_000);
    const body = await req.json().catch(() => ({}));
    const validated = LoginSchema.safeParse(body);

    if (!validated.success) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        "Invalid input",
        "Provide email and password",
        validated.error.flatten().fieldErrors
      );
    }

    const user = await loginUser(validated.data);
    if (!user) {
      return errorResponse(
        ErrorCodes.INVALID_CREDENTIALS,
        "Invalid email or password",
        "Check your credentials and try again",
        undefined,
        401
      );
    }

    await setSession({ userId: user.id });

    return successResponse({ user_id: user.id });
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error.code, error.message, error.suggestion, error.details, error.status, error.safe_next_actions);
    }
    return errorResponse(ErrorCodes.INTERNAL_ERROR, "Login failed");
  }
}
