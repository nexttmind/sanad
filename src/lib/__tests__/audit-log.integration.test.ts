import { buildMockQuery } from "@/test/helpers/mock-builders";
import { resetSupabaseMock, supabase } from "@/integrations/supabase/__mocks__/client";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client");

import { writeAuditLog, logAdminAction } from "@/lib/audit-log";

describe("audit-log write", () => {
  beforeEach(() => {
    resetSupabaseMock();
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    supabase.from.mockReturnValue(buildMockQuery({ data: null, error: null }));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ json: async () => ({ ip: "1.2.3.4" }) }),
    );
  });

  it("writeAuditLog inserts audit row with actor and diff", async () => {
    await writeAuditLog({
      action: "status_change",
      entityId: "req-1",
      oldValue: { status: "submitted" },
      newValue: { status: "approved" },
      actorName: "Sami",
      ipAddress: "10.0.0.1",
    });

    expect(supabase.from).toHaveBeenCalledWith("audit_log");
    const insertChain = supabase.from.mock.results[0]?.value;
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_id: "user-1",
        action: "status_change",
        entity: "aid_request",
        entity_id: "req-1",
      }),
    );
  });

  it("writeAuditLog throws when not authenticated", async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(
      writeAuditLog({ action: "note_added", newValue: { content: "hi" } }),
    ).rejects.toThrow("Not authenticated");
  });

  it("logAdminAction swallows errors", async () => {
    supabase.auth.getUser.mockRejectedValue(new Error("network"));
    await expect(logAdminAction({ action: "export_csv" })).resolves.toBeUndefined();
  });
});
