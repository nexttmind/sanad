import { describe, expect, it } from "vitest";
import {
  DEFAULT_PUBLIC_SITE_CONFIG,
  cloneDefaultPublicSiteConfig,
  mergePublicSiteConfig,
  buildSanadQrPayload,
  phoneToTelHref,
} from "@/lib/public-site-config";

describe("public-site-config", () => {
  it("mergePublicSiteConfig falls back to defaults for empty input", () => {
    expect(mergePublicSiteConfig(null)).toEqual(DEFAULT_PUBLIC_SITE_CONFIG);
  });

  it("mergePublicSiteConfig overlays partial track copy", () => {
    const merged = mergePublicSiteConfig({
      track: { page_title: "عنوان مخصّص" },
    });
    expect(merged.track.page_title).toBe("عنوان مخصّص");
    expect(merged.track.page_subtitle).toBe(DEFAULT_PUBLIC_SITE_CONFIG.track.page_subtitle);
  });

  it("buildSanadQrPayload matches distribution scanner format", () => {
    const payload = buildSanadQrPayload("SND-12345", "00000000-0000-4000-8000-000000000001");
    expect(payload.startsWith("SANAD:SND-12345:00000000-0000-4000-8000-000000000001:")).toBe(true);
  });

  it("phoneToTelHref normalizes Lebanese numbers", () => {
    expect(phoneToTelHref("+961 70 000 000")).toBe("tel:+96170000000");
  });

  it("cloneDefaultPublicSiteConfig returns a deep copy", () => {
    const copy = cloneDefaultPublicSiteConfig();
    copy.track.page_title = "changed";
    expect(DEFAULT_PUBLIC_SITE_CONFIG.track.page_title).not.toBe("changed");
  });
});
