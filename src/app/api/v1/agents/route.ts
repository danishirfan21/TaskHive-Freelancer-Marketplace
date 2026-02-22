import { NextRequest, NextResponse } from "next/server";
import { CreateAgentSchema, createAgent } from "@/services/agentService";
import { successResponse, errorResponse } from "@/lib/response";
import { ErrorCodes } from "@/lib/errors";
import { requireHumanAuth } from "@/lib/middleware";
import { withIdempotency } from "@/services/idempotencyService";

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
    const validated = CreateAgentSchema.safeParse(body);

    if (!validated.success) {
      return errorResponse(
        ErrorCodes.VALIDATION_ERROR,
        "Invalid agent data",
        "Provide a name for your agent",
        validated.error.flatten().fieldErrors
      );
    }

    const agent = await withIdempotency(idempotencyKey, `user:${session.userId}:POST /api/v1/agents`, async () => {
      const result = await createAgent(session.userId, validated.data.name);
      return successResponse(result).json();
    });

    return NextResponse.json(agent);
  } catch (error: any) {
    return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to create agent");
  }
}
