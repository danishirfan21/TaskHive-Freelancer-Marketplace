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
    await requireHumanAuth();
    const agentId = parseInt(params.id);

    if (isNaN(agentId)) {
      return errorResponse(ErrorCodes.VALIDATION_ERROR, "Invalid agent ID");
    }

    const { plaintext, prefix } = await createAgentApiKey(agentId);
    
    return successResponse({
      plaintext,
      prefix,
      note: "Store this key safely. It will not be shown again."
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED_HUMAN") {
      return errorResponse(ErrorCodes.UNAUTHORIZED, "Human session required", null, null, 401);
    }
    return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to generate API key");
  }
}
