import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  bulkAddTagToRequests,
  bulkAssignRequests,
  bulkUpdateRequestStatus,
} from "@/lib/bulk-request-actions";
import { supabase } from "@/integrations/supabase/client";
import { logAdminAction } from "@/lib/audit-log";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn() },
}));

vi.mock("@/lib/audit-log", () => ({
  logAdminAction: vi.fn().mockResolvedValue(undefined),
}));

const picked = [
  { id: "a", reference_code: "SND-1", status: "submitted" as const },
  { id: "b", reference_code: "SND-2", status: "reviewing" as const },
];

describe("bulkAssignRequests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects empty selection", async () => {
    const result = await bulkAssignRequests([], "r1", "Admin");
    expect(result).toEqual({ ok: false, message: "لم يتم تحديد أي طلب." });
  });

  it("updates assigned_to and logs audit", async () => {
    const chain = { update: vi.fn().mockReturnThis(), in: vi.fn().mockResolvedValue({ error: null }) };
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    const result = await bulkAssignRequests(picked, "reviewer-1", "Sami");
    expect(result).toEqual({ ok: true, updated: 2 });
    expect(chain.update).toHaveBeenCalledWith({ assigned_to: "reviewer-1" });
    expect(logAdminAction).toHaveBeenCalledTimes(2);
  });
});

describe("bulkUpdateRequestStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires reason for reject", async () => {
    const result = await bulkUpdateRequestStatus(picked, "rejected", "Admin");
    expect(result).toEqual({ ok: false, message: "سبب الرفض مطلوب." });
  });

  it("updates status with rejection reason", async () => {
    const chain = { update: vi.fn().mockReturnThis(), in: vi.fn().mockResolvedValue({ error: null }) };
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    const result = await bulkUpdateRequestStatus(picked, "rejected", "Admin", "تكرار طلب");
    expect(result).toEqual({ ok: true, updated: 2 });
    expect(chain.update).toHaveBeenCalledWith({
      status: "rejected",
      rejection_reason: "تكرار طلب",
    });
  });
});

describe("bulkAddTagToRequests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upserts tags and logs audit", async () => {
    const chain = { upsert: vi.fn().mockResolvedValue({ error: null }) };
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    const result = await bulkAddTagToRequests(picked, "tag-1", "عاجل", "Admin");
    expect(result).toEqual({ ok: true, updated: 2 });
    expect(chain.upsert).toHaveBeenCalledWith(
      [
        { request_id: "a", tag_id: "tag-1" },
        { request_id: "b", tag_id: "tag-1" },
      ],
      { onConflict: "request_id,tag_id", ignoreDuplicates: true },
    );
  });
});
