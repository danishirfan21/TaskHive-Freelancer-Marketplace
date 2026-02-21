import { db } from "@/db";
import { tasks, taskStatusEnum, claims, deliverables, creditTransactions } from "@/db/schema";
import { eq, and, gt, sql, desc } from "drizzle-orm";
import { z } from "zod";

export const CreateTaskSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  budget: z.number().int().positive(),
});

export const UpdateTaskStatusSchema = z.object({
  status: taskStatusEnum.enumValues ? z.enum(taskStatusEnum.enumValues) : z.string(),
});

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  OPEN: ["CLAIMED", "CANCELED"],
  CLAIMED: ["DELIVERED"],
  DELIVERED: ["ACCEPTED", "CLAIMED"], // CLAIMED here is for revision path
};

export function validateTaskTransition(current: string, next: string) {
  if (current === next) return true;
  const allowed = ALLOWED_TRANSITIONS[current] || [];
  return allowed.includes(next);
}

export async function createTask(posterId: number, data: z.infer<typeof CreateTaskSchema>) {
  const [task] = await db
    .insert(tasks)
    .values({
      posterId,
      ...data,
      status: "OPEN",
    })
    .returning();

  return task;
}

export async function browseOpenTasks(data: { limit?: number; cursor?: number }) {
  const limit = Math.min(Math.max(data.limit || 20, 1), 50);
  const cursor = data.cursor;

  const result = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      budget: tasks.budget,
      createdAt: tasks.createdAt,
    })
    .from(tasks)
    .where(
      and(
        eq(tasks.status, "OPEN"),
        cursor ? gt(tasks.id, cursor) : undefined
      )
    )
    .orderBy(tasks.id)
    .limit(limit + 1);

  const hasNextPage = result.length > limit;
  const items = hasNextPage ? result.slice(0, limit) : result;
  const nextCursor = hasNextPage ? items[items.length - 1].id : null;

  return {
    tasks: items,
    nextCursor,
  };
}

export async function getTaskById(id: number) {
  const [task] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, id))
    .limit(1);

  return task || null;
}

export async function claimTask(taskId: number, agentId: number, proposedCredits: number) {
  return await db.transaction(async (tx) => {
    const [updatedTask] = await tx
      .update(tasks)
      .set({
        status: "CLAIMED",
        claimedBy: agentId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tasks.id, taskId),
          eq(tasks.status, "OPEN")
        )
      )
      .returning();

    if (!updatedTask) {
      const task = await tx.query.tasks.findFirst({
        where: eq(tasks.id, taskId)
      });

      if (!task) throw new Error("TASK_NOT_FOUND");
      if (task.status !== "OPEN") throw new Error("TASK_NOT_OPEN");
      throw new Error("INTERNAL_ERROR");
    }

    if (proposedCredits > updatedTask.budget) {
      throw new Error("INVALID_PROPOSED_CREDITS");
    }

    await tx.insert(claims).values({
      taskId,
      agentId,
      proposedCredits,
      status: "CLAIMED"
    });

    return {
      task_id: taskId,
      status: "CLAIMED",
      claimed_by: agentId,
      proposed_credits: proposedCredits
    };
  });
}

export async function deliverTask(taskId: number, agentId: number, content: string) {
  return await db.transaction(async (tx) => {
    const task = await tx.query.tasks.findFirst({
      where: eq(tasks.id, taskId)
    });

    if (!task) throw new Error("TASK_NOT_FOUND");
    if (task.status !== "CLAIMED") throw new Error("TASK_NOT_CLAIMED");
    if (task.claimedBy !== agentId) throw new Error("NOT_TASK_ASSIGNEE");

    const latestDeliverable = await tx.query.deliverables.findFirst({
      where: eq(deliverables.taskId, taskId),
      orderBy: desc(deliverables.revisionNumber)
    });

    const revisionNumber = latestDeliverable ? latestDeliverable.revisionNumber + 1 : 1;

    const [deliverable] = await tx.insert(deliverables).values({
      taskId,
      agentId,
      content,
      revisionNumber,
      status: "DELIVERED"
    }).returning();

    await tx.update(tasks)
      .set({
        status: "DELIVERED",
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    return {
      task_id: taskId,
      deliverable_id: deliverable.id,
      status: "DELIVERED"
    };
  });
}

export async function requestRevision(taskId: number, posterId: number) {
  return await db.transaction(async (tx) => {
    const task = await tx.query.tasks.findFirst({
      where: eq(tasks.id, taskId)
    });

    if (!task) throw new Error("TASK_NOT_FOUND");
    if (task.posterId !== posterId) throw new Error("FORBIDDEN");
    if (task.status !== "DELIVERED") throw new Error("TASK_NOT_DELIVERED");

    await tx.update(tasks)
      .set({
        status: "CLAIMED",
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    await tx.update(deliverables)
      .set({ status: "REVISION_REQUESTED" })
      .where(and(
        eq(deliverables.taskId, taskId),
        eq(deliverables.status, "DELIVERED")
      ));

    return {
      task_id: taskId,
      status: "CLAIMED"
    };
  });
}

export async function acceptTask(taskId: number, posterId: number) {
  return await db.transaction(async (tx) => {
    const task = await tx.query.tasks.findFirst({
      where: eq(tasks.id, taskId)
    });

    if (!task) throw new Error("TASK_NOT_FOUND");
    if (task.posterId !== posterId) throw new Error("FORBIDDEN");
    if (task.status === "ACCEPTED") throw new Error("TASK_ALREADY_ACCEPTED");
    if (task.status !== "DELIVERED") throw new Error("TASK_NOT_DELIVERED");

    const deliverable = await tx.query.deliverables.findFirst({
      where: and(
        eq(deliverables.taskId, taskId),
        eq(deliverables.status, "DELIVERED")
      ),
      orderBy: desc(deliverables.revisionNumber)
    });

    if (!deliverable) throw new Error("DELIVERABLE_NOT_FOUND");

    await tx.update(tasks)
      .set({
        status: "ACCEPTED",
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    await tx.update(deliverables)
      .set({ status: "ACCEPTED" })
      .where(eq(deliverables.id, deliverable.id));

    await tx.insert(creditTransactions).values({
      agentId: task.claimedBy!,
      type: "WORK_REWARD",
      amount: task.budget,
      taskId: taskId
    });

    return {
      task_id: taskId,
      status: "ACCEPTED",
      credited_amount: task.budget
    };
  });
}

export async function updateTaskStatus(taskId: number, userId: number, nextStatus: string) {
  const task = await getTaskById(taskId);
  if (!task) throw new Error("TASK_NOT_FOUND");
  if (task.posterId !== userId) throw new Error("FORBIDDEN");

  if (!validateTaskTransition(task.status, nextStatus)) {
    throw new Error("INVALID_STATE_TRANSITION");
  }

  const [updated] = await db
    .update(tasks)
    .set({
      status: nextStatus as any,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId))
    .returning();

  return updated;
}
