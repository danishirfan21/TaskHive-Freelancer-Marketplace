import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/db", async () => (await import("@/test/mockDb")).mockDbModule());

import * as dbModule from "@/db";
import { db } from "@/db";
import { tasks, claims, deliverables } from "@/db/schema";
import { eq } from "drizzle-orm";
import { resetDb } from "@/test/testDb";
import { seedUser, seedAgent, seedTask, ageClaim, rejects } from "@/test/helpers";
import {
  CreateTaskSchema,
  createTask,
  browseOpenTasks,
  claimTask,
  deliverTask,
  requestRevision,
  acceptTask,
  updateTaskStatus,
} from "./taskService";
import { getAgentReputation } from "./ledgerService";

const client = (dbModule as any).pgClient;

beforeEach(() => resetDb(client));

async function world() {
  const poster = await seedUser();
  const operator = await seedUser();
  const agent = await seedAgent(operator.id);
  const other = await seedAgent((await seedUser()).id);
  const task = await seedTask(poster.id, 100);
  return { poster, operator, agent, other, task };
}

const statusOf = async (id: number) => (await db.select().from(tasks).where(eq(tasks.id, id)))[0].status;

describe("CreateTaskSchema / createTask", () => {
  it("validates title, description and positive integer budget", () => {
    expect(CreateTaskSchema.safeParse({ title: "t", description: "d", budget: 10 }).success).toBe(true);
    expect(CreateTaskSchema.safeParse({ title: "t", description: "d", budget: 0 }).success).toBe(false);
    expect(CreateTaskSchema.safeParse({ title: "t", description: "d", budget: 1.5 }).success).toBe(false);
    expect(CreateTaskSchema.safeParse({ title: "", description: "d", budget: 1 }).success).toBe(false);
    expect(CreateTaskSchema.safeParse({ title: "t", description: "x".repeat(10001), budget: 1 }).success).toBe(false);
  });

  it("creates an OPEN task for the poster", async () => {
    const p = await seedUser();
    const t = await createTask(p.id, { title: "A", description: "B", budget: 5 });
    expect(t.status).toBe("OPEN");
    expect(t.posterId).toBe(p.id);
  });
});

describe("claimTask", () => {
  it("claims an open task and records the claim", async () => {
    const { agent, task } = await world();
    const res = await claimTask(task.id, agent.id, 80);
    expect(res).toMatchObject({ status: "CLAIMED", claimed_by: agent.id, proposed_credits: 80 });
    expect(await statusOf(task.id)).toBe("CLAIMED");
    expect(await db.select().from(claims).where(eq(claims.taskId, task.id))).toHaveLength(1);
  });

  it("rejects a bid above budget and leaves the task OPEN (rolled back)", async () => {
    const { agent, task } = await world();
    const err = await rejects(claimTask(task.id, agent.id, 101));
    expect(err.code).toBe("INVALID_PROPOSED_CREDITS");
    expect(await statusOf(task.id)).toBe("OPEN");
    expect(await db.select().from(claims)).toHaveLength(0);
  });

  it("returns TASK_NOT_FOUND for unknown tasks", async () => {
    const { agent } = await world();
    const err = await rejects(claimTask(9999, agent.id, 1));
    expect(err.code).toBe("TASK_NOT_FOUND");
    expect(err.status).toBe(404);
  });

  it("blocks a second claim while the first is still live", async () => {
    const { agent, other, task } = await world();
    await claimTask(task.id, agent.id, 50);
    const err = await rejects(claimTask(task.id, other.id, 50));
    expect(err.code).toBe("TASK_NOT_OPEN");
    expect(err.status).toBe(409);
  });

  it("forbids an operator claiming a task posted by their own account", async () => {
    const poster = await seedUser();
    const ownAgent = await seedAgent(poster.id);
    const task = await seedTask(poster.id);
    const err = await rejects(claimTask(task.id, ownAgent.id, 10));
    expect(err.code).toBe("FORBIDDEN");
    expect(await statusOf(task.id)).toBe("OPEN");
  });

  it("lets another agent re-claim after 24h and supersedes the old claim", async () => {
    const { agent, other, task } = await world();
    await claimTask(task.id, agent.id, 50);
    await ageClaim(task.id, 25);
    await claimTask(task.id, other.id, 60);
    const rows = await db.select().from(claims).where(eq(claims.taskId, task.id)).orderBy(claims.id);
    expect(rows.map(r => [r.agentId, r.status])).toEqual([[agent.id, "REJECTED"], [other.id, "CLAIMED"]]);
    expect((await db.select().from(tasks).where(eq(tasks.id, task.id)))[0].claimedBy).toBe(other.id);
  });
});

describe("browseOpenTasks", () => {
  it("lists OPEN and expired-CLAIMED tasks, hides live claims, and paginates by id", async () => {
    const { agent, poster } = await world(); // task #1 (OPEN)
    const live = await seedTask(poster.id);
    const stale = await seedTask(poster.id);
    await seedTask(poster.id);
    await claimTask(live.id, agent.id, 10);
    await claimTask(stale.id, agent.id, 10);
    await ageClaim(stale.id, 30);

    const page1 = await browseOpenTasks({ limit: 2 });
    expect(page1.tasks).toHaveLength(2);
    expect(page1.nextCursor).not.toBeNull();
    const cursorId = parseInt(Buffer.from(page1.nextCursor!, "base64").toString());
    const page2 = await browseOpenTasks({ limit: 2, cursor: cursorId });

    const ids = [...page1.tasks, ...page2.tasks].map(t => t.id);
    expect(ids).not.toContain(live.id);
    expect(ids).toContain(stale.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(page2.nextCursor).toBeNull();
  });
});

describe("deliverTask", () => {
  it("delivers as the assignee with revision 1", async () => {
    const { agent, task } = await world();
    await claimTask(task.id, agent.id, 50);
    const res = await deliverTask(task.id, agent.id, "work");
    expect(res.status).toBe("DELIVERED");
    expect(await statusOf(task.id)).toBe("DELIVERED");
    const d = await db.select().from(deliverables).where(eq(deliverables.taskId, task.id));
    expect(d[0]).toMatchObject({ revisionNumber: 1, content: "work", status: "DELIVERED" });
  });

  it("rejects unclaimed tasks, non-assignees and expired claims", async () => {
    const { agent, other, task } = await world();
    expect((await rejects(deliverTask(task.id, agent.id, "x"))).code).toBe("TASK_NOT_CLAIMED");
    await claimTask(task.id, agent.id, 50);
    const notAssignee = await rejects(deliverTask(task.id, other.id, "x"));
    expect(notAssignee.code).toBe("NOT_TASK_ASSIGNEE");
    expect(notAssignee.status).toBe(403);
    await ageClaim(task.id, 25);
    expect((await rejects(deliverTask(task.id, agent.id, "x"))).code).toBe("CLAIM_EXPIRED");
    expect(await db.select().from(deliverables)).toHaveLength(0);
  });

  it("returns TASK_NOT_FOUND for unknown tasks", async () => {
    const { agent } = await world();
    expect((await rejects(deliverTask(9999, agent.id, "x"))).code).toBe("TASK_NOT_FOUND");
  });
});

describe("requestRevision", () => {
  it("only the poster, and only from DELIVERED", async () => {
    const { agent, poster, operator, task } = await world();
    await claimTask(task.id, agent.id, 50);
    expect((await rejects(requestRevision(task.id, poster.id, "f"))).code).toBe("TASK_NOT_DELIVERED");
    await deliverTask(task.id, agent.id, "v1");
    expect((await rejects(requestRevision(task.id, operator.id, "f"))).code).toBe("FORBIDDEN");
    expect((await rejects(requestRevision(9999, poster.id, "f"))).code).toBe("TASK_NOT_FOUND");
  });

  it("returns the task to CLAIMED, marks the deliverable, resets the TTL, and allows revision 2", async () => {
    const { agent, poster, task } = await world();
    await claimTask(task.id, agent.id, 50);
    await deliverTask(task.id, agent.id, "v1");
    await ageClaim(task.id, 23);
    await requestRevision(task.id, poster.id, "please fix");

    const t = (await db.select().from(tasks).where(eq(tasks.id, task.id)))[0];
    expect(t.status).toBe("CLAIMED");
    expect(Date.now() - t.claimedAt!.getTime()).toBeLessThan(60_000);

    await deliverTask(task.id, agent.id, "v2");
    const d = await db.select().from(deliverables).where(eq(deliverables.taskId, task.id)).orderBy(deliverables.revisionNumber);
    expect(d.map(x => [x.revisionNumber, x.status, x.feedback])).toEqual([
      [1, "REVISION_REQUESTED", "please fix"],
      [2, "DELIVERED", null],
    ]);
  });
});

describe("acceptTask + reputation", () => {
  it("credits the agent the task budget exactly once", async () => {
    const { agent, poster, task } = await world();
    await claimTask(task.id, agent.id, 50);
    await deliverTask(task.id, agent.id, "done");
    const res = await acceptTask(task.id, poster.id);
    expect(res).toEqual({ task_id: task.id, status: "ACCEPTED", credited_amount: 100 });
    expect(await statusOf(task.id)).toBe("ACCEPTED");

    const again = await rejects(acceptTask(task.id, poster.id));
    expect(again.code).toBe("TASK_ALREADY_ACCEPTED");

    const rep = await getAgentReputation(agent.id);
    expect(rep.reputation).toBe(100);
    expect(typeof rep.reputation).toBe("number");
  });

  it("forbids non-posters and undelivered tasks", async () => {
    const { agent, poster, operator, task } = await world();
    expect((await rejects(acceptTask(task.id, poster.id))).code).toBe("TASK_NOT_DELIVERED");
    await claimTask(task.id, agent.id, 50);
    await deliverTask(task.id, agent.id, "done");
    expect((await rejects(acceptTask(task.id, operator.id))).code).toBe("FORBIDDEN");
    expect(await statusOf(task.id)).toBe("DELIVERED");
    expect((await getAgentReputation(agent.id)).reputation).toBe(0);
  });

  it("sums multiple rewards", async () => {
    const { agent, poster } = await world();
    for (const budget of [30, 70]) {
      const t = await seedTask(poster.id, budget);
      await claimTask(t.id, agent.id, 1);
      await deliverTask(t.id, agent.id, "d");
      await acceptTask(t.id, poster.id);
    }
    expect((await getAgentReputation(agent.id)).reputation).toBe(100);
  });
});

describe("updateTaskStatus (cancel)", () => {
  it("lets the poster cancel an OPEN task", async () => {
    const { poster, task } = await world();
    const t = await updateTaskStatus(task.id, poster.id, "CANCELED");
    expect(t.status).toBe("CANCELED");
  });

  it("rejects other statuses, non-posters, unknown tasks and cancelling a claimed task", async () => {
    const { agent, poster, operator, task } = await world();
    expect((await rejects(updateTaskStatus(task.id, poster.id, "ACCEPTED"))).code).toBe("INVALID_STATE_TRANSITION");
    expect((await rejects(updateTaskStatus(task.id, operator.id, "CANCELED"))).code).toBe("FORBIDDEN");
    expect((await rejects(updateTaskStatus(9999, poster.id, "CANCELED"))).code).toBe("TASK_NOT_FOUND");
    await claimTask(task.id, agent.id, 50);
    const err = await rejects(updateTaskStatus(task.id, poster.id, "CANCELED"));
    expect(err.code).toBe("INVALID_STATE_TRANSITION");
    expect(err.status).toBe(409);
  });
});
