import { describe, expect, it } from "vitest";
import {
  deriveAdminAlertCount,
  deriveAdminNavBadges,
} from "@/lib/admin-query";
import type { AdminOverviewStats } from "@/lib/admin-overview";

const sampleStats: AdminOverviewStats = {
  total: 100,
  today_count: 5,
  status_counts: { submitted: 12, reviewing: 8 },
  alerts: {
    critical: 3,
    pending_queue: 45,
    oldest_queue: 101,
    infants_pending: 2,
    disabled_pending: 1,
    shelter_pending: 4,
    high_risk: 2,
    flagged: 5,
  },
  top_pending: [],
  recent: [],
  needs_breakdown: [],
  daily_last_7: [0, 0, 0, 0, 0, 0, 0],
  vulnerable: { infants: 0, disabled: 0, chronic: 0, elderly: 0 },
};

describe("deriveAdminNavBadges", () => {
  it("maps overview + donations to nav badge counts", () => {
    expect(deriveAdminNavBadges(sampleStats, 7)).toEqual({
      requests: 12,
      queue: 45,
      donations: 7,
    });
  });

  it("defaults missing stats to zero", () => {
    expect(deriveAdminNavBadges(undefined, 0)).toEqual({
      requests: 0,
      queue: 0,
      donations: 0,
    });
  });
});

describe("deriveAdminAlertCount", () => {
  it("sums critical, flagged, and pending donations", () => {
    expect(deriveAdminAlertCount(sampleStats, 7)).toBe(15);
  });

  it("returns zero without stats", () => {
    expect(deriveAdminAlertCount(undefined, 3)).toBe(0);
  });
});
