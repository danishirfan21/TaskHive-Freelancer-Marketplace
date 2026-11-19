import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/db", async () => (await import("@/test/mockDb")).mockDbModule());

import * as dbModule from "@/db";
import { resetDb } from "@/test/testDb";
import { seedUser, rejects } from "@/test/helpers";
import { createAgent, createAgentApiKey, getVerifiedAgent } from "./agentService";

const client = (dbModule as any).pgClient;

beforeEach(() => resetDb(client));

describe("createAgent", () => {
  it("trims the name and links the operator", async () => {
    const u = await seedUser();
    const a = await createAgent(u.id, "  Bot  ");
    expect(a.name).toBe("Bot");
    expect(a.operatorUserId).toBe(u.id);
  });

  it("rejects names shorter than 2 chars after trimming", async () => {
    const u = await seedUser();
    const err = await rejects(createAgent(u.id, " a "));
    expect(err.code).toBe("VALIDATION_ERROR");
  });
});

describe("createAgentApiKey", () => {
  it("returns a thv_ key whose prefix is the first 12 chars, and stores only a hash", async () => {
    const u = await seedUser();
    const a = await createAgent(u.id, "Bot");
    const { plaintext, prefix } = await createAgentApiKey(a.id, u.id);
    expect(plaintext).toMatch(/^thv_/);
    expect(plaintext.startsWith(prefix)).toBe(true);
    expect(prefix).toHaveLength(12);
    const rows = await client.query("SELECT key_hash FROM agent_api_keys");
    expect(rows.rows[0].key_hash).not.toContain(plaintext);
  });

  it("returns AGENT_NOT_FOUND (404) for a missing agent", async () => {
    const u = await seedUser();
    const err = await rejects(createAgentApiKey(999, u.id));
    expect(err.code).toBe("AGENT_NOT_FOUND");
    expect(err.status).toBe(404);
  });

  it("forbids non-owners", async () => {
    const owner = await seedUser();
    const other = await seedUser();
    const a = await createAgent(owner.id, "Bot");
    const err = await rejects(createAgentApiKey(a.id, other.id));
    expect(err.code).toBe("AGENT_NOT_OWNER");
  });
});

describe("getVerifiedAgent", () => {
  it("resolves the agent for a valid key", async () => {
    const u = await seedUser();
    const a = await createAgent(u.id, "Bot");
    const { plaintext } = await createAgentApiKey(a.id, u.id);
    expect((await getVerifiedAgent(plaintext))?.id).toBe(a.id);
  });

  it("returns null for a wrong key sharing the same prefix", async () => {
    const u = await seedUser();
    const a = await createAgent(u.id, "Bot");
    const { plaintext } = await createAgentApiKey(a.id, u.id);
    expect(await getVerifiedAgent(plaintext.slice(0, 12) + "x".repeat(24))).toBeNull();
  });

  it("returns null for unknown keys and for revoked keys", async () => {
    const u = await seedUser();
    const a = await createAgent(u.id, "Bot");
    const { plaintext } = await createAgentApiKey(a.id, u.id);
    expect(await getVerifiedAgent("thv_nonexist_" + "y".repeat(24))).toBeNull();
    await client.query("UPDATE agent_api_keys SET revoked_at = now()");
    expect(await getVerifiedAgent(plaintext)).toBeNull();
  });
});
