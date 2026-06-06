import { buildMockQuery } from "@/test/helpers/mock-builders";
import { resetSupabaseMock, supabase } from "@/integrations/supabase/__mocks__/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client");

import { createSavedView, deleteSavedView, fetchSavedViews } from "@/lib/saved-views";

describe("saved-views supabase flows", () => {
  beforeEach(() => {
    resetSupabaseMock();
  });

  it("fetchSavedViews maps rows with filters and sort", async () => {
    supabase.from.mockReturnValue(
      buildMockQuery({
        data: [
          {
            id: "view-1",
            user_id: "u1",
            name: "عاجل",
            filters: { status: "submitted", urgency_tier: "critical" },
            sort: { field: "effective_urgency", direction: "desc" },
            columns: ["reference_code", "full_name"],
            is_shared: true,
            created_at: "2026-06-01T00:00:00Z",
            updated_at: "2026-06-02T00:00:00Z",
          },
        ],
        error: null,
      }),
    );

    const views = await fetchSavedViews();
    expect(views).toHaveLength(1);
    expect(views[0]?.name).toBe("عاجل");
    expect(views[0]?.filters.status).toBe("submitted");
    expect(views[0]?.sort.field).toBe("effective_urgency");
    expect(views[0]?.columns).toEqual(["reference_code", "full_name"]);
    expect(views[0]?.is_shared).toBe(true);
    expect(supabase.from).toHaveBeenCalledWith("admin_saved_views");
  });

  it("createSavedView requires authenticated user", async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(
      createSavedView({
        name: "Test",
        filters: {},
        sort: { field: "created_at", direction: "desc" },
      }),
    ).rejects.toThrow("Not authenticated");
  });

  it("createSavedView inserts trimmed name and returns parsed view", async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "admin-1" } },
      error: null,
    });

    supabase.from.mockReturnValue(
      buildMockQuery({
        data: {
          id: "view-new",
          user_id: "admin-1",
          name: "دور معلّق",
          filters: { status: "on_hold" },
          sort: { field: "queue_number", direction: "asc" },
          columns: null,
          is_shared: false,
          created_at: "2026-06-03T00:00:00Z",
          updated_at: "2026-06-03T00:00:00Z",
        },
        error: null,
      }),
    );

    const view = await createSavedView({
      name: "  دور معلّق  ",
      filters: { status: "on_hold" },
      sort: { field: "queue_number", direction: "asc" },
      columns: ["reference_code", "full_name"],
      isShared: true,
    });

    expect(view.name).toBe("دور معلّق");
    expect(view.sort.direction).toBe("asc");
    const insertCall = supabase.from.mock.results[0]?.value.insert as ReturnType<typeof vi.fn>;
    expect(insertCall).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "admin-1",
        name: "دور معلّق",
        is_shared: true,
        columns: ["reference_code", "full_name"],
      }),
    );
  });

  it("fetchSavedViews defaults sort when RPC row has invalid sort", async () => {
    supabase.from.mockReturnValue(
      buildMockQuery({
        data: [
          {
            id: "view-2",
            user_id: "u1",
            name: "بدون ترتيب",
            filters: {},
            sort: {},
            columns: "not-an-array",
            is_shared: false,
            created_at: "2026-06-01T00:00:00Z",
            updated_at: "2026-06-01T00:00:00Z",
          },
        ],
        error: null,
      }),
    );

    const views = await fetchSavedViews();
    expect(views[0]?.sort).toEqual({ field: "effective_urgency", direction: "desc" });
    expect(views[0]?.columns).toBeNull();
  });

  it("deleteSavedView deletes by id", async () => {
    supabase.from.mockReturnValue(buildMockQuery({ data: null, error: null }));
    await deleteSavedView("view-1");
    const chain = supabase.from.mock.results[0]?.value;
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith("id", "view-1");
  });
});
