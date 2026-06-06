import { describe, expect, it } from "vitest";
import {
  METHOD_UI_TO_DB,
  formatBeneficiaryLabel,
  formatLedgerDate,
  ledgerItemLabel,
  normalizeLedgerRow,
  parseDonationImpactStats,
  type LedgerRow,
} from "@/lib/donations";

describe("donations helpers", () => {
  it("parseDonationImpactStats coerces RPC json", () => {
    const stats = parseDonationImpactStats({
      week_total_usd: "1200",
      families_helped: 8,
      last_donation_minutes: null,
    });
    expect(stats.week_total_usd).toBe(1200);
    expect(stats.families_helped).toBe(8);
    expect(stats.last_donation_minutes).toBeNull();
  });

  it("formatBeneficiaryLabel distinguishes family vs general fund", () => {
    expect(formatBeneficiaryLabel("SND-0042")).toBe("SND-0042");
    expect(formatBeneficiaryLabel(null)).toBe("صندوق عام");
    expect(formatBeneficiaryLabel("")).toBe("صندوق عام");
  });

  it("normalizeLedgerRow coerces amount and trims beneficiary", () => {
    const row = normalizeLedgerRow({
      reference_code: "DON-1",
      donor_display: "Ali",
      amount: "40",
      currency: "USD",
      method: "whish",
      message: "  ",
      beneficiary_code: " SND-9 ",
      created_at: "2026-06-01T12:00:00.000Z",
    });
    expect(row.amount).toBe(40);
    expect(row.message).toBeNull();
    expect(row.beneficiary_code).toBe("SND-9");
  });
  it("METHOD_UI_TO_DB maps UI keys to DB enum", () => {
    expect(METHOD_UI_TO_DB.whish).toBe("whish");
    expect(METHOD_UI_TO_DB.bank).toBe("bank_transfer");
    expect(METHOD_UI_TO_DB.omt).toBe("omt");
    expect(METHOD_UI_TO_DB.paypal).toBe("paypal");
  });

  it("ledgerItemLabel prefers message over method", () => {
    const row: LedgerRow = {
      reference_code: "DON-1",
      donor_display: "Ali",
      amount: 50,
      currency: "USD",
      method: "whish",
      message: "لعائلة محتاجة",
      beneficiary_code: "SND-1",
      created_at: "2026-06-01T12:00:00.000Z",
    };
    expect(ledgerItemLabel(row)).toBe("لعائلة محتاجة");
  });

  it("ledgerItemLabel falls back to method label", () => {
    const row: LedgerRow = {
      reference_code: "DON-2",
      donor_display: "Ali",
      amount: 50,
      currency: "USD",
      method: "bank_transfer",
      message: null,
      beneficiary_code: null,
      created_at: "2026-06-01T12:00:00.000Z",
    };
    expect(ledgerItemLabel(row)).toBe("تحويل مصرفي");
  });

  it("ledgerItemLabel uses beneficiary when no message", () => {
    const row: LedgerRow = {
      reference_code: "DON-3",
      donor_display: "Ali",
      amount: 50,
      currency: "USD",
      method: "omt",
      message: null,
      beneficiary_code: "SND-0042",
      created_at: "2026-06-01T12:00:00.000Z",
    };
    expect(ledgerItemLabel(row)).toBe("دعم عائلة SND-0042");
  });

  it("formatLedgerDate formats Arabic locale date", () => {
    const formatted = formatLedgerDate("2026-06-15T12:00:00.000Z");
    expect(formatted.length).toBeGreaterThan(0);
    expect(formatted).toContain("حزيران");
  });
});
