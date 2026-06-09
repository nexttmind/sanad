import { describe, expect, it } from "vitest";
import {
  ALT_DONATION_PHONE,
  WHISH_DONATION_PHONE,
  telHref,
  whatsappHref,
} from "@/lib/donation-contacts";

describe("donation-contacts", () => {
  it("builds tel and whatsapp links for Whish", () => {
    expect(telHref(WHISH_DONATION_PHONE)).toBe("tel:+96181432343");
    expect(whatsappHref(WHISH_DONATION_PHONE)).toBe("https://wa.me/96181432343");
  });

  it("builds tel and whatsapp links for alt contact", () => {
    expect(telHref(ALT_DONATION_PHONE)).toBe("tel:+9613689363");
    expect(whatsappHref(ALT_DONATION_PHONE)).toBe("https://wa.me/9613689363");
  });
});
