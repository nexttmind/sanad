import { resetSupabaseMock, supabase } from "@/integrations/supabase/__mocks__/client";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client");

import { precheckAidSubmission } from "@/lib/precheck-aid-submission";

describe("precheck-aid-submission supabase flows", () => {
  beforeEach(() => {
    resetSupabaseMock();
  });

  it("precheckAidSubmission returns allowed when eligible", async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: { ok: true, allowed: true },
      error: null,
    });

    const result = await precheckAidSubmission({ phone: "70123456" });

    expect(result).toEqual({ ok: true, allowed: true });
    expect(supabase.functions.invoke).toHaveBeenCalledWith("precheck-aid-submission", {
      body: { phone: "70123456" },
    });
  });

  it("precheckAidSubmission omits reference_code on duplicate block", async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: {
        ok: true,
        allowed: false,
        reason: "phone_already_submitted",
        message: "سبق أن قدّمت طلباً من هذا الرقم.",
      },
      error: null,
    });

    const result = await precheckAidSubmission({ phone: "70123456" });

    expect(result).toEqual({
      ok: true,
      allowed: false,
      reason: "phone_already_submitted",
      message: "سبق أن قدّمت طلباً من هذا الرقم.",
    });
    expect(result).not.toHaveProperty("reference_code");
  });
});
