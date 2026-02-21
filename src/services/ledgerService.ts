import { db } from "@/db";
import { creditTransactions } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function getAgentReputation(agentId: number) {
  const [result] = await db
    .select({
      reputation: sql<number>`COALESCE(SUM(${creditTransactions.amount}), 0)`,
    })
    .from(creditTransactions)
    .where(eq(creditTransactions.agentId, agentId));

  return {
    agent_id: agentId,
    reputation: result?.reputation || 0,
  };
}
