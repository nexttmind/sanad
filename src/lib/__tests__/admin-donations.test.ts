import { describe, expect, it } from "vitest";
import {
  DONATION_STATUS_AR,
  donorDisplay,
  methodLabel,
  type AdminDonationRow,
} from "@/lib/admin-donations";

const baseRow: AdminDonationRow = {
  id: "d1",
  reference_code: "DON-001",
  donor_name: "Ahmad",
  is_anonymous: false,
  amount: 100,
  currency: "USD",
  method: "whish",
  message: null,
  status: "pending",
  pledged_for_request: null,
  pledged_request_code: null,
  internal_notes: null,
  created_at: "2026-06-01T00:00:00.000Z",
  proof: null,
};

describe("admin-donations helpers", () => {
  it("donorDisplay masks anonymous donors", () => {
    expect(donorDisplay(baseRow)).toBe("Ahmad");
    expect(donorDisplay({ ...baseRow, is_anonymous: true })).toBe("متبرّع مجهول");
    expect(donorDisplay({ ...baseRow, donor_name: null })).toBe("متبرّع مجهول");
  });

  it("methodLabel returns Arabic/English labels", () => {
    expect(methodLabel("bank_transfer")).toBe("تحويل مصرفي");
    expect(methodLabel("whish")).toBe("Whish");
  });

  it("DONATION_STATUS_AR covers all statuses", () => {
    expect(DONATION_STATUS_AR.pending).toBe("بانتظار التحقق");
    expect(DONATION_STATUS_AR.verified).toBe("موثّق");
    expect(DONATION_STATUS_AR.rejected).toBe("مرفوض");
    expect(DONATION_STATUS_AR.refunded).toBe("مسترد");
  });
});
