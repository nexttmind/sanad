import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logAdminAction } from "@/lib/audit-log";
import type { AidRowExtended } from "@/lib/request-detail-types";

type Props = {
  request: AidRowExtended;
  actorName: string;
  userId: string;
  onChanged: () => void;
};

export function UrgencyOverrideSection({ request, actorName, userId, onChanged }: Props) {
  const [manualScore, setManualScore] = useState(
    request.manual_urgency != null ? String(request.manual_urgency) : "",
  );
  const [manualReason, setManualReason] = useState(request.manual_urgency_reason ?? "");
  const [clearReason, setClearReason] = useState("");
  const [saving, setSaving] = useState(false);

  const applyManual = async () => {
    const score = Number(manualScore);
    if (!Number.isFinite(score) || score < 0 || score > 100) return;
    if (!manualReason.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("aid_requests")
      .update({
        manual_urgency: score,
        manual_urgency_reason: manualReason.trim(),
        manual_urgency_by: userId,
        manual_urgency_at: new Date().toISOString(),
      })
      .eq("id", request.id);
    if (!error) {
      await logAdminAction({
        action: "urgency_override",
        entityId: request.id,
        oldValue: {
          manual_urgency: request.manual_urgency,
          effective_urgency: request.effective_urgency,
        },
        newValue: { manual_urgency: score, reason: manualReason.trim() },
        metadata: { reference_code: request.reference_code },
        actorName,
      });
      onChanged();
    }
    setSaving(false);
  };

  const clearManual = async () => {
    if (!clearReason.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("aid_requests")
      .update({
        manual_urgency: null,
        manual_urgency_reason: null,
        manual_urgency_by: null,
        manual_urgency_at: null,
      })
      .eq("id", request.id);
    if (!error) {
      await logAdminAction({
        action: "urgency_override",
        entityId: request.id,
        oldValue: {
          manual_urgency: request.manual_urgency,
          reason: request.manual_urgency_reason,
        },
        newValue: { manual_urgency: null, reason: clearReason.trim() },
        metadata: { reference_code: request.reference_code, cleared: true },
        actorName,
      });
      setManualScore("");
      setManualReason("");
      setClearReason("");
      onChanged();
    }
    setSaving(false);
  };

  const togglePriority = async (enabled: boolean) => {
    setSaving(true);
    const { error } = await supabase
      .from("aid_requests")
      .update({ priority_override: enabled })
      .eq("id", request.id);
    if (!error) {
      await logAdminAction({
        action: enabled ? "priority_override_set" : "priority_override_cleared",
        entityId: request.id,
        oldValue: { priority_override: request.priority_override },
        newValue: { priority_override: enabled },
        metadata: { reference_code: request.reference_code },
        actorName,
      });
      onChanged();
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4 text-sm">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={Boolean(request.priority_override)}
          disabled={saving}
          onChange={(e) => void togglePriority(e.target.checked)}
        />
        <span>أولوية عاجلة (حد أدنى {request.priority_override_floor ?? 85})</span>
      </label>

      <div className="grid gap-2">
        <label className="text-xs text-muted-foreground">تعديل يدوي (0–100)</label>
        <input
          type="number"
          min={0}
          max={100}
          value={manualScore}
          onChange={(e) => setManualScore(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          placeholder="مثال: 90"
        />
        <textarea
          rows={2}
          value={manualReason}
          onChange={(e) => setManualReason(e.target.value)}
          placeholder="سبب التعديل (مطلوب)"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={saving || !manualReason.trim()}
          onClick={() => void applyManual()}
          className="rounded-md border border-border px-3 py-2 text-xs hover:border-clay disabled:opacity-50"
        >
          حفظ التعديل اليدوي
        </button>
      </div>

      {request.manual_urgency != null && (
        <div className="grid gap-2 border-t border-border pt-3">
          <label className="text-xs text-muted-foreground">إلغاء التعديل اليدوي</label>
          <textarea
            rows={2}
            value={clearReason}
            onChange={(e) => setClearReason(e.target.value)}
            placeholder="سبب الإلغاء (مطلوب)"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={saving || !clearReason.trim()}
            onClick={() => void clearManual()}
            className="rounded-md border border-destructive/40 px-3 py-2 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            إلغاء التعديل
          </button>
        </div>
      )}
    </div>
  );
}
