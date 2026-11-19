// Used via: vi.mock("@/db", async () => (await import("@/test/mockDb")).mockDbModule());
import { createTestDb } from "./testDb";

export async function mockDbModule() {
  const t = await createTestDb();
  return { db: t.db, pgClient: t.client };
}
