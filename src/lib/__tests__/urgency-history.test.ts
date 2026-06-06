import { resetSupabaseMock, supabase } from "@/integrations/supabase/__mocks__/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client");

import {
  fetchUrgencyScoreHistory,
  formatHistoryTimestamp,
  urgencyTriggerLabel,
} from "@/lib/urgency-history";

describe("urgency-history", () => {
  beforeEach(() => {
    resetSupabaseMock();
  });

  it("urgencyTriggerLabel maps known triggers", () => {
    expect(urgencyTriggerLabel("system")).toBe("احتساب تلقائي");
    expect(urgencyTriggerLabel("admin_recalc")).toBe("إعادة احتساب يدوي");
    expect(urgencyTriggerLabel("custom")).toBe("custom");
  });

  it("formatHistoryTimestamp returns Arabic locale string", () => {
    const text = formatHistoryTimestamp("2026-06-01T12:00:00.000Z");
    expect(text.length).toBeGreaterThan(5);
  });

  it("fetchUrgencyScoreHistory queries table with limit", async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            id: "h1",
            request_id: "req-1",
            calculated_urgency: 70,
            effective_urgency: 85,
            urgency_tier: "critical",
            breakdown: {},
            config_version: 2,
            triggered_by: "system",
            actor_id: null,
            created_at: "2026-06-01T12:00:00.000Z",
          },
        ],
        error: null,
      }),
    };
    supabase.from.mockReturnValue(chain);

    const rows = await fetchUrgencyScoreHistory("req-1", 10);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.effective_urgency).toBe(85);
    expect(supabase.from).toHaveBeenCalledWith("urgency_score_history");
    expect(chain.eq).toHaveBeenCalledWith("request_id", "req-1");
    expect(chain.limit).toHaveBeenCalledWith(10);
  });
});
