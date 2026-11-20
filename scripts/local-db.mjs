// Local Postgres for development: PGlite served over the Postgres wire protocol.
// Data persists in .pglite-data. Usage: npm run db:local, then point DATABASE_URL at
// postgresql://postgres:postgres@localhost:5433/postgres
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { readFileSync, readdirSync, existsSync } from "fs";
import path from "path";

const dataDir = ".pglite-data";
const fresh = !existsSync(dataDir);
const db = new PGlite(dataDir);
await db.waitReady;

if (fresh) {
  const dir = path.join("src", "db", "migrations");
  for (const file of readdirSync(dir).filter(f => f.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(path.join(dir, file), "utf-8").split("--> statement-breakpoint")) {
      if (stmt.trim()) await db.exec(stmt);
    }
  }
  console.log("Applied migrations to a new local database.");
}

const port = Number(process.env.LOCAL_DB_PORT ?? 5433);
const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1", maxConnections: 5 });
await server.start();
console.log(`Local Postgres ready on postgresql://postgres:postgres@localhost:${port}/postgres`);
process.on("SIGINT", async () => { await server.stop(); await db.close(); process.exit(0); });
