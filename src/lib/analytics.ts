import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AnalyticsRequestRow = Pick<
  Database["public"]["Tables"]["aid_requests"]["Row"],
  | "created_at"
  | "needs"
  | "governorate"
  | "origin_town"
  | "trust_score"
  | "urgency_score"
  | "status"
  | "disabled"
  | "infants"
  | "chronic_illness"
  | "elderly"
>;

export type FraudEventRow = Pick<
  Database["public"]["Tables"]["fraud_events"]["Row"],
  "code" | "created_at"
>;

export type DateRange = {
  from: Date;
  to: Date;
};

export type TrendPeriod = "daily" | "weekly" | "monthly";

export type AnalyticsSnapshot = {
  requests: AnalyticsRequestRow[];
  fraudEvents: FraudEventRow[];
};

const TRUST_BUCKETS = [
  { label: "0–19", min: 0, max: 19 },
  { label: "20–39", min: 20, max: 39 },
  { label: "40–59", min: 40, max: 59 },
  { label: "60–79", min: 60, max: 79 },
  { label: "80–100", min: 80, max: 100 },
] as const;

export function defaultDateRange(): DateRange {
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  const from = new Date();
  from.setDate(from.getDate() - 29);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

export function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseDateRange(fromStr: string, toStr: string): DateRange {
  const from = new Date(`${fromStr}T00:00:00`);
  const to = new Date(`${toStr}T23:59:59.999`);
  return { from, to };
}

const ANALYTICS_ROW_LIMIT = 10_000;

export async function fetchAnalyticsData(range: DateRange): Promise<AnalyticsSnapshot> {
  const fromIso = range.from.toISOString();
  const toIso = range.to.toISOString();

  const [reqRes, fraudRes] = await Promise.all([
    supabase
      .from("aid_requests")
      .select(
        "created_at, needs, governorate, origin_town, trust_score, urgency_score, status, disabled, infants, chronic_illness, elderly",
      )
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .order("created_at", { ascending: false })
      .limit(ANALYTICS_ROW_LIMIT),
    supabase
      .from("fraud_events")
      .select("code, created_at")
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .order("created_at", { ascending: false })
      .limit(ANALYTICS_ROW_LIMIT),
  ]);

  if (reqRes.error) throw reqRes.error;
  if (fraudRes.error) throw fraudRes.error;

  return {
    requests: (reqRes.data as AnalyticsRequestRow[] | null) ?? [],
    fraudEvents: (fraudRes.data as FraudEventRow[] | null) ?? [],
  };
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function inRange(iso: string, range: DateRange): boolean {
  const t = new Date(iso);
  return t >= range.from && t <= range.to;
}

export function submissionTrend(
  rows: AnalyticsRequestRow[],
  range: DateRange,
  period: TrendPeriod,
): { label: string; count: number }[] {
  const filtered = rows.filter((r) => inRange(r.created_at, range));

  if (period === "daily") {
    const days: { label: string; count: number; start: Date }[] = [];
    const cursor = startOfDay(range.from);
    const end = startOfDay(range.to);
    while (cursor <= end && days.length < 31) {
      const next = new Date(cursor);
      next.setDate(next.getDate() + 1);
      const count = filtered.filter((r) => {
        const t = new Date(r.created_at);
        return t >= cursor && t < next;
      }).length;
      days.push({
        label: cursor.toLocaleDateString("ar-LB", { weekday: "short", day: "numeric" }),
        count,
        start: new Date(cursor),
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }

  if (period === "weekly") {
    const weeks: { label: string; count: number }[] = [];
    const end = startOfDay(range.to);
    for (let i = 11; i >= 0; i--) {
      const weekEnd = new Date(end);
      weekEnd.setDate(weekEnd.getDate() - i * 7);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 6);
      weekStart.setHours(0, 0, 0, 0);
      weekEnd.setHours(23, 59, 59, 999);
      if (weekStart < range.from) weekStart.setTime(range.from.getTime());
      const count = filtered.filter((r) => {
        const t = new Date(r.created_at);
        return t >= weekStart && t <= weekEnd;
      }).length;
      weeks.push({
        label: weekEnd.toLocaleDateString("ar-LB", { month: "short", day: "numeric" }),
        count,
      });
    }
    return weeks;
  }

  const months: { label: string; count: number }[] = [];
  const cursor = new Date(range.from.getFullYear(), range.from.getMonth(), 1);
  const endMonth = new Date(range.to.getFullYear(), range.to.getMonth(), 1);
  while (cursor <= endMonth && months.length < 12) {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    const count = filtered.filter((r) => {
      const t = new Date(r.created_at);
      return t >= cursor && t < next;
    }).length;
    months.push({
      label: cursor.toLocaleDateString("ar-LB", { month: "short", year: "2-digit" }),
      count,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

export function needsBreakdown(rows: AnalyticsRequestRow[]): [string, number][] {
  const map = new Map<string, number>();
  for (const r of rows) {
    for (const n of r.needs) {
      map.set(n, (map.get(n) ?? 0) + 1);
    }
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
}

export function regionalBreakdown(rows: AnalyticsRequestRow[]): [string, number][] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const key = r.governorate?.trim() || r.origin_town?.trim() || "غير محدد";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
}

export function vulnerabilityCounts(rows: AnalyticsRequestRow[]): [string, number][] {
  return [
    ["ذوو إعاقة", rows.filter((r) => r.disabled).length],
    ["رضّع", rows.filter((r) => r.infants > 0).length],
    ["مرض مزمن", rows.filter((r) => r.chronic_illness).length],
    ["كبار سن", rows.filter((r) => r.elderly > 0).length],
  ];
}

export function scoreBuckets(
  rows: AnalyticsRequestRow[],
  field: "trust_score" | "urgency_score",
): { label: string; count: number }[] {
  return TRUST_BUCKETS.map((b) => ({
    label: b.label,
    count: rows.filter((r) => {
      const v = r[field];
      return v >= b.min && v <= b.max;
    }).length,
  }));
}

export function distributionProgress(rows: AnalyticsRequestRow[]): {
  approved: number;
  distributed: number;
  rate: number;
} {
  const approved = rows.filter((r) => r.status === "approved").length;
  const distributed = rows.filter((r) => r.status === "distributed").length;
  const total = approved + distributed;
  const rate = total > 0 ? Math.round((distributed / total) * 100) : 0;
  return { approved, distributed, rate };
}

export function topFraudFlags(events: FraudEventRow[]): [string, number][] {
  const map = new Map<string, number>();
  for (const e of events) {
    map.set(e.code, (map.get(e.code) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
}
