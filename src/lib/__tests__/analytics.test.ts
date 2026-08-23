import { describe, expect, it } from "vitest";
import {
  analyticsRegionKey,
  distributionProgress,
  needsBreakdown,
  parseDateRange,
  regionalBreakdown,
  scoreBuckets,
  submissionTrend,
  topFraudFlags,
  vulnerabilityCounts,
  type AnalyticsRequestRow,
} from "@/lib/analytics";

const sampleRows: AnalyticsRequestRow[] = [
  {
    created_at: "2026-06-01T10:00:00.000Z",
    needs: ["طعام", "دواء"],
    town: "النبطية",
    current_address: "صيدا",
    origin_town: "حاروف",
    trust_score: 85,
    urgency_score: 70,
    status: "approved",
    disabled: false,
    infants: 1,
    chronic_illness: true,
    elderly: 0,
  },
  {
    created_at: "2026-06-02T14:00:00.000Z",
    needs: ["طعام"],
    town: "صور",
    current_address: "بيروت — المدينة الرياضية",
    origin_town: "العباسية",
    trust_score: 45,
    urgency_score: 55,
    status: "distributed",
    disabled: true,
    infants: 0,
    chronic_illness: false,
    elderly: 2,
  },
  {
    created_at: "2026-06-03T09:00:00.000Z",
    needs: ["ملابس"],
    town: "بنت جبيل",
    current_address: null,
    origin_town: "بنت جبيل",
    trust_score: 25,
    urgency_score: 90,
    status: "submitted",
    disabled: false,
    infants: 0,
    chronic_illness: false,
    elderly: 0,
  },
];

describe("analytics pure functions", () => {
  const range = parseDateRange("2026-06-01", "2026-06-05");

  it("parseDateRange sets start/end of day boundaries", () => {
    expect(range.from.getHours()).toBe(0);
    expect(range.to.getHours()).toBe(23);
    expect(parseDateRange("2026-06-01", "2026-06-05").from.getDate()).toBe(1);
  });

  it("needsBreakdown counts need tags", () => {
    const breakdown = needsBreakdown(sampleRows);
    expect(breakdown[0]).toEqual(["طعام", 2]);
    expect(breakdown.find(([k]) => k === "دواء")).toEqual(["دواء", 1]);
  });

  it("analyticsRegionKey prefers current_address over pre-displacement origin", () => {
    expect(analyticsRegionKey(sampleRows[0])).toBe("صيدا");
    expect(analyticsRegionKey(sampleRows[1])).toBe("بيروت — المدينة الرياضية");
    expect(analyticsRegionKey(sampleRows[2])).toBe("غير محدد");
  });

  it("regionalBreakdown groups by current location, not origin town", () => {
    const regions = regionalBreakdown(sampleRows);
    expect(regions.some(([k]) => k === "صيدا")).toBe(true);
    expect(regions.some(([k]) => k === "بيروت — المدينة الرياضية")).toBe(true);
    expect(regions.some(([k]) => k === "بنت جبيل")).toBe(false);
  });

  it("vulnerabilityCounts tallies flags", () => {
    const counts = Object.fromEntries(vulnerabilityCounts(sampleRows));
    expect(counts["ذوو إعاقة"]).toBe(1);
    expect(counts["رضّع"]).toBe(1);
    expect(counts["مرض مزمن"]).toBe(1);
    expect(counts["كبار سن"]).toBe(1);
  });

  it("scoreBuckets assigns trust scores to ranges", () => {
    const buckets = scoreBuckets(sampleRows, "trust_score");
    const total = buckets.reduce((s, b) => s + b.count, 0);
    expect(total).toBe(3);
    expect(buckets.find((b) => b.label === "80–100")?.count).toBe(1);
    expect(buckets.find((b) => b.label === "20–39")?.count).toBe(1);
  });

  it("distributionProgress computes rate", () => {
    const p = distributionProgress(sampleRows);
    expect(p.approved).toBe(1);
    expect(p.distributed).toBe(1);
    expect(p.rate).toBe(50);
  });

  it("topFraudFlags ranks by count", () => {
    const flags = topFraudFlags([
      { code: "DUPLICATE_PHONE", created_at: "2026-06-01" },
      { code: "DUPLICATE_PHONE", created_at: "2026-06-02" },
      { code: "DEVICE_REUSED", created_at: "2026-06-03" },
    ]);
    expect(flags[0]).toEqual(["DUPLICATE_PHONE", 2]);
  });

  it("submissionTrend daily counts per day", () => {
    const trend = submissionTrend(sampleRows, range, "daily");
    const total = trend.reduce((s, d) => s + d.count, 0);
    expect(total).toBe(3);
    expect(trend.length).toBeGreaterThan(0);
  });
});
