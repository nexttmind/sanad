import { describe, expect, it } from "vitest";
import { buildLifecycleTimeline } from "@/components/admin/RequestLifecycleTimeline";
import { matchQuickFilter } from "@/lib/request-quick-filters";

describe("matchQuickFilter", () => {
  it("detects high urgency pending preset", () => {
    expect(
      matchQuickFilter("high_urgency_pending", "user-1", {
        filters: { status: "submitted", urgency_min: 85 },
        assignFilter: "all",
        status: "submitted",
        createdTo: "",
        urgencyMin: "85",
      }),
    ).toBe(true);
  });
});

describe("buildLifecycleTimeline", () => {
  it("computes wait duration between transitions", () => {
    const entries = buildLifecycleTimeline(
      [
        {
          id: "1",
          request_id: "r1",
          from_status: "submitted",
          to_status: "reviewing",
          reason: null,
          created_at: "2026-06-01T12:00:00.000Z",
          actor_id: null,
        },
      ],
      "2026-06-01T10:00:00.000Z",
      {},
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].durationLabel).toBe("2 س");
  });
});
