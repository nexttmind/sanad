import { resetSupabaseMock, supabase } from "@/integrations/supabase/__mocks__/client";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { FunctionsHttpError } from "@supabase/supabase-js";

vi.mock("@/integrations/supabase/client");

import { submitAidRequest } from "@/lib/submit-aid-request";

const basePayload = {
  full_name: "Ali Hassan",
  phone: "70123456",
  family_size: 4,
  infants: 0,
  children: 2,
  elderly: 0,
  disabled: false,
  chronic_illness: false,
  pregnant_or_nursing: false,
  displaced: true,
  needs: ["طعام"],
  reference: {
    reference_type: "مختار",
    full_name: "أحمد المختار",
    phone: "71123456",
    region: "قضاء صور",
    known_duration: "طوال عمري",
  },
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

  it("submitAidRequest rejects missing reference locally", async () => {
    const result = await submitAidRequest({
      ...basePayload,
      reference: {
        reference_type: "",
        full_name: "",
        phone: "",
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("المرجع");
    }
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

  it("submitAidRequest parses FunctionsHttpError body for duplicate phone (409)", async () => {
    const responseBody = {
      ok: false,
      reason: "phone_already_submitted",
      message: "سبق أن قدّمت طلباً من هذا الرقم. يُسمح بطلب واحد فقط لكل رقم هاتف.",
      reference_code: "****-1234",
    };
    supabase.functions.invoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError({
        json: vi.fn().mockResolvedValue(responseBody),
      }),
    });

    const result = await submitAidRequest(basePayload);

    expect(result).toEqual({
      ok: false,
      reason: "phone_already_submitted",
      message: responseBody.message,
      reference_code: "****-1234",
    });
  });

  it("submitAidRequest parses FunctionsHttpError body for reference save failure (500)", async () => {
    const responseBody = {
      ok: false,
      message: "تعذّر حفظ بيانات المرجع — يرجى المحاولة مرة أخرى.",
      errors: { reference: "تعذّر حفظ بيانات المرجع" },
    };
    supabase.functions.invoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError({
        json: vi.fn().mockResolvedValue(responseBody),
      }),
    });

    const result = await submitAidRequest(basePayload);

    expect(result).toEqual({
      ok: false,
      message: responseBody.message,
      errors: responseBody.errors,
    });
  });
});
