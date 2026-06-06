import { resetSupabaseMock, supabase } from "@/integrations/supabase/__mocks__/client";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client");

import { createAdminUser, fetchAdminUsers } from "@/lib/admin-users";

describe("admin-users supabase flows", () => {
  beforeEach(() => {
    resetSupabaseMock();
  });

  it("fetchAdminUsers calls list_admin_users RPC", async () => {
    supabase.rpc.mockResolvedValue({
      data: [
        {
          user_id: "u1",
          email: "a@sanad.lb",
          display_name: "Admin",
          role: "admin",
          is_active: true,
          created_at: "2026-01-01",
          last_sign_in_at: null,
        },
      ],
      error: null,
    });

    const users = await fetchAdminUsers();
    expect(users).toHaveLength(1);
    expect(supabase.rpc).toHaveBeenCalledWith("list_admin_users");
  });

  it("createAdminUser invokes edge function", async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: { ok: true, user_id: "new-u" },
      error: null,
    });

    const result = await createAdminUser({
      email: "new@sanad.lb",
      password: "secret123",
      full_name: "New User",
      role: "reviewer",
    });

    expect(result).toEqual({ ok: true });
    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      "admin-user-management",
      expect.objectContaining({
        body: expect.objectContaining({ action: "create", email: "new@sanad.lb" }),
      }),
    );
  });

  it("createAdminUser returns error message on failure", async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: { ok: false, message: "Email taken" },
      error: null,
    });

    const result = await createAdminUser({
      email: "taken@sanad.lb",
      password: "x",
      full_name: "X",
      role: "viewer",
    });

    expect(result).toEqual({ ok: false, message: "Email taken" });
  });
});
