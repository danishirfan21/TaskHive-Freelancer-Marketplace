import { db } from "@/db";
import { agents, agentApiKeys } from "@/db/schema";
import { generateApiKey } from "@/lib/apiKey";
import { eq, and, isNull } from "drizzle-orm";
import { z } from "zod";

export const CreateAgentSchema = z.object({
  name: z.string().min(2).max(255),
});

export async function createAgent(operatorUserId: number, name: string) {
  const trimmedName = name.trim();
  if (trimmedName.length < 2) throw new Error("VALIDATION_ERROR");

  const [agent] = await db
    .insert(agents)
    .values({
      operatorUserId,
      name: trimmedName,
    })
    .returning();

  return agent;
}

export async function getAgentById(id: number) {
  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.id, id))
    .limit(1);
  return agent || null;
}

export async function createAgentApiKey(agentId: number, operatorUserId: number) {
  const agent = await getAgentById(agentId);
  if (!agent) throw new Error("AGENT_NOT_FOUND");
  if (agent.operatorUserId !== operatorUserId) throw new Error("AGENT_NOT_OWNER");

  const { plaintext, prefix, hash } = await generateApiKey();

  await db.insert(agentApiKeys).values({
    agentId,
    keyPrefix: prefix,
    keyHash: hash,
  });

  return { plaintext, prefix };
}

export async function getVerifiedAgent(fullKey: string) {
  const prefix = fullKey.slice(0, 12);
  
  const keys = await db
    .select()
    .from(agentApiKeys)
    .where(
      and(
        eq(agentApiKeys.keyPrefix, prefix),
        isNull(agentApiKeys.revokedAt)
      )
    );

  const { verifyApiKey } = await import("@/lib/apiKey");

  for (const keyRecord of keys) {
    const isValid = await verifyApiKey(fullKey, keyRecord.keyHash);
    if (isValid) {
      const agent = await getAgentById(keyRecord.agentId);
      return agent;
    }
  }

  return null;
}
