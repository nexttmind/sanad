import { resetSupabaseMock, supabase } from "@/integrations/supabase/__mocks__/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client");

import {
  buildFiltersJson,
  DEFAULT_SUBMISSION_SORT,
  fetchFilterTags,
  listSubmissions,
  parseSortFromSearch,
} from "@/lib/submissions-list";

describe("submissions-list supabase flows", () => {
  beforeEach(() => {
    resetSupabaseMock();
  });

  it("listSubmissions calls list_submissions RPC with filters, sort, and limit", async () => {
    supabase.rpc.mockResolvedValue({
      data: {
        rows: [{ id: "r1", reference_code: "SND-1", full_name: "Ali" }],
        total_count: 1,
        next_cursor: null,
      },
      error: null,
    });

    const result = await listSubmissions(
      { search: "Ali", status: "submitted", risk_level: "high", urgency_tier: "critical" },
      { field: "queue_number", direction: "asc" },
      null,
      25,
    );

    expect(result.rows).toHaveLength(1);
    expect(result.totalCount).toBe(1);
    expect(result.nextCursor).toBeNull();
    expect(supabase.rpc).toHaveBeenCalledWith("list_submissions", {
      _filters: {
        search: "Ali",
        status: "submitted",
        risk_level: "high",
        urgency_tier: "critical",
      },
      _sort: { field: "queue_number", direction: "asc" },
      _cursor: null,
      _limit: 25,
    });
  });

  it("listSubmissions returns next cursor when RPC provides offset", async () => {
    supabase.rpc.mockResolvedValue({
      data: {
        rows: [],
        total_count: 100,
        next_cursor: { offset: 50 },
      },
      error: null,
    });

    const result = await listSubmissions({}, DEFAULT_SUBMISSION_SORT, { offset: 0 });
    expect(result.nextCursor).toEqual({ offset: 50 });
  });

  it("listSubmissions passes cursor offset for pagination", async () => {
    supabase.rpc.mockResolvedValue({
      data: { rows: [], total_count: 100, next_cursor: null },
      error: null,
    });

    await listSubmissions({}, DEFAULT_SUBMISSION_SORT, { offset: 50 });
    expect(supabase.rpc).toHaveBeenCalledWith(
      "list_submissions",
      expect.objectContaining({ _cursor: { offset: 50 } }),
    );
  });

  it("listSubmissions passes keyset cursor for pagination", async () => {
    supabase.rpc.mockResolvedValue({
      data: { rows: [], total_count: 100, next_cursor: null },
      error: null,
    });

    await listSubmissions(
      {},
      DEFAULT_SUBMISSION_SORT,
      { last_sort_value: "80", last_id: "00000000-0000-0000-0000-000000000001", last_queue_number: 10 },
    );

    expect(supabase.rpc).toHaveBeenCalledWith(
      "list_submissions",
      expect.objectContaining({
        _cursor: {
          last_sort_value: "80",
          last_id: "00000000-0000-0000-0000-000000000001",
          last_queue_number: 10,
        },
      }),
    );
  });

  it("listSubmissions returns keyset next cursor when RPC provides it", async () => {
    supabase.rpc.mockResolvedValue({
      data: {
        rows: [],
        total_count: 100,
        next_cursor: {
          last_sort_value: "75",
          last_id: "00000000-0000-0000-0000-000000000002",
          last_queue_number: 12,
        },
      },
      error: null,
    });

    const result = await listSubmissions({}, DEFAULT_SUBMISSION_SORT);
    expect(result.nextCursor).toEqual({
      last_sort_value: "75",
      last_id: "00000000-0000-0000-0000-000000000002",
      last_queue_number: 12,
    });
  });

  it("listSubmissions propagates RPC errors", async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: "denied" } });
    await expect(listSubmissions({})).rejects.toEqual({ message: "denied" });
  });

  it("fetchFilterTags loads tags table", async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [{ id: "t1", name_ar: "عاجل", color: "#f00" }],
        error: null,
      }),
    };
    supabase.from.mockReturnValue(chain);
    const tags = await fetchFilterTags();
    expect(tags).toHaveLength(1);
    expect(supabase.from).toHaveBeenCalledWith("tags");
  });
});

describe("submissions-list helpers", () => {
  it("buildFiltersJson strips all and empty search", () => {
    expect(
      buildFiltersJson({
        search: "  ",
        status: "all",
        risk_level: "all",
        urgency_tier: "all",
        governorate: "all",
      }),
    ).toEqual({});
  });

  it("buildFiltersJson includes governorate, tags, and date range", () => {
    expect(
      buildFiltersJson({
        governorate: "قضاء صور",
        tag_ids: ["tag-1", "tag-2"],
        created_from: "2026-06-01",
        created_to: "2026-06-30",
      }),
    ).toEqual({
      governorate: "قضاء صور",
      tag_ids: ["tag-1", "tag-2"],
      created_from: "2026-06-01",
      created_to: "2026-06-30",
    });
  });

  it("buildFiltersJson includes needs filter values", () => {
    expect(
      buildFiltersJson({
        needs: ["طعام", "دواء"],
      }),
    ).toEqual({
      needs: ["طعام", "دواء"],
    });
  });

  it("buildFiltersJson includes ops filters", () => {
    expect(
      buildFiltersJson({
        assigned_to: "user-1",
        unassigned_only: true,
        trust_min: 40,
        trust_max: 80,
        urgency_min: 70,
        urgency_max: 100,
        queue_from: 10,
        queue_to: 500,
        has_flags: true,
        reference_result: "confirmed",
      }),
    ).toEqual({
      assigned_to: "user-1",
      unassigned_only: true,
      trust_min: 40,
      trust_max: 80,
      urgency_min: 70,
      urgency_max: 100,
      queue_from: 10,
      queue_to: 500,
      has_flags: true,
      reference_result: "confirmed",
    });
  });

  it("parseSortFromSearch falls back to default for invalid params", () => {
    const params = new URLSearchParams("sort=invalid&dir=sideways");
    expect(parseSortFromSearch(params)).toEqual(DEFAULT_SUBMISSION_SORT);
  });

  it("parseSortFromSearch accepts valid field and direction", () => {
    const params = new URLSearchParams("sort=trust_score&dir=asc");
    expect(parseSortFromSearch(params)).toEqual({ field: "trust_score", direction: "asc" });
  });
});
