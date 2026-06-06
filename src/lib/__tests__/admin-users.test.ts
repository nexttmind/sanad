import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { formatLastSignIn } from "@/lib/admin-users";

describe("admin-users helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-05T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("formatLastSignIn returns dash for null", () => {
    expect(formatLastSignIn(null)).toBe("—");
  });

  it("formatLastSignIn shows minutes for recent sign-in", () => {
    const iso = new Date("2026-06-05T11:50:00.000Z").toISOString();
    expect(formatLastSignIn(iso)).toBe("قبل 10 د");
  });

  it("formatLastSignIn shows hours for same-day sign-in", () => {
    const iso = new Date("2026-06-05T09:00:00.000Z").toISOString();
    expect(formatLastSignIn(iso)).toBe("قبل 3 س");
  });

  it("formatLastSignIn shows days for recent week", () => {
    const iso = new Date("2026-06-03T12:00:00.000Z").toISOString();
    expect(formatLastSignIn(iso)).toBe("قبل 2 ي");
  });
});
