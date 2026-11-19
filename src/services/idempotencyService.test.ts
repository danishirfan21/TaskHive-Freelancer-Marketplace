import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/db", async () => (await import("@/test/mockDb")).mockDbModule());

import * as dbModule from "@/db";
import { users } from "@/db/schema";
import { resetDb } from "@/test/testDb";
import { seedUser, seedAgent } from "@/test/helpers";
import { createTask, claimTask } from "./taskService";
import { rejects } from "@/test/helpers";
import { withIdempotency } from "./idempotencyService";
import { successResponse } from "@/lib/response";

const client = (dbModule as any).pgClient;

beforeEach(() => resetDb(client));

const respond = async (data: unknown) => (await successResponse(data).json()) as any;

describe("withIdempotency", () => {
  it("runs the handler once and replays the stored response for the same key + endpoint", async () => {
    const handler = vi.fn(async () => respond({ n: Math.random() }));
    const a = await withIdempotency("k1", "user:1:POST /x", handler);
    const b = await withIdempotency("k1", "user:1:POST /x", handler);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(b).toEqual(a);
  });

  it("scopes keys per caller/endpoint: the same raw key never replays another callers response", async () => {
    const a = await withIdempotency("shared", "user:1:POST /x", async () => respond({ owner: 1 }));
    const b = await withIdempotency("shared", "user:2:POST /x", async () => respond({ owner: 2 }));
    expect(a.data).toEqual({ owner: 1 });
    expect(b.data).toEqual({ owner: 2 });
  });

  it("does not store the raw client-supplied key", async () => {
    await withIdempotency("raw-key-value", "user:1:POST /x", async () => respond({}));
    const rows = await client.query("SELECT key FROM idempotency_keys");
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].key).not.toContain("raw-key-value");
  });

  it("rolls back the key when the handler throws, so a retry runs the handler again", async () => {
    const boom = await rejects(
      withIdempotency("k2", "user:1:POST /x", async () => {
        throw new Error("boom");
      })
    );
    expect(boom.message).toBe("boom");
    expect((await client.query("SELECT 1 FROM idempotency_keys")).rows).toHaveLength(0);

    const retry = await withIdempotency("k2", "user:1:POST /x", async () => respond({ ok: true }));
    expect(retry.data).toEqual({ ok: true });
  });

  it("commits handler writes and the stored response together", async () => {
    const poster = await seedUser();
    const res = await withIdempotency("k3", "user:1:POST /tasks", async (tx) => {
      const t = await createTask(poster.id, { title: "T", description: "D", budget: 5 }, tx);
      return respond(t);
    });
    expect((res.data as any).id).toBeDefined();
    expect((await client.query("SELECT 1 FROM tasks")).rows).toHaveLength(1);
    expect((await client.query("SELECT 1 FROM idempotency_keys WHERE response_json IS NOT NULL")).rows).toHaveLength(1);
  });

  it("rolls back handler writes made through the transaction when the handler throws", async () => {
    await expect(
      withIdempotency("k4", "user:1:POST /x", async (tx) => {
        await tx.insert(users).values({ email: "x@test.com", passwordHash: "h" });
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");
    expect((await client.query("SELECT 1 FROM users")).rows).toHaveLength(0);
    expect((await client.query("SELECT 1 FROM idempotency_keys")).rows).toHaveLength(0);
  });

  it("rolls back a service's own nested transaction (claim) when a later step fails", async () => {
    const poster = await seedUser();
    const agent = await seedAgent((await seedUser()).id);
    const task = (await client.query("INSERT INTO tasks (poster_id, title, description, budget) VALUES ($1,'t','d',10) RETURNING id", [poster.id])).rows[0];

    await expect(
      withIdempotency("k5", "agent:1:POST /claim", async (tx) => {
        await claimTask(task.id, agent.id, 5, tx);
        throw new Error("late failure");
      })
    ).rejects.toThrow("late failure");

    const row = (await client.query("SELECT status FROM tasks WHERE id = $1", [task.id])).rows[0];
    expect(row.status).toBe("OPEN");
    expect((await client.query("SELECT 1 FROM claims")).rows).toHaveLength(0);
  });

  it("does not cache a service error (e.g. a validation failure), so the caller can retry", async () => {
    const poster = await seedUser();
    const agent = await seedAgent((await seedUser()).id);
    const t = await createTask(poster.id, { title: "T", description: "D", budget: 10 });
    await expect(
      withIdempotency("k6", "agent:1:POST /claim", async (tx) => respond(await claimTask(t.id, agent.id, 999, tx)))
    ).rejects.toMatchObject({ code: "INVALID_PROPOSED_CREDITS" });
    const ok = await withIdempotency("k6", "agent:1:POST /claim", async (tx) => respond(await claimTask(t.id, agent.id, 5, tx)));
    expect(ok.data).toMatchObject({ status: "CLAIMED" });
  });
});
