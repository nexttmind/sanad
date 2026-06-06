import { resetSupabaseMock, supabase } from "@/integrations/supabase/__mocks__/client";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client");

import { fetchTrackHistory } from "@/lib/track-request";

describe("track-request supabase flows", () => {
  beforeEach(() => {
    resetSupabaseMock();
  });

  it("fetchTrackHistory returns RPC rows", async () => {
    supabase.rpc.mockResolvedValue({
      data: [
        { to_status: "submitted", changed_at: "2026-06-01T10:00:00.000Z" },
        { to_status: "approved", changed_at: "2026-06-03T14:00:00.000Z" },
      ],
      error: null,
    });

    const history = await fetchTrackHistory("SND-123", "70123456");
    expect(history).toHaveLength(2);
    expect(supabase.rpc).toHaveBeenCalledWith("track_request_history", {
      _code: "SND-123",
      _phone: "70123456",
    });
  });

  it("fetchTrackHistory returns empty array on RPC error", async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: "not found" } });
    const history = await fetchTrackHistory("BAD", "000");
    expect(history).toEqual([]);
  });
});
