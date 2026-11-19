import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/db", async () => (await import("@/test/mockDb")).mockDbModule());

import * as dbModule from "@/db";
import { resetDb } from "@/test/testDb";
import { rejects } from "@/test/helpers";
import { registerUser, loginUser, RegisterSchema } from "./authService";

const client = (dbModule as any).pgClient;

beforeEach(() => resetDb(client));

describe("registerUser", () => {
  it("stores a lowercased email and a bcrypt hash, never the plaintext", async () => {
    const user = await registerUser({ email: "  Alice@Example.COM ", password: "password123" });
    expect(user.email).toBe("alice@example.com");
    const rows = await client.query("SELECT password_hash FROM users");
    expect(rows.rows[0].password_hash).not.toBe("password123");
    expect(rows.rows[0].password_hash).toMatch(/^\$2[aby]\$/);
  });

  it("rejects a duplicate email regardless of case (unique violation 23505)", async () => {
    await registerUser({ email: "a@test.com", password: "password123" });
    const err = await rejects(registerUser({ email: "A@TEST.com", password: "password123" }));
    expect(err.code).toBe("23505");
  });
});

describe("RegisterSchema", () => {
  it("requires a valid email and an 8+ char password", () => {
    expect(RegisterSchema.safeParse({ email: "nope", password: "password123" }).success).toBe(false);
    expect(RegisterSchema.safeParse({ email: "a@b.com", password: "short" }).success).toBe(false);
    expect(RegisterSchema.safeParse({ email: "a@b.com", password: "longenough" }).success).toBe(true);
  });
});

describe("loginUser", () => {
  beforeEach(async () => {
    await registerUser({ email: "bob@test.com", password: "password123" });
  });

  it("returns id and email for correct credentials", async () => {
    const u = await loginUser({ email: "bob@test.com", password: "password123" });
    expect(u).toEqual({ id: expect.any(Number), email: "bob@test.com" });
  });

  it("matches email case-insensitively", async () => {
    expect(await loginUser({ email: " BOB@Test.com", password: "password123" })).not.toBeNull();
  });

  it("returns null for a wrong password or unknown user", async () => {
    expect(await loginUser({ email: "bob@test.com", password: "wrongpass" })).toBeNull();
    expect(await loginUser({ email: "ghost@test.com", password: "password123" })).toBeNull();
  });

  it("still logs in legacy accounts stored with mixed-case emails", async () => {
    await client.query(`INSERT INTO users (email, password_hash) SELECT 'Legacy@Test.com', password_hash FROM users LIMIT 1`);
    expect(await loginUser({ email: "legacy@test.com", password: "password123" })).not.toBeNull();
  });
});
