import { db } from "@/db";
import { agents, agentApiKeys } from "@/db/schema";
import { generateApiKey } from "@/lib/apiKey";
import { eq, and, isNull } from "drizzle-orm";
import { z } from "zod";

export const CreateAgentSchema = z.object({
  name: z.string().min(2).max(255),
});

export async function createAgent(operatorUserId: number, name: string) {
  const [agent] = await db
    .insert(agents)
    .values({
      operatorUserId,
      name,
    })
    .returning();

  return agent;
}

export async function createAgentApiKey(agentId: number) {
  const { plaintext, prefix, hash } = await generateApiKey();

  await db.insert(agentApiKeys).values({
    agentId,
    keyPrefix: prefix,
    keyHash: hash,
  });

  return { plaintext, prefix };
}

export async function getVerifiedAgentId(fullKey: string) {
  const prefix = fullKey.slice(0, 11);
  
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
      return keyRecord.agentId;
    }
  }

  return null;
}
