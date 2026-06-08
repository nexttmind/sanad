export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function parseRateLimitResult(data: unknown): RateLimitResult {
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    allowed: row.allowed === true,
    remaining: Number(row.remaining ?? 0),
    retryAfterSeconds: Number(row.retry_after_seconds ?? 0),
  };
}
