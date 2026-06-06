import { buildMockQuery } from "@/test/helpers/mock-builders";
import { resetSupabaseMock, supabase } from "@/integrations/supabase/__mocks__/client";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client");

import {
  fetchDonationImpactStats,
  fetchPublicLedger,
  submitDonation,
} from "@/lib/donations";

describe("donations supabase flows", () => {
  beforeEach(() => {
    resetSupabaseMock();
  });

  it("fetchDonationImpactStats parses RPC json", async () => {
    supabase.rpc.mockResolvedValue({
      data: { week_total_usd: 1500, families_helped: 12, last_donation_minutes: 5 },
      error: null,
    });

    const stats = await fetchDonationImpactStats();
    expect(stats.week_total_usd).toBe(1500);
    expect(supabase.rpc).toHaveBeenCalledWith("donation_impact_stats");
  });

  it("fetchPublicLedger coerces amounts and beneficiary_code", async () => {
    supabase.rpc.mockResolvedValue({
      data: [
        {
          reference_code: "DON-1",
          donor_display: "متبرّع",
          amount: "25.5",
          currency: "USD",
          method: "whish",
          message: null,
          beneficiary_code: "SND-001",
          created_at: "2026-06-01T12:00:00.000Z",
        },
      ],
      error: null,
    });
    const rows = await fetchPublicLedger(5);
    expect(rows[0]?.amount).toBe(25.5);
    expect(rows[0]?.beneficiary_code).toBe("SND-001");
    expect(supabase.rpc).toHaveBeenCalledWith("public_ledger", { _limit: 5 });
  });

  it("submitDonation rejects invalid input", async () => {
    await expect(
      submitDonation({ donor_name: "", amount: 0, method: "whish" }),
    ).rejects.toThrow("invalid donation");
  });

  it("submitDonation inserts donation row", async () => {
    supabase.from.mockReturnValue(
      buildMockQuery({ data: { id: "don-1", reference_code: "DON-ABC" }, error: null }),
    );

    const result = await submitDonation({
      donor_name: "Ahmad",
      amount: 50,
      method: "whish",
    });

    expect(result.reference_code).toBe("DON-ABC");
  });
});
