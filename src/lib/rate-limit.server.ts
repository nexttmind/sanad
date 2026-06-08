import { supabase } from "@/integrations/supabase/client";
import { parseRateLimitResult, type RateLimitResult } from "@/lib/rate-limit";

/** Server / service-role only — blocked from client bundles via importProtection. */
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
