import { NextRequest } from "next/server";
import { LoginSchema, loginUser } from "@/services/authService";
import { successResponse, errorResponse } from "@/lib/response";
import { ErrorCodes } from "@/lib/errors";
import { setSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
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
    return errorResponse(ErrorCodes.INTERNAL_ERROR, "Login failed");
  }
}
