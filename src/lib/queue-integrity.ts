import { supabase } from "@/integrations/supabase/client";
import { logAdminAction } from "@/lib/audit-log";

export type QueueIntegrityRequestRef = {
  id: string;
  reference_code: string;
  queue_number?: number;
  status?: string;
};

export type QueueNumberDuplicate = {
  queue_number: number;
  count: number;
  requests: QueueIntegrityRequestRef[];
};

export type DuplicatePhoneGroup = {
  phone: string;
  count: number;
  requests: QueueIntegrityRequestRef[];
};

export type QueueIntegrityReport = {
  checked_at: string;
  healthy: boolean;
  queue_numbers: {
    unique: boolean;
    total_assigned: number;
    max: number;
    duplicates: QueueNumberDuplicate[];
  };
  sequence: {
    ok: boolean;
    last_value: number;
    next_value: number;
    max_queue_number: number;
  };
  duplicate_phones_pending: DuplicatePhoneGroup[];
  pending_total: number;
};

function asRequestRefs(raw: unknown): QueueIntegrityRequestRef[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object" && !Array.isArray(r))
    .map((r) => ({
      id: String(r.id ?? ""),
      reference_code: String(r.reference_code ?? ""),
      queue_number: r.queue_number != null ? Number(r.queue_number) : undefined,
      status: r.status != null ? String(r.status) : undefined,
    }))
    .filter((r) => r.id.length > 0);
}

function parseDuplicates(raw: unknown): QueueNumberDuplicate[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((d): d is Record<string, unknown> => !!d && typeof d === "object" && !Array.isArray(d))
    .map((d) => ({
      queue_number: Number(d.queue_number ?? 0),
      count: Number(d.count ?? 0),
      requests: asRequestRefs(d.requests),
    }));
}

function parsePhoneDuplicates(raw: unknown): DuplicatePhoneGroup[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((d): d is Record<string, unknown> => !!d && typeof d === "object" && !Array.isArray(d))
    .map((d) => ({
      phone: String(d.phone ?? ""),
      count: Number(d.count ?? 0),
      requests: asRequestRefs(d.requests),
    }))
    .filter((d) => d.phone.length > 0);
}

export function parseQueueIntegrityReport(data: unknown): QueueIntegrityReport | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const d = data as Record<string, unknown>;
  const queueNumbers = (d.queue_numbers as Record<string, unknown> | undefined) ?? {};
  const sequence = (d.sequence as Record<string, unknown> | undefined) ?? {};

  return {
    checked_at: String(d.checked_at ?? new Date().toISOString()),
    healthy: Boolean(d.healthy),
    queue_numbers: {
      unique: Boolean(queueNumbers.unique),
      total_assigned: Number(queueNumbers.total_assigned ?? 0),
      max: Number(queueNumbers.max ?? 0),
      duplicates: parseDuplicates(queueNumbers.duplicates),
    },
    sequence: {
      ok: Boolean(sequence.ok),
      last_value: Number(sequence.last_value ?? 0),
      next_value: Number(sequence.next_value ?? 0),
      max_queue_number: Number(sequence.max_queue_number ?? 0),
    },
    duplicate_phones_pending: parsePhoneDuplicates(d.duplicate_phones_pending),
    pending_total: Number(d.pending_total ?? 0),
  };
}

export async function runQueueIntegrityCheck(actorName?: string): Promise<QueueIntegrityReport> {
  const { data, error } = await supabase.rpc("check_queue_integrity");
  if (error) throw error;

  const report = parseQueueIntegrityReport(data);
  if (!report) throw new Error("Invalid integrity check response");

  void logAdminAction({
    action: "queue_integrity_check",
    entity: "queue",
    entityId: null,
    newValue: {
      healthy: report.healthy,
      queue_unique: report.queue_numbers.unique,
      sequence_ok: report.sequence.ok,
      duplicate_phones: report.duplicate_phones_pending.length,
    },
    metadata: { checked_at: report.checked_at },
    actorName,
  });

  return report;
}
