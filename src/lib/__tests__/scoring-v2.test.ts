import { describe, expect, it } from "vitest";
import {
  displayUrgencyScore,
  parseUrgencyBreakdown,
  reasonLabel,
  tierFromScore,
  TIER_LABELS,
  urgencyBarColor,
  urgencyScoreColor,
} from "@/lib/scoring";
import {
  formatQueueNumber,
  formatQueuePosition,
  formatWaitDuration,
} from "@/lib/queue";
import { buildFiltersJson, DEFAULT_SUBMISSION_SORT, loadSavedPageSize, PAGE_SIZE_OPTIONS, savePageSize } from "@/lib/submissions-list";
import { canExport, exportFilename } from "@/lib/export-submissions";

describe("scoring", () => {
  it("parseUrgencyBreakdown reads v2 shape", () => {
    const parsed = parseUrgencyBreakdown({
      version: 2,
      raw_total: 78,
      normalized: 74,
      tier: "high",
      categories: {
        shelter: { points: 25, max: 25, reasons: ["school_shelter"] },
      },
    });
    expect(parsed?.normalized).toBe(74);
    expect(parsed?.categories.shelter?.points).toBe(25);
    expect(parsed?.categories.shelter?.reasons).toEqual(["school_shelter"]);
  });

  it("parseUrgencyBreakdown rejects invalid payloads", () => {
    expect(parseUrgencyBreakdown(null)).toBeNull();
    expect(parseUrgencyBreakdown([])).toBeNull();
    expect(parseUrgencyBreakdown({ raw_total: 10 })).toBeNull();
    expect(parseUrgencyBreakdown({ raw_total: 10, normalized: "bad" })).toBeNull();
  });

  it("tierFromScore maps PRD v2 thresholds", () => {
    expect(tierFromScore(90)).toBe("critical");
    expect(tierFromScore(85)).toBe("critical");
    expect(tierFromScore(84)).toBe("high");
    expect(tierFromScore(70)).toBe("high");
    expect(tierFromScore(69)).toBe("medium");
    expect(tierFromScore(45)).toBe("medium");
    expect(tierFromScore(44)).toBe("low");
    expect(TIER_LABELS.critical).toBe("حرج");
  });

  it("displayUrgencyScore prefers effective over calculated", () => {
    expect(displayUrgencyScore(92, 74)).toBe(92);
    expect(displayUrgencyScore(null, 74)).toBe(74);
    expect(displayUrgencyScore(undefined, 50)).toBe(50);
  });

  it("urgencyScoreColor and urgencyBarColor follow tier thresholds", () => {
    expect(urgencyScoreColor(90)).toBe("text-destructive");
    expect(urgencyScoreColor(75)).toBe("text-warning");
    expect(urgencyScoreColor(50)).toBe("text-accent");
    expect(urgencyScoreColor(20)).toBe("text-muted-foreground");

    expect(urgencyBarColor(90)).toBe("bg-destructive");
    expect(urgencyBarColor(75)).toBe("bg-warning");
    expect(urgencyBarColor(50)).toBe("bg-accent");
    expect(urgencyBarColor(20)).toBe("bg-foreground/40");
  });

  it("reasonLabel falls back to code", () => {
    expect(reasonLabel("school_shelter")).toContain("مدرس");
    expect(reasonLabel("reference_denied")).toContain("−10");
    expect(reasonLabel("unknown_code")).toBe("unknown_code");
  });
});

describe("queue formatters", () => {
  it("formatQueueNumber zero-pads", () => {
    expect(formatQueueNumber(42)).toBe("#000042");
    expect(formatQueueNumber(null)).toBe("—");
  });

  it("formatQueuePosition uses Arabic locale separators", () => {
    const text = formatQueuePosition(3, 10);
    expect(text).toContain("من");
    expect(text).toContain("قيد المعالجة");
  });

  it("formatWaitDuration shows days or hours", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString();
    expect(formatWaitDuration(twoDaysAgo)).toContain("2");
  });
});

describe("submissions-list helpers", () => {
  it("buildFiltersJson omits empty values", () => {
    expect(buildFiltersJson({ search: "  ", status: "all" })).toEqual({});
    expect(buildFiltersJson({ search: "Ali", status: "submitted" })).toEqual({
      search: "Ali",
      status: "submitted",
    });
    expect(buildFiltersJson({ governorate: "قضاء صور", tag_ids: ["t1"] })).toEqual({
      governorate: "قضاء صور",
      tag_ids: ["t1"],
    });
  });

  it("DEFAULT_SUBMISSION_SORT is effective urgency desc", () => {
    expect(DEFAULT_SUBMISSION_SORT).toEqual({
      field: "effective_urgency",
      direction: "desc",
    });
  });

  it("PAGE_SIZE_OPTIONS includes 25, 50, 100", () => {
    expect(PAGE_SIZE_OPTIONS).toEqual([25, 50, 100]);
    expect(loadSavedPageSize()).toBeGreaterThan(0);
    savePageSize(25);
    expect(loadSavedPageSize()).toBe(25);
  });
});

describe("export-submissions", () => {
  it("canExport blocks viewer-only", () => {
    expect(canExport(["viewer"])).toBe(false);
    expect(canExport(["viewer", "reviewer"])).toBe(true);
    expect(canExport(["admin"])).toBe(true);
  });

  it("exportFilename includes date stamp", () => {
    expect(exportFilename()).toMatch(/^sanad-submissions-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
