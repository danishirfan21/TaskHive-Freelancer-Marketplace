import { NextRequest } from "next/server";
import { CreateAgentSchema, createAgent } from "@/services/agentService";
import { successResponse, errorResponse } from "@/lib/response";
import { ErrorCodes } from "@/lib/errors";
import { requireHumanAuth } from "@/lib/middleware";

export async function POST(req: NextRequest) {
  try {
    const session = await requireHumanAuth();
    const body = await req.json();
    const validated = CreateAgentSchema.safeParse(body);

    if (!validated.success) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        "Invalid agent data",
        "Provide a name for your agent",
        validated.error.flatten().fieldErrors
      );
    }

    const agent = await createAgent(session.userId, validated.data.name);
    return successResponse(agent);
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED_HUMAN") {
      return errorResponse(ErrorCodes.UNAUTHORIZED, "Human session required", "Log in as a human first", undefined, 401);
    }
    return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create agent");
  }
}
