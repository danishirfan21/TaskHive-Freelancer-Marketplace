import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/db", async () => (await import("@/test/mockDb")).mockDbModule());

import * as dbModule from "@/db";
import { resetDb } from "@/test/testDb";
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
    // NOTE: handlers must not touch the shared `db` here: PGlite has a single connection, so a
    // query outside the open transaction would wait forever (a real pool would use another connection).
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
});
