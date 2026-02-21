import { db } from "@/db";
import { idempotencyKeys } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ApiResponse } from "./response";

export async function withIdempotency<T>(
  key: string,
  endpoint: string,
  handler: () => Promise<ApiResponse<T>>
): Promise<ApiResponse<T>> {
  // 1. Check for existing key
  const existing = await db.query.idempotencyKeys.findFirst({
    where: eq(idempotencyKeys.key, key),
  });

  if (existing) {
    if (existing.endpoint !== endpoint) {
      throw new Error("IDEMPOTENCY_CONFLICT");
    }
    return existing.responseJson as ApiResponse<T>;
  }

  // 2. Execute business logic
  const response = await handler();

  // 3. Store the result ONLY IF it was a success or a specific replayable error
  // For Day 5, we store everything to ensure complete determinism
  await db.insert(idempotencyKeys).values({
    key,
    endpoint,
    responseJson: response,
  });

  return response;
}
