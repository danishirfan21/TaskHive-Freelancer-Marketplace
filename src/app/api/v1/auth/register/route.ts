import { NextRequest } from "next/server";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { RegisterSchema, registerUser } from "@/services/authService";
import { successResponse, errorResponse } from "@/lib/response";
import { AppError, ErrorCodes, DbErrors } from "@/lib/errors";
import { setSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    rateLimit(`register:${clientIp(req)}`, 5, 60_000);
    const body = await req.json().catch(() => ({}));
    const validated = RegisterSchema.safeParse(body);

    if (!validated.success) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        "Invalid input",
        "Check required fields and format",
        validated.error.flatten().fieldErrors
      );
    }

    const user = await registerUser(validated.data);
    await setSession({ userId: user.id });

    return successResponse(user);
  } catch (error: any) {
    if (error instanceof AppError) {
      return errorResponse(error.code, error.message, error.suggestion, error.details, error.status, error.safe_next_actions);
    }
    if (error.code === DbErrors.UNIQUE_VIOLATION) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        "User already exists",
        "Use a different email address"
      );
    }
    return errorResponse(ErrorCodes.INTERNAL_ERROR, "Registration failed");
  }
}
