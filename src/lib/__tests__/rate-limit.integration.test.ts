import { resetSupabaseMock, supabase } from "@/integrations/supabase/__mocks__/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client");

import { parseRateLimitResult } from "@/lib/rate-limit";
import { checkRateLimit } from "@/lib/rate-limit.server";

describe("rate-limit supabase flows", () => {
  beforeEach(() => {
    resetSupabaseMock();
  });

  it("checkRateLimit calls check_rate_limit RPC with window params", async () => {
    supabase.rpc.mockResolvedValue({
      data: { allowed: true, remaining: 2, retry_after_seconds: 0 },
      error: null,
    });

    const result = await checkRateLimit("ip:abc", "track_lookup", 3, 3600);
    expect(result).toEqual({ allowed: true, remaining: 2, retryAfterSeconds: 0 });
    expect(supabase.rpc).toHaveBeenCalledWith("check_rate_limit", {
      _identifier: "ip:abc",
      _action: "track_lookup",
      _max_count: 3,
      _window_seconds: 3600,
    });
  });

  it("parseRateLimitResult handles blocked response", () => {
    expect(
      parseRateLimitResult({
        allowed: false,
        remaining: 0,
        retry_after_seconds: 120,
      }),
    ).toEqual({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 120,
    });
  });

  it("checkRateLimit propagates RPC errors", async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: "denied" } });
    await expect(checkRateLimit("x", "y", 1, 60)).rejects.toEqual({ message: "denied" });
  });
});
