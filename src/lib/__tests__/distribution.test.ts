import { describe, expect, it } from "vitest";
import {
  DISTRIBUTION_STATUS_AR,
  parseSanadQrPayload,
} from "@/lib/distribution";

describe("distribution helpers", () => {
  it("parseSanadQrPayload extracts ref and request id", () => {
    const payload = "SANAD:SND-12345:uuid-here:20260605";
    expect(parseSanadQrPayload(payload)).toEqual({
      refCode: "SND-12345",
      requestId: "uuid-here",
    });
  });

  it("parseSanadQrPayload rejects invalid payloads", () => {
    expect(parseSanadQrPayload("INVALID:foo")).toBeNull();
    expect(parseSanadQrPayload("SANAD:only-two")).toBeNull();
    expect(parseSanadQrPayload("")).toBeNull();
  });

  it("DISTRIBUTION_STATUS_AR maps all statuses", () => {
    expect(DISTRIBUTION_STATUS_AR.scheduled).toBe("قادم");
    expect(DISTRIBUTION_STATUS_AR.in_progress).toBe("جارٍ");
    expect(DISTRIBUTION_STATUS_AR.completed).toBe("مكتمل");
    expect(DISTRIBUTION_STATUS_AR.cancelled).toBe("ملغى");
  });
});
