import { describe, expect, it, vi, beforeEach } from "vitest";
import { getDeviceFingerprint } from "@/lib/device-fingerprint";

describe("device-fingerprint", () => {
  beforeEach(() => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 Test",
      language: "ar-LB",
    });
    vi.stubGlobal("screen", { width: 1366, height: 768 });
    vi.stubGlobal("Intl", {
      DateTimeFormat: () => ({
        resolvedOptions: () => ({ timeZone: "Asia/Beirut" }),
      }),
    });
  });

  it("returns a stable 64-char hex SHA-256 hash", async () => {
    const hash = await getDeviceFingerprint();
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns the same hash for the same inputs", async () => {
    const a = await getDeviceFingerprint();
    const b = await getDeviceFingerprint();
    expect(a).toBe(b);
  });

  it("returns null when crypto.subtle is unavailable", async () => {
    const original = globalThis.crypto;
    vi.stubGlobal("crypto", { subtle: undefined });
    expect(await getDeviceFingerprint()).toBeNull();
    vi.stubGlobal("crypto", original);
  });
});
