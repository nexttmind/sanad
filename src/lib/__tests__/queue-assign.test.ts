import { resetSupabaseMock, supabase } from "@/integrations/supabase/__mocks__/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client");
vi.mock("@/lib/audit-log", () => ({
  logAdminAction: vi.fn().mockResolvedValue(undefined),
}));

import { bulkAssignReviewer, selectTopForBulkAssign } from "@/lib/queue-assign";

describe("selectTopForBulkAssign", () => {
  const rows = [
    { id: "1", reference_code: "SND-1", assigned_to: null },
    { id: "2", reference_code: "SND-2", assigned_to: "u1" },
    { id: "3", reference_code: "SND-3", assigned_to: null },
    { id: "4", reference_code: "SND-4", assigned_to: null },
  ];

  it("picks first N unassigned rows in list order", () => {
    const picked = selectTopForBulkAssign(rows, 2);
    expect(picked.map((r) => r.id)).toEqual(["1", "3"]);
  });

  it("includes already assigned when flag is set", () => {
    const picked = selectTopForBulkAssign(rows, 2, true);
    expect(picked.map((r) => r.id)).toEqual(["1", "2"]);
  });

  it("returns empty when limit is zero", () => {
    expect(selectTopForBulkAssign(rows, 0)).toEqual([]);
  });
});

describe("bulkAssignReviewer", () => {
  beforeEach(() => {
    resetSupabaseMock();
  });

  it("rejects empty selection", async () => {
    const result = await bulkAssignReviewer([], "reviewer-1", "Admin");
    expect(result).toEqual({ ok: false, message: "لا توجد طلبات غير معيّنة ضمن أول الدور." });
  });

  it("updates assigned_to and logs audit per request", async () => {
    const chain = { update: vi.fn().mockReturnThis(), in: vi.fn().mockResolvedValue({ error: null }) };
    supabase.from.mockReturnValue(chain);

    const result = await bulkAssignReviewer(
      [
        { id: "a", reference_code: "SND-10", assigned_to: null },
        { id: "b", reference_code: "SND-11", assigned_to: null },
      ],
      "reviewer-1",
      "Sami",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.assigned).toBe(2);
      expect(result.reference_codes).toEqual(["SND-10", "SND-11"]);
    }
    expect(supabase.from).toHaveBeenCalledWith("aid_requests");
    expect(chain.update).toHaveBeenCalledWith({ assigned_to: "reviewer-1" });
    expect(chain.in).toHaveBeenCalledWith("id", ["a", "b"]);
  });
});
