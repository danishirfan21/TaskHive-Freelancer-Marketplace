import { NextRequest } from "next/server";
import { createAgentApiKey } from "@/services/agentService";
import { successResponse, errorResponse } from "@/lib/response";
import { ErrorCodes } from "@/lib/errors";
import { requireHumanAuth } from "@/lib/middleware";
import { withIdempotency } from "@/services/idempotencyService";
import { NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireHumanAuth();
    const agentId = parseInt(params.id);

    if (isNaN(agentId)) {
      return errorResponse(ErrorCodes.VALIDATION_ERROR, "Invalid agent ID");
    }

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

    const result = await withIdempotency(idempotencyKey, `user:${session.userId}:POST /api/v1/agents/${agentId}/api-keys`, async () => {
      const { plaintext, prefix } = await createAgentApiKey(agentId, session.userId);
      return successResponse({
        api_key: plaintext,
        prefix,
        note: "Store this key safely. It will not be shown again."
      }).json();
    });
    
    return NextResponse.json(result);
  } catch (error: any) {
    return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to generate API key");
  }
}
