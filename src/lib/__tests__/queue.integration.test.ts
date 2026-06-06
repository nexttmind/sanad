import { resetSupabaseMock, supabase } from "@/integrations/supabase/__mocks__/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client");

import {
  fetchQueuePosition,
  formatQueueNumber,
  formatWaitDuration,
  isPendingStatus,
  PENDING_STATUSES,
} from "@/lib/queue";

describe("queue supabase flows", () => {
  beforeEach(() => {
    resetSupabaseMock();
  });

  it("fetchQueuePosition calls queue_position RPC and parses response", async () => {
    supabase.rpc.mockResolvedValue({
      data: {
        queue_number: 42,
        position_among_pending: 3,
        pending_total: 120,
      },
      error: null,
    });

    const pos = await fetchQueuePosition("req-abc");
    expect(pos).toEqual({
      queue_number: 42,
      position_among_pending: 3,
      pending_total: 120,
    });
    expect(supabase.rpc).toHaveBeenCalledWith("queue_position", { _request_id: "req-abc" });
  });

  it("fetchQueuePosition returns null when RPC payload is empty", async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });
    expect(await fetchQueuePosition("req-missing")).toBeNull();
  });

  it("fetchQueuePosition returns null when RPC payload is an array", async () => {
    supabase.rpc.mockResolvedValue({ data: [], error: null });
    expect(await fetchQueuePosition("req-bad")).toBeNull();
  });

  it("fetchQueuePosition propagates RPC errors", async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: "not found" } });
    await expect(fetchQueuePosition("req-err")).rejects.toEqual({ message: "not found" });
  });
});

describe("queue helpers", () => {
  it("isPendingStatus matches PRD pending statuses only", () => {
    for (const status of PENDING_STATUSES) {
      expect(isPendingStatus(status)).toBe(true);
    }
    expect(isPendingStatus("approved")).toBe(false);
    expect(isPendingStatus("distributed")).toBe(false);
    expect(isPendingStatus("rejected")).toBe(false);
  });

  it("formatQueueNumber zero-pads and handles missing values", () => {
    expect(formatQueueNumber(1)).toBe("#000001");
    expect(formatQueueNumber(undefined)).toBe("—");
  });

  it("formatWaitDuration prefers days, then hours, then minutes", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString();
    expect(formatWaitDuration(threeDaysAgo)).toContain("3");

    const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000).toISOString();
    expect(formatWaitDuration(twoHoursAgo)).toContain("2");

    const fiveMinsAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(formatWaitDuration(fiveMinsAgo)).toContain("5");

    expect(formatWaitDuration(null)).toBe("—");
  });
});
