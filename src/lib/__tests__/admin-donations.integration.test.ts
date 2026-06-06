import { buildMockQuery } from "@/test/helpers/mock-builders";
import { resetSupabaseMock, supabase } from "@/integrations/supabase/__mocks__/client";
import { describe, expect, it, vi, beforeEach } from "vitest";

const { logAdminAction } = vi.hoisted(() => ({
  logAdminAction: vi.fn(),
}));

vi.mock("@/integrations/supabase/client");
vi.mock("@/lib/audit-log", () => ({ logAdminAction }));

import {
  fetchAdminDonations,
  rejectDonation,
  verifyDonation,
  type AdminDonationRow,
} from "@/lib/admin-donations";

const sampleRow: AdminDonationRow = {
  id: "d1",
  reference_code: "DON-001",
  donor_name: "Ahmad",
  is_anonymous: false,
  amount: 50,
  currency: "USD",
  method: "whish",
  message: null,
  status: "pending",
  pledged_for_request: null,
  pledged_request_code: null,
  internal_notes: null,
  created_at: "2026-06-01T00:00:00.000Z",
  proof: { id: "p1", storage_path: "d1/proof.jpg", verified: false },
};

describe("admin-donations supabase flows", () => {
  beforeEach(() => {
    resetSupabaseMock();
    vi.clearAllMocks();
    supabase.from.mockReturnValue(buildMockQuery({ data: null, error: null }));
  });

  it("fetchAdminDonations maps nested relations", async () => {
    supabase.from.mockReturnValue(
      buildMockQuery({
        data: [
          {
            id: "d1",
            reference_code: "DON-001",
            donor_name: "Ahmad",
            is_anonymous: false,
            amount: 50,
            currency: "USD",
            method: "whish",
            message: null,
            status: "pending",
            pledged_for_request: "req-1",
            internal_notes: null,
            created_at: "2026-06-01T00:00:00.000Z",
            aid_requests: { reference_code: "SND-100" },
            payment_proofs: [{ id: "p1", storage_path: "d1/proof.jpg", verified: false }],
          },
        ],
        error: null,
      }),
    );

    const rows = await fetchAdminDonations();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.pledged_request_code).toBe("SND-100");
    expect(rows[0]?.amount).toBe(50);
  });

  it("verifyDonation updates status and logs audit", async () => {
    await verifyDonation(sampleRow, "Admin");
    expect(supabase.from).toHaveBeenCalledWith("donations");
    expect(logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "donation_verified", entityId: "d1" }),
    );
  });

  it("rejectDonation stores reason and logs audit", async () => {
    await rejectDonation(sampleRow, "amount mismatch", "Admin");
    expect(logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "donation_rejected",
        newValue: expect.objectContaining({ reason: "amount mismatch" }),
      }),
    );
  });
});
