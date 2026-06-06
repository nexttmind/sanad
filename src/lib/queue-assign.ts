import { supabase } from "@/integrations/supabase/client";
import { logAdminAction } from "@/lib/audit-log";

export type BulkAssignCandidate = {
  id: string;
  reference_code: string;
  assigned_to: string | null;
};

/** Pick the first N rows from the priority-ordered queue, skipping assigned unless requested. */
export function selectTopForBulkAssign(
  rows: BulkAssignCandidate[],
  limit: number,
  includeAlreadyAssigned = false,
): BulkAssignCandidate[] {
  if (limit < 1) return [];
  const picked: BulkAssignCandidate[] = [];
  for (const row of rows) {
    if (picked.length >= limit) break;
    if (!includeAlreadyAssigned && row.assigned_to) continue;
    picked.push(row);
  }
  return picked;
}

export type BulkAssignResult =
  | { ok: true; assigned: number; reference_codes: string[] }
  | { ok: false; message: string };

export async function bulkAssignReviewer(
  picked: BulkAssignCandidate[],
  reviewerId: string,
  actorName: string,
): Promise<BulkAssignResult> {
  if (!reviewerId) {
    return { ok: false, message: "يرجى اختيار مراجع." };
  }
  if (picked.length === 0) {
    return { ok: false, message: "لا توجد طلبات غير معيّنة ضمن أول الدور." };
  }

  const ids = picked.map((p) => p.id);
  const { error } = await supabase.from("aid_requests").update({ assigned_to: reviewerId }).in("id", ids);
  if (error) {
    if (import.meta.env.DEV) console.error("[Queue] bulk assign:", error);
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

  return {
    ok: true,
    assigned: picked.length,
    reference_codes: picked.map((p) => p.reference_code),
  };
}
