import { describe, expect, it } from "vitest";
import {
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
    governorate: "النبطية",
    origin_town: null,
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
    governorate: "صور",
    origin_town: null,
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
    governorate: "",
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

  it("regionalBreakdown groups by governorate or town", () => {
    const regions = regionalBreakdown(sampleRows);
    expect(regions.some(([k]) => k === "النبطية")).toBe(true);
    expect(regions.some(([k]) => k === "بنت جبيل")).toBe(true);
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
