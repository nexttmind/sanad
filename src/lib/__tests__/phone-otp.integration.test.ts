import { resetSupabaseMock, supabase } from "@/integrations/supabase/__mocks__/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client");

import { sendPhoneOtp, verifyPhoneOtp } from "@/lib/phone-otp";

describe("phone-otp supabase flows", () => {
  beforeEach(() => {
    resetSupabaseMock();
  });

  it("sendPhoneOtp rejects invalid phone before calling edge function", async () => {
    const result = await sendPhoneOtp("123");
    expect(result).toEqual({ ok: false, message: "رقم الهاتف غير صالح." });
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it("sendPhoneOtp invokes send-otp with normalized Lebanese number", async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: { ok: true, expires_in: 600 },
      error: null,
    });

    const result = await sendPhoneOtp("03 712 3456");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.expiresIn).toBe(600);
    expect(supabase.functions.invoke).toHaveBeenCalledWith("send-otp", {
      body: { phone: "96137123456" },
    });
  });

  it("sendPhoneOtp returns server message on edge function failure payload", async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: { ok: false, message: "تجاوزت الحد المسموح — حاول بعد ساعة." },
      error: null,
    });

    const result = await sendPhoneOtp("96171234567");
    expect(result).toEqual({
      ok: false,
      message: "تجاوزت الحد المسموح — حاول بعد ساعة.",
    });
  });

  it("sendPhoneOtp returns generic message on transport error", async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: null,
      error: { message: "network" },
    });

    const result = await sendPhoneOtp("96171234567");
    expect(result).toEqual({ ok: false, message: "تعذّر إرسال رمز التحقق." });
  });

  it("verifyPhoneOtp rejects short codes before RPC", async () => {
    const result = await verifyPhoneOtp("96171234567", "12");
    expect(result).toEqual({ ok: false, message: "يرجى إدخال الرمز كاملاً." });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("verifyPhoneOtp calls verify_phone_otp with normalized phone and digits-only code", async () => {
    supabase.rpc.mockResolvedValue({ data: true, error: null });

    const result = await verifyPhoneOtp("+961 71 234 567", "123456");
    expect(result).toEqual({ ok: true });
    expect(supabase.rpc).toHaveBeenCalledWith("verify_phone_otp", {
      _phone: "96171234567",
      _code: "123456",
    });
  });

  it("verifyPhoneOtp returns Arabic message when RPC returns false", async () => {
    supabase.rpc.mockResolvedValue({ data: false, error: null });

    const result = await verifyPhoneOtp("96171234567", "000000");
    expect(result).toEqual({
      ok: false,
      message: "الرمز غير صحيح أو منتهٍ — اطلب رمزاً جديداً.",
    });
  });

  it("verifyPhoneOtp returns generic message on RPC error", async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: "rpc failed" } });

    const result = await verifyPhoneOtp("96171234567", "123456");
    expect(result).toEqual({ ok: false, message: "تعذّر التحقق من الرمز." });
  });
});
