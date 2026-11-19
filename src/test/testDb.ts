import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFileSync } from "fs";
import path from "path";
import * as schema from "@/db/schema";

/**
 * In-process Postgres (PGlite) with the real schema, for service tests.
 * src/test/schema.sql is generated from src/db/schema.ts via `drizzle-kit generate`;
 * regenerate it when the schema changes.
 */
export async function createTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  const ddl = readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
  for (const stmt of ddl.split("--> statement-breakpoint")) {
    if (stmt.trim()) await client.exec(stmt);
  }
  return { db, client };
}

export async function resetDb(client: PGlite) {
  await client.exec(
    `TRUNCATE idempotency_keys, credit_transactions, deliverables, claims, tasks, agent_api_keys, agents, users RESTART IDENTITY CASCADE`
  );
}
