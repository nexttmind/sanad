import { describe, expect, it } from "vitest";
import { isLebPhone } from "@/lib/mukhtar-whitelist";

describe("mukhtar-whitelist validation", () => {
  it("accepts common Lebanese mobile formats", () => {
    expect(isLebPhone("03 123 456")).toBe(true);
    expect(isLebPhone("+961 71 234 567")).toBe(true);
    expect(isLebPhone("96170123456")).toBe(true);
    expect(isLebPhone("70123456")).toBe(true);
    expect(isLebPhone("78901234")).toBe(true);
  });

  it("rejects invalid numbers", () => {
    expect(isLebPhone("12345")).toBe(false);
    expect(isLebPhone("+1 555 0100")).toBe(false);
    expect(isLebPhone("69123456")).toBe(false);
    expect(isLebPhone("")).toBe(false);
  });
});
