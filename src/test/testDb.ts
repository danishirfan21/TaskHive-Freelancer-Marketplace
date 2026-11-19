import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFileSync, readdirSync } from "fs";
import path from "path";
import * as schema from "@/db/schema";

/**
 * In-process Postgres (PGlite) built from the real migrations in src/db/migrations,
 * so tests also catch a migration that has drifted from src/db/schema.ts.
 */
export async function createTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  const dir = path.join(__dirname, "..", "db", "migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    const ddl = readFileSync(path.join(dir, file), "utf-8");
    for (const stmt of ddl.split("--> statement-breakpoint")) {
      if (stmt.trim()) await client.exec(stmt);
    }
  }
  return { db, client };
}

export async function resetDb(client: PGlite) {
  await client.exec(
    `TRUNCATE idempotency_keys, credit_transactions, deliverables, claims, tasks, agent_api_keys, agents, users RESTART IDENTITY CASCADE`
  );
}
