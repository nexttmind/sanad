import { resetSupabaseMock, supabase } from "@/integrations/supabase/__mocks__/client";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client");

import { fetchTrackHistory, lookupTrackRequest } from "@/lib/track-request";

describe("track-request supabase flows", () => {
  beforeEach(() => {
    resetSupabaseMock();
  });

  it("lookupTrackRequest invokes track-request-proxy edge function", async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: {
        ok: true,
        track: {
          reference_code: "SND-123",
          full_name: "Ali",
          phone_masked: "••• ••• 456",
          governorate: "صور",
          district: null,
          town: "تير Harfa",
          family_size: 5,
          status: "submitted",
          distribution_date: null,
          distribution_location: null,
          created_at: "2026-06-01T10:00:00.000Z",
          updated_at: "2026-06-01T10:00:00.000Z",
        },
        history: [{ to_status: "submitted", changed_at: "2026-06-01T10:00:00.000Z" }],
        queue: {
          queue_number: 42,
          position_among_pending: 3,
          pending_total: 120,
        },
      },
      error: null,
    });

    const result = await lookupTrackRequest("SND-123", "70123456");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.track?.reference_code).toBe("SND-123");
      expect(result.history).toHaveLength(1);
      expect(result.queue).toEqual({
        queue_number: 42,
        position_among_pending: 3,
        pending_total: 120,
      });
    }
    expect(supabase.functions.invoke).toHaveBeenCalledWith("track-request-proxy", {
      body: { code: "SND-123", phone: "70123456" },
    });
  });

  it("lookupTrackRequest omits queue when proxy returns null", async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: {
        ok: true,
        track: {
          reference_code: "SND-999",
          full_name: "Sara",
          phone_masked: "••• ••• 789",
          governorate: null,
          district: null,
          town: null,
          family_size: 3,
          status: "approved",
          distribution_date: null,
          distribution_location: null,
          created_at: "2026-06-01T10:00:00.000Z",
          updated_at: "2026-06-03T10:00:00.000Z",
        },
        history: [],
        queue: null,
      },
      error: null,
    });

    const result = await lookupTrackRequest("SND-999", "70987654");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.queue).toBeNull();
    }
  });

  it("lookupTrackRequest surfaces rate limit message", async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: {
        ok: false,
        message: "تجاوزت الحد المسموح لعمليات التتبّع — حاول لاحقاً.",
        retry_after_seconds: 900,
      },
      error: null,
    });

    const result = await lookupTrackRequest("SND-123", "70123456");
    expect(result).toEqual({
      ok: false,
      message: "تجاوزت الحد المسموح لعمليات التتبّع — حاول لاحقاً.",
      rateLimited: true,
    });
  });

  it("fetchTrackHistory returns history from proxy lookup", async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: {
        ok: true,
        track: null,
        history: [
          { to_status: "submitted", changed_at: "2026-06-01T10:00:00.000Z" },
          { to_status: "approved", changed_at: "2026-06-03T14:00:00.000Z" },
        ],
      },
      error: null,
    });

    const history = await fetchTrackHistory("SND-123", "70123456");
    expect(history).toHaveLength(2);
  });

  it("fetchTrackHistory returns empty array when proxy fails", async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: { ok: false, message: "not found" },
      error: null,
    });
    const history = await fetchTrackHistory("BAD", "000");
    expect(history).toEqual([]);
  });
});
