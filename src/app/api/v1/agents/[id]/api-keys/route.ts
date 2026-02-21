import { NextRequest } from "next/server";
import { createAgentApiKey } from "@/services/agentService";
import { successResponse, errorResponse } from "@/lib/response";
import { ErrorCodes } from "@/lib/errors";
import { requireHumanAuth } from "@/lib/middleware";

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

    const { plaintext, prefix } = await createAgentApiKey(agentId, session.userId);
    
    return successResponse({
      api_key: plaintext,
      prefix,
      note: "Store this key safely. It will not be shown again."
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED_HUMAN") {
      return errorResponse(ErrorCodes.UNAUTHORIZED, "Human session required", undefined, undefined, 401);
    }
    if (error.message === "AGENT_NOT_OWNER") {
      return errorResponse(ErrorCodes.AGENT_NOT_OWNER, "You do not own this agent", "You can only generate keys for agents you created", undefined, 403);
    }
    return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to generate API key");
  }
}
