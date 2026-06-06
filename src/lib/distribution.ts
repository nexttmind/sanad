import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type DistributionEventRow = Database["public"]["Tables"]["distribution_events"]["Row"];
export type DistributionStatus = Database["public"]["Enums"]["distribution_status"];

export type EventWithStats = DistributionEventRow & {
  approved_count: number;
  done_count: number;
};

export type DistributionRequestRow = {
  id: string;
  reference_code: string;
  full_name: string;
  family_size: number;
  needs: string[];
  status: Database["public"]["Enums"]["request_status"];
  qr_pin?: string | null;
};

export type ExistingCompletion = {
  scanned_at: string;
  event_name: string | null;
  event_location: string | null;
};

export const DISTRIBUTION_STATUS_AR: Record<DistributionStatus, string> = {
  scheduled: "قادم",
  in_progress: "جارٍ",
  completed: "مكتمل",
  cancelled: "ملغى",
};

export function parseSanadQrPayload(raw: string): { refCode: string; requestId: string } | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("SANAD:")) return null;
  const parts = trimmed.split(":");
  if (parts.length < 3) return null;
  return { refCode: parts[1], requestId: parts[2] };
}

export async function fetchDistributionEvents(): Promise<EventWithStats[]> {
  const [eventsRes, approvedRes, completionsRes] = await Promise.all([
    supabase.from("distribution_events").select("*").order("scheduled_at", { ascending: false }),
    supabase.from("aid_requests").select("id", { count: "exact", head: true }).eq("status", "approved"),
    supabase.from("qr_completions").select("event_id"),
  ]);

  if (eventsRes.error) throw eventsRes.error;
  const approvedCount = approvedRes.count ?? 0;
  const doneByEvent: Record<string, number> = {};
  for (const row of completionsRes.data ?? []) {
    if (row.event_id) doneByEvent[row.event_id] = (doneByEvent[row.event_id] ?? 0) + 1;
  }

  return (eventsRes.data ?? []).map((e) => ({
    ...e,
    approved_count: approvedCount,
    done_count: doneByEvent[e.id] ?? 0,
  }));
}

export async function createDistributionEvent(input: {
  name: string;
  location: string;
  scheduled_at: string;
  notes?: string | null;
  capacity?: number | null;
  created_by?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("distribution_events").insert({
    name: input.name.trim(),
    location: input.location.trim(),
    scheduled_at: input.scheduled_at,
    notes: input.notes?.trim() || null,
    capacity: input.capacity ?? null,
    created_by: input.created_by ?? null,
    status: "scheduled",
  });
  if (error) throw error;
}

export async function updateDistributionEventStatus(
  id: string,
  status: DistributionStatus,
): Promise<void> {
  const { error } = await supabase.from("distribution_events").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function fetchApprovedRequests(): Promise<DistributionRequestRow[]> {
  const { data, error } = await supabase
    .from("aid_requests")
    .select("id, reference_code, full_name, family_size, needs, status, qr_pin")
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as DistributionRequestRow[] | null) ?? [];
}

export async function resolveRequestId(refOrPayload: string): Promise<string | null> {
  const parsed = parseSanadQrPayload(refOrPayload);
  if (parsed?.requestId) return parsed.requestId;

  const code = refOrPayload.trim();
  if (!code) return null;

  const { data, error } = await supabase
    .from("aid_requests")
    .select("id")
    .eq("reference_code", code)
    .maybeSingle();

  if (error) throw error;
  return data?.id ?? null;
}

export async function fetchRequestForDistribution(
  requestId: string,
): Promise<DistributionRequestRow | null> {
  const { data, error } = await supabase
    .from("aid_requests")
    .select("id, reference_code, full_name, family_size, needs, status, qr_pin")
    .eq("id", requestId)
    .maybeSingle();

  if (error) throw error;
  return (data as DistributionRequestRow | null) ?? null;
}

export async function findExistingCompletion(
  requestId: string,
): Promise<ExistingCompletion | null> {
  const { data, error } = await supabase
    .from("qr_completions")
    .select("scanned_at, distribution_events(name, location)")
    .eq("request_id", requestId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const ev = data.distribution_events as { name: string; location: string } | null;
  return {
    scanned_at: data.scanned_at,
    event_name: ev?.name ?? null,
    event_location: ev?.location ?? null,
  };
}

export type CompleteDistributionResult =
  | { ok: true }
  | { ok: false; code: "not_found" | "not_approved" | "bad_pin" | "duplicate" | "db"; message: string };

export async function completeDistribution(params: {
  requestId: string;
  pin: string;
  eventId: string | null;
  eventLocation: string;
  scannedBy: string;
}): Promise<CompleteDistributionResult> {
  const request = await fetchRequestForDistribution(params.requestId);
  if (!request) return { ok: false, code: "not_found", message: "لم يتم العثور على الطلب." };
  if (request.status !== "approved") {
    return { ok: false, code: "not_approved", message: "الطلب غير معتمد للتوزيع." };
  }

  const existing = await findExistingCompletion(params.requestId);
  if (existing) {
    const where = existing.event_location ?? existing.event_name ?? "جلسة سابقة";
    return {
      ok: false,
      code: "duplicate",
      message: `تم تسجيل استلام سابق في ${where} — ${new Date(existing.scanned_at).toLocaleString("ar-LB")}`,
    };
  }

  const expectedPin = request.qr_pin;
  if (!expectedPin || params.pin.trim() !== expectedPin) {
    return { ok: false, code: "bad_pin", message: "رمز PIN غير صحيح." };
  }

  const { error: insertError } = await supabase.from("qr_completions").insert({
    request_id: params.requestId,
    event_id: params.eventId,
    pin: params.pin.trim(),
    scanned_by: params.scannedBy,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return { ok: false, code: "duplicate", message: "تم تسجيل هذا الطلب مسبقاً." };
    }
    return { ok: false, code: "db", message: "تعذّر تسجيل الاستلام." };
  }

  const { error: updateError } = await (supabase as SupabaseClient)
    .from("aid_requests")
    .update({
      status: "distributed",
      distribution_location: params.eventLocation,
      distribution_date: new Date().toISOString().slice(0, 10),
    } as never)
    .eq("id", params.requestId);

  if (updateError) return { ok: false, code: "db", message: "تعذّر تحديث حالة الطلب." };

  if (params.eventId) {
    await supabase
      .from("distribution_events")
      .update({ status: "in_progress" })
      .eq("id", params.eventId)
      .eq("status", "scheduled");
  }

  return { ok: true };
}
