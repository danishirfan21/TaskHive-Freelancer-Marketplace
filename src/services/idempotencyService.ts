import { db } from "@/db";
import { idempotencyKeys } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ApiResponse } from "@/lib/response";
import { IdempotencyError } from "@/lib/errors";

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
      throw new IdempotencyError("IDEMPOTENCY_CONFLICT", "Idempotency key already used for different operation.");
    }
    return existing.responseJson as ApiResponse<T>;
  }

  // 2. Execute business logic
  const response = await handler();

  // 3. Store the result
  await db.insert(idempotencyKeys).values({
    key,
    endpoint,
    responseJson: response,
  });

  return response;
}
