import { db } from "@/db";
import { tasks, claims, deliverables, creditTransactions } from "@/db/schema";
import { eq, and, gt, desc, asc, or, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { AppError, StateError, ValidationError, AuthError } from "@/lib/errors";
import { assertTransition } from "@/domain/taskStateMachine";

export const CreateTaskSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  budget: z.number().int().positive(),
});

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
  const expiryThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);

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
        or(
          eq(tasks.status, "OPEN"),
          and(
            eq(tasks.status, "CLAIMED"),
            lt(tasks.claimedAt, expiryThreshold)
          )
        ),
        cursor != null ? gt(tasks.id, cursor) : undefined
      )
    )
    .orderBy(asc(tasks.id))
    .limit(limit + 1);

  const hasNextPage = result.length > limit;
  const items = hasNextPage ? result.slice(0, limit) : result;
  const nextCursorId = hasNextPage ? items[items.length - 1].id : null;
  const nextCursor = nextCursorId ? Buffer.from(nextCursorId.toString()).toString("base64") : null;

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
  const expiryThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);

  return await db.transaction(async (tx) => {
    const [updatedTask] = await tx
      .update(tasks)
      .set({
        status: "CLAIMED",
        claimedBy: agentId,
        claimedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tasks.id, taskId),
          or(
            eq(tasks.status, "OPEN"),
            and(
              eq(tasks.status, "CLAIMED"),
              lt(tasks.claimedAt, expiryThreshold)
            )
          )
        )
      )
      .returning();

    if (!updatedTask) {
      const task = await tx.query.tasks.findFirst({
        where: eq(tasks.id, taskId)
      });

      if (!task) throw new AppError("TASK_NOT_FOUND", "Task not found", undefined, undefined, 404);
      throw new StateError("TASK_NOT_OPEN", `Task ${taskId} is no longer OPEN or its claim has not expired.`, "Refresh open tasks and select another.", { taskId }, 409, ["BROWSE_TASKS"]);
    }

    if (proposedCredits > updatedTask.budget) {
      throw new ValidationError("INVALID_PROPOSED_CREDITS", "Proposed credits exceed budget", "Lower your bid", undefined, 400, ["BROWSE_TASKS"]);
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

    if (!task) throw new AppError("TASK_NOT_FOUND", "Task not found", undefined, undefined, 404);
    if (task.status !== "CLAIMED") throw new StateError("TASK_NOT_CLAIMED", "Task is not in CLAIMED state.", "Wait for the task to be claimed.", undefined, 409, ["BROWSE_TASKS"]);
    if (task.claimedBy !== agentId) throw new AuthError("NOT_TASK_ASSIGNEE", "You are not the assignee of this task.", "Only the agent who claimed the task can deliver it.", 403, ["BROWSE_TASKS"]);

    const CLAIM_TTL_MS = 24 * 60 * 60 * 1000;
    if (task.claimedAt) {
      const claimedAt = new Date(task.claimedAt);
      const diff = Date.now() - claimedAt.getTime();
      if (diff > CLAIM_TTL_MS) {
        throw new StateError("CLAIM_EXPIRED", "Your claim on this task has expired.", "The 24-hour limit was exceeded. Re-claim the task if available.", undefined, 409, ["BROWSE_TASKS"]);
      }
    }

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

export async function requestRevision(taskId: number, posterId: number, feedback?: string) {
  return await db.transaction(async (tx) => {
    const task = await tx.query.tasks.findFirst({
      where: eq(tasks.id, taskId)
    });

    if (!task) throw new AppError("TASK_NOT_FOUND", "Task not found", undefined, undefined, 404);
    if (task.posterId !== posterId) throw new AuthError("FORBIDDEN", "Only the task poster can request revisions.", undefined, 403);
    if (task.status !== "DELIVERED") throw new StateError("TASK_NOT_DELIVERED", "Task must be in DELIVERED state to request revision.", undefined, undefined, 409);

    await tx.update(tasks)
      .set({
        status: "CLAIMED",
        claimedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    await tx.update(deliverables)
      .set({ 
        status: "REVISION_REQUESTED",
        feedback: feedback || null
      })
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

    if (!task) throw new AppError("TASK_NOT_FOUND", "Task not found", undefined, undefined, 404);
    if (task.posterId !== posterId) throw new AuthError("FORBIDDEN", "Only the task poster can accept the delivery.", undefined, 403);
    if (task.status === "ACCEPTED") throw new StateError("TASK_ALREADY_ACCEPTED", "Task has already been accepted.", undefined, undefined, 409, ["BROWSE_TASKS"]);
    if (task.status !== "DELIVERED") throw new StateError("TASK_NOT_DELIVERED", "Task has not been delivered yet.", undefined, undefined, 409, ["BROWSE_TASKS"]);

    const deliverable = await tx.query.deliverables.findFirst({
      where: and(
        eq(deliverables.taskId, taskId),
        eq(deliverables.status, "DELIVERED")
      ),
      orderBy: desc(deliverables.revisionNumber)
    });

    if (!deliverable) throw new StateError("DELIVERABLE_NOT_FOUND", "No deliverable found to accept.", undefined, undefined, 409, ["BROWSE_TASKS"]);

    await tx.update(tasks)
      .set({
        status: "ACCEPTED",
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    await tx.update(deliverables)
      .set({ status: "ACCEPTED" })
      .where(eq(deliverables.id, deliverable.id));

    if (!task.claimedBy) {
      throw new StateError("TASK_NOT_CLAIMED", "Cannot accept a task that has no assignee.", undefined, undefined, 409);
    }

    await tx.insert(creditTransactions).values({
      agentId: task.claimedBy,
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
  if (nextStatus !== "CANCELED") {
    throw new ValidationError("INVALID_STATE_TRANSITION", "Direct status updates are only allowed for CANCELED.", "Use specialized endpoints for other transitions.");
  }
  const task = await getTaskById(taskId);
  if (!task) throw new AppError("TASK_NOT_FOUND", "Task not found", undefined, undefined, 404);
  if (task.posterId !== userId) throw new AuthError("FORBIDDEN", "Only the poster can update this task.", undefined, 403);

  assertTransition(task.status, nextStatus);

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


