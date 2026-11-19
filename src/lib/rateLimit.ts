import { NextRequest } from "next/server";
import { AppError } from "@/lib/errors";

/**
 * Simple fixed-window in-memory rate limiter.
 * NOTE: state is per server instance; use a shared store (e.g. Redis) when running multiple instances.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0].trim() : req.headers.get("x-real-ip")) || "unknown";
}

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  if (buckets.size > 10_000) {
    buckets.forEach((v, k) => { if (v.resetAt <= now) buckets.delete(k); });
  }
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  b.count++;
  if (b.count > limit) {
    throw new AppError(
      "RATE_LIMITED",
      "Too many requests.",
      `Retry in ${Math.ceil((b.resetAt - now) / 1000)} seconds.`,
      undefined,
      429
    );
  }
}
