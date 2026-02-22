import { db } from "@/db";
import { idempotencyKeys } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { ApiResponse } from "@/lib/response";
import { IdempotencyError, DbErrors } from "@/lib/errors";

/**
 * Race-condition safe idempotency wrapper.
 * Uses a two-phase transactional approach to ensure "exactly-once" execution.
 * 
 * Concurrency Guarantees:
 * 1. INSERT blocks concurrent requests on the UNIQUE index lock.
 * 2. ONLY ONE winner proceeds to execute the handler.
 * 3. Losers wake up after the winner commits and replay the stored responseJson.
 * 4. If the winner fails (throws), the transaction rolls back, and a loser wins the next round.
 */
export async function withIdempotency<T>(
  key: string,
  endpoint: string,
  handler: () => Promise<ApiResponse<T>>
): Promise<ApiResponse<T>> {
  try {
    return await db.transaction(async (tx) => {
      // 1. Check for existing (completed) record
      const existing = await tx.query.idempotencyKeys.findFirst({
        where: eq(idempotencyKeys.key, key),
      });

      if (existing) {
        if (existing.endpoint !== endpoint) {
          throw new IdempotencyError("IDEMPOTENCY_CONFLICT", "Idempotency key already used for different operation.");
        }
        
        // If responseJson is null, another process is currently working on it.
        // We take a FOR UPDATE lock on the existing row to block until it's finished.
        if (existing.responseJson === null) {
          await tx.execute(sql`SELECT 1 FROM idempotency_keys WHERE key = ${key} FOR UPDATE`);
          
          const refreshed = await tx.query.idempotencyKeys.findFirst({
            where: eq(idempotencyKeys.key, key),
          });
          
          if (refreshed?.responseJson) {
            return refreshed.responseJson as ApiResponse<T>;
          }
          // If still null or gone, the owner rolled back. We continue to try our own insert.
          // Note: A unique violation on the subsequent INSERT is handled by the outer catch.
        } else {
          return existing.responseJson as ApiResponse<T>;
        }
      }

      // 2. Atomic claim via placeholder insert
      // Concurrent requests will block here waiting for this transaction to commit/rollback.
      await tx.insert(idempotencyKeys).values({
        key,
        endpoint,
        responseJson: null,
      });

      // 3. Execution (inside the transaction to ensure rollback on failure)
      const response = await handler();

      // 4. Update with final result
      await tx.update(idempotencyKeys)
        .set({ responseJson: response })
        .where(eq(idempotencyKeys.key, key));

      return response;
    });
  } catch (error: any) {
    // 5. Handle unblocking conflict
    // If we was blocked on INSERT and the winner committed, we get 23505.
    if (error.code === DbErrors.UNIQUE_VIOLATION) {
      const result = await db.query.idempotencyKeys.findFirst({
        where: eq(idempotencyKeys.key, key),
      });
      if (result?.responseJson) {
        return result.responseJson as ApiResponse<T>;
      }
    }
    throw error;
  }
}
