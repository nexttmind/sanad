import { buildMockQuery } from "@/test/helpers/mock-builders";
import { resetSupabaseMock, supabase } from "@/integrations/supabase/__mocks__/client";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client");

import { completeDistribution, resolveRequestId } from "@/lib/distribution";

describe("distribution supabase flows", () => {
  beforeEach(() => {
    resetSupabaseMock();
  });

  it("resolveRequestId parses QR payload directly", async () => {
    const id = await resolveRequestId("SANAD:SND-1:req-abc:20260605");
    expect(id).toBe("req-abc");
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("resolveRequestId looks up reference code in database", async () => {
    supabase.from.mockReturnValue(buildMockQuery({ data: { id: "db-id" }, error: null }));
    const id = await resolveRequestId("SND-99999");
    expect(id).toBe("db-id");
  });

  it("completeDistribution rejects wrong PIN via verify_distribution_pin RPC", async () => {
    supabase.from.mockImplementation((table: string) => {
      if (table === "aid_requests") {
        return buildMockQuery({
          data: {
            id: "req-1",
            reference_code: "SND-1",
            full_name: "Test",
            family_size: 4,
            needs: [],
            status: "approved",
            qr_pin: "123456",
          },
          error: null,
        });
      }
      return buildMockQuery({ data: null, error: null });
    });
    supabase.rpc.mockResolvedValue({
      data: { ok: false, code: "bad_pin", message: "رمز PIN غير صحيح." },
      error: null,
    });

    const result = await completeDistribution({
      requestId: "req-1",
      pin: "000000",
      eventId: null,
      eventLocation: "صور",
      scannedBy: "admin-1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("bad_pin");
    expect(supabase.rpc).toHaveBeenCalledWith("verify_distribution_pin", {
      _request_id: "req-1",
      _pin: "000000",
    });
  });

  it("completeDistribution surfaces PIN lockout from RPC", async () => {
    supabase.from.mockImplementation((table: string) => {
      if (table === "aid_requests") {
        return buildMockQuery({
          data: {
            id: "req-1",
            reference_code: "SND-1",
            full_name: "Test",
            family_size: 4,
            needs: [],
            status: "approved",
            qr_pin: "123456",
          },
          error: null,
        });
      }
      return buildMockQuery({ data: null, error: null });
    });
    supabase.rpc.mockResolvedValue({
      data: {
        ok: false,
        code: "locked",
        message: "تم تعليق المحاولات — حاول بعد ١٥ دقيقة.",
      },
      error: null,
    });

    const result = await completeDistribution({
      requestId: "req-1",
      pin: "000000",
      eventId: null,
      eventLocation: "صور",
      scannedBy: "admin-1",
    });

    expect(result).toEqual({
      ok: false,
      code: "locked",
      message: "تم تعليق المحاولات — حاول بعد ١٥ دقيقة.",
    });
  });

  it("completeDistribution succeeds with valid PIN", async () => {
    let aidCall = 0;
    supabase.from.mockImplementation((table: string) => {
      if (table === "aid_requests") {
        aidCall++;
        if (aidCall === 1) {
          return buildMockQuery({
            data: {
              id: "req-1",
              reference_code: "SND-1",
              full_name: "Test",
              family_size: 4,
              needs: [],
              status: "approved",
              qr_pin: "123456",
            },
            error: null,
          });
        }
        return buildMockQuery({ data: null, error: null });
      }
      return buildMockQuery({ data: null, error: null });
    });
    supabase.rpc.mockResolvedValue({
      data: { ok: true, code: "valid" },
      error: null,
    });

    const result = await completeDistribution({
      requestId: "req-1",
      pin: "123456",
      eventId: "evt-1",
      eventLocation: "صور",
      scannedBy: "admin-1",
    });

    expect(result).toEqual({ ok: true });
  });
});
