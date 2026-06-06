import { resetSupabaseMock, supabase } from "@/integrations/supabase/__mocks__/client";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client");

import { fetchStaffMembers } from "@/lib/admin-staff";

describe("admin-staff supabase flows", () => {
  beforeEach(() => {
    resetSupabaseMock();
  });

  it("fetchStaffMembers calls list_staff_members RPC", async () => {
    supabase.rpc.mockResolvedValue({
      data: [
        { user_id: "u1", role: "reviewer", email: "r@sanad.lb", display_name: "Reviewer" },
      ],
      error: null,
    });

    const members = await fetchStaffMembers();
    expect(members).toHaveLength(1);
    expect(supabase.rpc).toHaveBeenCalledWith("list_staff_members");
  });
});
