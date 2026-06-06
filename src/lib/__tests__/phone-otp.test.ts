import { describe, expect, it } from "vitest";
import {
  normalizePhoneDigits,
  otpCooldownLabel,
} from "@/lib/phone-otp";

describe("phone-otp helpers", () => {
  it("normalizePhoneDigits converts local Lebanese numbers", () => {
    expect(normalizePhoneDigits("03 123 456")).toBe("9613123456");
    expect(normalizePhoneDigits("+961 71 234 567")).toBe("96171234567");
    expect(normalizePhoneDigits("96170123456")).toBe("96170123456");
  });

  it("normalizePhoneDigits strips non-digits from formatted input", () => {
    expect(normalizePhoneDigits("(961) 71-234-567")).toBe("96171234567");
  });

  it("otpCooldownLabel shows countdown or resend", () => {
    expect(otpCooldownLabel(0)).toBe("إعادة الإرسال");
    expect(otpCooldownLabel(42)).toContain("42");
  });
});
