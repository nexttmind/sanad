import { supabase } from "@/integrations/supabase/client";
import { logAdminAction } from "@/lib/audit-log";
import type { Database } from "@/integrations/supabase/types";

type DbStatus = Database["public"]["Enums"]["request_status"];

export type BulkRequestRef = {
  id: string;
  reference_code: string;
  status: DbStatus;
};

type BulkOk = { ok: true; updated: number };
type BulkErr = { ok: false; message: string };
export type BulkActionResult = BulkOk | BulkErr;

export async function bulkAssignRequests(
  picked: BulkRequestRef[],
  reviewerId: string,
  actorName: string,
): Promise<BulkActionResult> {
  if (!reviewerId) {
    return { ok: false, message: "يرجى اختيار مراجع." };
  }
  if (picked.length === 0) {
    return { ok: false, message: "لم يتم تحديد أي طلب." };
  }

  const ids = picked.map((p) => p.id);
  const { error } = await supabase.from("aid_requests").update({ assigned_to: reviewerId }).in("id", ids);
  if (error) {
    if (import.meta.env.DEV) console.error("[Bulk] assign:", error);
    return { ok: false, message: "تعذّر تعيين المراجع." };
  }

  await Promise.all(
    picked.map((p) =>
      logAdminAction({
        action: "reviewer_assigned",
        entityId: p.id,
        newValue: { reviewer_id: reviewerId, bulk: true },
        metadata: { reference_code: p.reference_code },
        actorName,
      }),
    ),
  );

  return { ok: true, updated: picked.length };
}

export async function bulkUpdateRequestStatus(
  picked: BulkRequestRef[],
  status: DbStatus,
  actorName: string,
  reason?: string,
): Promise<BulkActionResult> {
  if (picked.length === 0) {
    return { ok: false, message: "لم يتم تحديد أي طلب." };
  }
  if (status === "rejected" && !reason?.trim()) {
    return { ok: false, message: "سبب الرفض مطلوب." };
  }

  const patch: { status: DbStatus; rejection_reason?: string } = { status };
  if (status === "rejected" && reason) patch.rejection_reason = reason.trim();

  const ids = picked.map((p) => p.id);
  const { error } = await supabase.from("aid_requests").update(patch).in("id", ids);
  if (error) {
    if (import.meta.env.DEV) console.error("[Bulk] status:", error);
    return { ok: false, message: "تعذّر تحديث الحالة." };
  }

  await Promise.all(
    picked.map((p) =>
      logAdminAction({
        action: "status_change",
        entityId: p.id,
        oldValue: { status: p.status },
        newValue: { status, ...(reason ? { reason: reason.trim() } : {}), bulk: true },
        metadata: { reference_code: p.reference_code },
        actorName,
      }),
    ),
  );

  return { ok: true, updated: picked.length };
}

export async function bulkAddTagToRequests(
  picked: BulkRequestRef[],
  tagId: string,
  tagName: string,
  actorName: string,
): Promise<BulkActionResult> {
  if (!tagId) {
    return { ok: false, message: "يرجى اختيار وسم." };
  }
  if (picked.length === 0) {
    return { ok: false, message: "لم يتم تحديد أي طلب." };
  }

  const rows = picked.map((p) => ({ request_id: p.id, tag_id: tagId }));
  const { error } = await supabase.from("request_tags").upsert(rows, {
    onConflict: "request_id,tag_id",
    ignoreDuplicates: true,
  });
  if (error) {
    if (import.meta.env.DEV) console.error("[Bulk] tag:", error);
    return { ok: false, message: "تعذّر إضافة الوسم." };
  }

  await Promise.all(
    picked.map((p) =>
      logAdminAction({
        action: "tag_added",
        entityId: p.id,
        newValue: { tag: tagName, bulk: true },
        metadata: { reference_code: p.reference_code },
        actorName,
      }),
    ),
  );

  return { ok: true, updated: picked.length };
}
