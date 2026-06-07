import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export const AUDIT_ACTIONS = [
  "status_change",
  "note_added",
  "document_verified",
  "document_rejected",
  "reference_contacted",
  "fraud_resolved",
  "tag_added",
  "tag_removed",
  "reviewer_assigned",
  "score_recalculated",
  "export_csv",
  "donation_verified",
  "donation_rejected",
  "urgency_override",
  "priority_override_set",
  "priority_override_cleared",
  "scoring_config_updated",
  "public_site_config_updated",
  "queue_integrity_check",
  "field_updated",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  status_change: "غيّر حالة الطلب",
  note_added: "أضاف ملاحظة",
  document_verified: "تحقّق من وثيقة",
  document_rejected: "رفض وثيقة",
  reference_contacted: "تواصل مع المرجع",
  fraud_resolved: "حلّ إشارة احتيال",
  tag_added: "أضاف وسم",
  tag_removed: "أزال وسم",
  reviewer_assigned: "عيّن مراجعاً",
  score_recalculated: "إعادة احتساب الثقة",
  export_csv: "تصدير CSV",
  donation_verified: "وثّق تبرّعاً",
  donation_rejected: "رفض تبرّعاً",
  urgency_override: "تعديل عجلة يدوي",
  priority_override_set: "تفعيل أولوية",
  priority_override_cleared: "إلغاء أولوية",
  scoring_config_updated: "تحديث قواعد العجلة",
  public_site_config_updated: "تحديث إعدادات الموقع العام",
  queue_integrity_check: "فحص سلامة الدور",
  field_updated: "تعديل بيانات الطلب",
};

type AuditDiff = {
  old_value?: Record<string, unknown> | null;
  new_value?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  ip_address?: string | null;
};

export type WriteAuditLogParams = {
  action: AuditAction;
  entityId?: string | null;
  entity?: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  actorName?: string | null;
  ipAddress?: string | null;
};

let cachedIp: string | null | undefined;

async function getClientIp(): Promise<string | null> {
  if (cachedIp !== undefined) return cachedIp;
  try {
    const res = await fetch("https://api.ipify.org?format=json", {
      signal: AbortSignal.timeout(3000),
    });
    const json = (await res.json()) as { ip?: string };
    cachedIp = typeof json.ip === "string" ? json.ip : null;
  } catch {
    cachedIp = null;
  }
  return cachedIp;
}

export async function writeAuditLog(params: WriteAuditLogParams): Promise<void> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error("Not authenticated");

  const ip = params.ipAddress ?? (await getClientIp());

  const diff: AuditDiff = {
    old_value: params.oldValue ?? null,
    new_value: params.newValue ?? null,
    metadata: {
      ...(params.metadata ?? {}),
      ...(params.actorName ? { actor_name: params.actorName } : {}),
    },
    ip_address: ip,
  };

  const { error } = await supabase.from("audit_log").insert({
    actor_id: authData.user.id,
    action: params.action,
    entity: params.entity ?? "aid_request",
    entity_id: params.entityId ?? null,
    diff: diff as Json,
  });

  if (error) throw error;
}

/** Fire-and-forget wrapper — never blocks the primary admin action. */
export async function logAdminAction(params: WriteAuditLogParams): Promise<void> {
  try {
    await writeAuditLog(params);
  } catch (err) {
    if (import.meta.env.DEV) console.error("[Audit] write failed:", err);
  }
}

export function parseAuditDiff(diff: Json | null): AuditDiff {
  if (!diff || typeof diff !== "object" || Array.isArray(diff)) {
    return {};
  }
  const d = diff as Record<string, unknown>;
  return {
    old_value: (d.old_value as Record<string, unknown> | null) ?? null,
    new_value: (d.new_value as Record<string, unknown> | null) ?? null,
    metadata: (d.metadata as Record<string, unknown> | null) ?? null,
    ip_address: typeof d.ip_address === "string" ? d.ip_address : null,
  };
}

export function maskIp(ip: string | null | undefined): string {
  if (!ip) return "—";
  const parts = ip.split(".");
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.x.x`;
  return ip.slice(0, 8) + "…";
}
