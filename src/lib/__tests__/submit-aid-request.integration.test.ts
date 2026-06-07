import { resetSupabaseMock, supabase } from "@/integrations/supabase/__mocks__/client";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client");

import { submitAidRequest } from "@/lib/submit-aid-request";

const basePayload = {
  full_name: "Ali Hassan",
  phone: "70123456",
  national_id: "12345678",
  document_type: "lebanese_id" as const,
  family_size: 4,
  infants: 0,
  children: 2,
  elderly: 0,
  disabled: false,
  chronic_illness: false,
  pregnant_or_nursing: false,
  displaced: true,
  needs: ["طعام"],
};

describe("submit-aid-request supabase flows", () => {
  beforeEach(() => {
    resetSupabaseMock();
  });

  it("submitAidRequest rejects empty name/phone locally", async () => {
    const result = await submitAidRequest({
      ...basePayload,
      full_name: "",
      phone: "",
    });
    expect(result).toEqual({ ok: false, message: "invalid request" });
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it("submitAidRequest invokes submit-aid-request edge function", async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: { ok: true, id: "req-1", reference_code: "SND-ABC" },
      error: null,
    });

    const result = await submitAidRequest(basePayload);

    expect(result).toEqual({ ok: true, id: "req-1", reference_code: "SND-ABC" });
    expect(supabase.functions.invoke).toHaveBeenCalledWith("submit-aid-request", {
      body: expect.objectContaining({
        full_name: "Ali Hassan",
        phone: "70123456",
        document_type: "lebanese_id",
      }),
    });
  });

  it("submitAidRequest surfaces duplicate phone block from proxy", async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: {
        ok: false,
        reason: "phone_already_submitted",
        message: "سبق أن قدّمت طلباً من هذا الرقم. يُسمح بطلب واحد فقط لكل رقم هاتف.",
        reference_code: "****-1234",
      },
      error: null,
    });

    const result = await submitAidRequest(basePayload);

    expect(result).toEqual({
      ok: false,
      reason: "phone_already_submitted",
      message: "سبق أن قدّمت طلباً من هذا الرقم. يُسمح بطلب واحد فقط لكل رقم هاتف.",
      reference_code: "****-1234",
    });
  });
});
