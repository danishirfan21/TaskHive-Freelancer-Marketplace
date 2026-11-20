import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Reuse one pool across hot reloads and per-route bundles in dev.
const globalForPool = globalThis as unknown as { __taskhivePool?: Pool };
const pool =
  globalForPool.__taskhivePool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    // Local dev DB (PGlite) is single-session, so it needs DB_POOL_MAX=1.
    max: Number(process.env.DB_POOL_MAX) || 10,
  });
if (process.env.NODE_ENV !== "production") globalForPool.__taskhivePool = pool;

export const db = drizzle(pool, { schema });

/** A transaction handle, as passed to the callback of `db.transaction`. */
export type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
/** Either the pool-backed db or an open transaction; services accept both. */
export type DbExecutor = typeof db | DbTx;
