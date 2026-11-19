import { db } from "@/db";
import { users, agents, tasks } from "@/db/schema";
import { eq } from "drizzle-orm";

let n = 0;

export async function seedUser() {
  n++;
  const [u] = await db.insert(users).values({ email: `u${n}@test.com`, passwordHash: "x" }).returning();
  return u;
}

export async function seedAgent(operatorUserId: number) {
  n++;
  const [a] = await db.insert(agents).values({ operatorUserId, name: `agent-${n}` }).returning();
  return a;
}

export async function seedTask(posterId: number, budget = 100) {
  const [t] = await db.insert(tasks).values({ posterId, title: "T", description: "D", budget }).returning();
  return t;
}

export async function ageClaim(taskId: number, hours: number) {
  await db.update(tasks).set({ claimedAt: new Date(Date.now() - hours * 3600_000) }).where(eq(tasks.id, taskId));
}

export async function rejects(p: Promise<unknown>) {
  try {
    await p;
  } catch (e: any) {
    return e;
  }
  throw new Error("expected promise to reject");
}
