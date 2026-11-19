import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });

/** A transaction handle, as passed to the callback of `db.transaction`. */
export type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
/** Either the pool-backed db or an open transaction; services accept both. */
export type DbExecutor = typeof db | DbTx;
