/**
 * Typed fetch wrapper for TaskHive API.
 * - Automatically adds Idempotency-Key header for POST/PATCH/DELETE
 * - Parses the ApiResponse envelope
 * - Throws structured ApiError on error responses
 */

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public suggestion?: string,
    public status?: number,
    public safe_next_actions?: string[]
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const needsIdempotencyKey = ["POST", "PATCH", "DELETE"].includes(method);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (needsIdempotencyKey && !headers["Idempotency-Key"]) {
    headers["Idempotency-Key"] = crypto.randomUUID();
  }

  const res = await fetch(`/api/v1${path}`, {
    ...options,
    headers,
  });

  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new ApiError("PARSE_ERROR", "Server returned an invalid response.", undefined, res.status);
  }

  if (json.status === "ERROR" || !res.ok) {
    const err = json.error ?? {};
    throw new ApiError(
      err.code ?? "INTERNAL_ERROR",
      err.message ?? "An unexpected error occurred.",
      err.suggestion,
      res.status,
      err.safe_next_actions
    );
  }

  return json.data as T;
}
