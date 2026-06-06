import { buildMockQuery } from "@/test/helpers/mock-builders";
import { resetSupabaseMock, supabase } from "@/integrations/supabase/__mocks__/client";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client");

import { checkIsStaff, claimFirstAdmin, fetchUserRoles } from "@/lib/auth";

describe("auth supabase flows", () => {
  beforeEach(() => {
    resetSupabaseMock();
  });

  it("fetchUserRoles returns active roles", async () => {
    supabase.from.mockReturnValue(
      buildMockQuery({ data: [{ role: "admin" }, { role: "reviewer" }], error: null }),
    );

    const roles = await fetchUserRoles("user-1");
    expect(roles).toEqual(["admin", "reviewer"]);
  });

  it("checkIsStaff calls is_staff RPC", async () => {
    supabase.rpc.mockResolvedValue({ data: true, error: null });
    expect(await checkIsStaff("user-1")).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith("is_staff", { _user_id: "user-1" });
  });

  it("claimFirstAdmin returns RPC boolean", async () => {
    supabase.rpc.mockResolvedValue({ data: true, error: null });
    expect(await claimFirstAdmin()).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith("claim_first_admin");
  });
});
