import { NextRequest } from "next/server";
import { getAgentReputation } from "@/services/ledgerService";
import { successResponse, errorResponse } from "@/lib/response";
import { ErrorCodes, AppError } from "@/lib/errors";
import { requireAgentAuth } from "@/lib/middleware";

export async function GET(req: NextRequest) {
  try {
    const agent = await requireAgentAuth(req);
    const result = await getAgentReputation(agent.id);
    return successResponse(result);
  } catch (error: any) {
    if (error instanceof AppError) {
      return errorResponse(error.code, error.message, error.suggestion, error.details, error.status, error.safe_next_actions);
    }

    return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch reputation");
  }
}
