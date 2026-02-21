import { db } from "@/db";
import { tasks, taskStatusEnum } from "@/db/schema";
import { eq, and, gt, sql } from "drizzle-orm";
import { z } from "zod";

export const CreateTaskSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  budget: z.number().int().positive(),
});

export const UpdateTaskStatusSchema = z.object({
  status: z.enum([
    "OPEN",
    "CLAIMED",
    "DELIVERED",
    "ACCEPTED",
    "REVISION_REQUESTED",
    "CANCELED",
  ]),
});

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  OPEN: ["CANCELED"],
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
