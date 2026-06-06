import { resetSupabaseMock, supabase } from "@/integrations/supabase/__mocks__/client";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client");

import { submitAidRequest } from "@/lib/submit-aid-request";

describe("submit-aid-request supabase flows", () => {
  beforeEach(() => {
    resetSupabaseMock();
  });

  it("submitAidRequest rejects empty name/phone locally", async () => {
    const result = await submitAidRequest({
      full_name: "",
      phone: "",
      family_size: 1,
      infants: 0,
      children: 0,
      elderly: 0,
      disabled: false,
      chronic_illness: false,
      pregnant_or_nursing: false,
      displaced: false,
      needs: [],
    });
    expect(result).toEqual({ ok: false, message: "invalid request" });
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it("submitAidRequest invokes submit-aid-request edge function", async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: { ok: true, id: "req-1", reference_code: "SND-ABC" },
      error: null,
    });

    const result = await submitAidRequest({
      full_name: "Ali Hassan",
      phone: "70123456",
      family_size: 4,
      infants: 1,
      children: 2,
      elderly: 0,
      disabled: false,
      chronic_illness: false,
      pregnant_or_nursing: false,
      displaced: true,
      needs: ["طعام"],
    });

    expect(result).toEqual({ ok: true, id: "req-1", reference_code: "SND-ABC" });
    expect(supabase.functions.invoke).toHaveBeenCalledWith("submit-aid-request", {
      body: expect.objectContaining({
        full_name: "Ali Hassan",
        phone: "70123456",
      }),
    });
  });

  it("submitAidRequest surfaces OTP gate message from proxy", async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: {
        ok: false,
        message: "يرجى التحقق من رقم الهاتف برمز SMS قبل الإرسال.",
      },
      error: null,
    });

    const result = await submitAidRequest({
      full_name: "Ali Hassan",
      phone: "70123456",
      family_size: 4,
      infants: 0,
      children: 0,
      elderly: 0,
      disabled: false,
      chronic_illness: false,
      pregnant_or_nursing: false,
      displaced: false,
      needs: ["طعام"],
    });

    expect(result).toEqual({
      ok: false,
      message: "يرجى التحقق من رقم الهاتف برمز SMS قبل الإرسال.",
    });
  });
});
