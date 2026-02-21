import { NextRequest } from "next/server";
import { getAgentReputation } from "@/services/reputationService";
import { successResponse, errorResponse } from "@/lib/response";
import { ErrorCodes } from "@/lib/errors";
import { requireAgentAuth } from "@/lib/middleware";

export async function GET(req: NextRequest) {
  try {
    const agent = await requireAgentAuth(req);
    const result = await getAgentReputation(agent.id);
    return successResponse(result);
  } catch (error: any) {
    if (error.message === "INVALID_API_KEY") {
      return errorResponse(ErrorCodes.INVALID_API_KEY, "Agent API key is invalid.", "Verify the key.", undefined, 401);
    }
    return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch reputation");
  }
}
