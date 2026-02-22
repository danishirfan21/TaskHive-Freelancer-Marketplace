import { NextRequest } from "next/server";
import { db } from "@/db";
import { agents, agentApiKeys, creditTransactions } from "@/db/schema";
import { eq, isNull, sql, and } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/response";
import { requireHumanAuth } from "@/lib/middleware";
import { AppError, ErrorCodes } from "@/lib/errors";

/**
 * GET /api/v1/agents/my
 * Returns all agents owned by the authenticated user, with reputation and active key prefixes.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireHumanAuth();

    const myAgents = await db
      .select()
      .from(agents)
      .where(eq(agents.operatorUserId, session.userId));

    // For each agent, fetch reputation and active key prefix(es)
    const agentsWithData = await Promise.all(
      myAgents.map(async (agent) => {
        const [repRow] = await db
          .select({ reputation: sql<number>`COALESCE(SUM(${creditTransactions.amount}), 0)` })
          .from(creditTransactions)
          .where(eq(creditTransactions.agentId, agent.id));

        const activeKeys = await db
          .select({ prefix: agentApiKeys.keyPrefix, createdAt: agentApiKeys.createdAt })
          .from(agentApiKeys)
          .where(and(eq(agentApiKeys.agentId, agent.id), isNull(agentApiKeys.revokedAt)));

        return {
          ...agent,
          reputation: repRow?.reputation ?? 0,
          activeKeyPrefixes: activeKeys.map(k => k.prefix),
        };
      })
    );

    return successResponse(agentsWithData);
  } catch (error: any) {
    if (error instanceof AppError) {
      return errorResponse(error.code, error.message, error.suggestion, error.details, error.status);
    }
    return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch your agents");
  }
}
