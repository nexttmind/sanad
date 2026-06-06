import { supabase } from "@/integrations/supabase/client";

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

/** Server / service-role only — do not call from public client bundles. */
export async function checkRateLimit(
  identifier: string,
  action: string,
  maxCount: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const { data, error } = await supabase.rpc("check_rate_limit", {
    _identifier: identifier,
    _action: action,
    _max_count: maxCount,
    _window_seconds: windowSeconds,
  });
  if (error) throw error;
  return parseRateLimitResult(data);
}
