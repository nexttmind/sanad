import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminMultiRealtime } from "@/lib/use-admin-realtime";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import {
  AssignReviewerSection,
  DocumentsSection,
  FraudEventsSection,
  ReferenceContactSection,
  TagsSection,
} from "@/components/admin/RequestDetailExtras";
import { UrgencyBreakdownCard } from "@/components/admin/UrgencyBreakdownCard";
import { UrgencyHistoryPanel } from "@/components/admin/UrgencyHistoryPanel";
import { UrgencyOverrideSection } from "@/components/admin/UrgencyOverrideSection";
import { EditableRequestSections } from "@/components/admin/EditableRequestSections";
import { AdminActionModal } from "@/components/admin/AdminActionModal";
import { logAdminAction } from "@/lib/audit-log";
import {
  fetchQueuePosition,
  formatQueueNumber,
  formatQueuePosition,
  formatWaitDuration,
  isPendingStatus,
  type QueuePosition,
} from "@/lib/queue";
import {
  fetchSubmissionReference,
  type SubmissionReferenceWithWhitelist,
} from "@/lib/submission-reference";
import type { AidRowExtended, FileRowExtended } from "@/lib/request-detail-types";
import { fetchUrgencyScoreHistory, type UrgencyHistoryRow } from "@/lib/urgency-history";
import { RequestLifecycleTimeline } from "@/components/admin/RequestLifecycleTimeline";

type Note = Database["public"]["Tables"]["aid_request_notes"]["Row"];
type History = Database["public"]["Tables"]["aid_request_history"]["Row"];
type DbStatus = Database["public"]["Enums"]["request_status"];

const STATUS_AR: Record<DbStatus, string> = {
  submitted: "قيد الانتظار",
  reviewing: "قيد المراجعة",
  verifying: "التحقق",
  approved: "موافق عليه",
  distributed: "تم التوزيع",
  rejected: "مرفوض",
  on_hold: "معلّق",
};

const statusColor: Record<DbStatus, string> = {
  submitted: "bg-warning/15 text-warning border-warning/40",
  reviewing: "bg-accent/15 text-accent border-accent/40",
  verifying: "bg-accent/15 text-accent border-accent/40",
  approved: "bg-success/15 text-success border-success/40",
  distributed: "bg-foreground/10 text-foreground border-foreground/25",
  rejected: "bg-destructive/15 text-destructive border-destructive/40",
  on_hold: "bg-warning/15 text-warning border-warning/40",
};

function formatFlagLabel(flag: string): string {
  if (flag.startsWith("repeat_same_phone_device:")) {
    const priorCode = flag.slice("repeat_same_phone_device:".length);
    return `إعادة تقديم بنفس الرقم والجهاز — طلب سابق: ${priorCode}`;
  }
  return flag;
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `قبل ${Math.floor(diff)} ث`;
  if (diff < 3600) return `قبل ${Math.floor(diff / 60)} د`;
  if (diff < 86400) return `قبل ${Math.floor(diff / 3600)} س`;
  return `قبل ${Math.floor(diff / 86400)} ي`;
}

export const Route = createFileRoute("/admin/requests/$id")({
  component: Detail,
  notFoundComponent: () => <div>لم يتم العثور على الطلب.</div>,
});

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="detail-row">
      <div className="detail-row-label">{label}</div>
      <div className="detail-row-value">{value || "—"}</div>
    </div>
  );
}

function Card({ title, children, actions }: { title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="font-display text-base">{title}</div>
        {actions}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

function Detail() {
  const { id } = Route.useParams();
  const { displayName, user } = useAuth();
  const [s, setS] = useState<AidRowExtended | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [history, setHistory] = useState<History[]>([]);
  const [files, setFiles] = useState<FileRowExtended[]>([]);
  const [reference, setReference] = useState<SubmissionReferenceWithWhitelist | null>(null);
  const [queueInfo, setQueueInfo] = useState<QueuePosition | null>(null);
  const [urgencyHistory, setUrgencyHistory] = useState<UrgencyHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  const load = useCallback(async () => {
    const [r, n, h, f, ref, urgHist] = await Promise.all([
      supabase.from("aid_requests").select("*").eq("id", id).maybeSingle(),
      supabase.from("aid_request_notes").select("*").eq("request_id", id).order("created_at", { ascending: false }),
      supabase.from("aid_request_history").select("*").eq("request_id", id).order("created_at", { ascending: false }),
      supabase.from("aid_request_files").select("*").eq("request_id", id),
      fetchSubmissionReference(id).catch(() => null),
      fetchUrgencyScoreHistory(id, 10).catch(() => [] as UrgencyHistoryRow[]),
    ]);
    setS((r.data as AidRowExtended | null) ?? null);
    setNotes(n.data ?? []);
    setHistory(h.data ?? []);
    setFiles((f.data as FileRowExtended[] | null) ?? []);
    setReference(ref);
    setUrgencyHistory(urgHist);
    try {
      setQueueInfo(await fetchQueuePosition(id));
    } catch {
      setQueueInfo(null);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      await load();
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [id, load]);

  const realtimeSpecs = useMemo(
    () => [
      { table: "aid_requests" as const, filter: `id=eq.${id}` },
      { table: "aid_request_notes" as const, filter: `request_id=eq.${id}` },
      { table: "aid_request_history" as const, filter: `request_id=eq.${id}` },
      { table: "aid_request_files" as const, filter: `request_id=eq.${id}` },
    ],
    [id],
  );

  useAdminMultiRealtime(`admin-request-detail-${id}`, realtimeSpecs, () => {
    void load();
  });

  const updateStatus = async (status: DbStatus, reason?: string) => {
    if (!s) return;
    setSaving(true);
    const oldStatus = s.status;
    const patch: Partial<AidRowExtended> = { status };
    if (status === "rejected" && reason) patch.rejection_reason = reason;
    const { error } = await supabase.from("aid_requests").update(patch).eq("id", id);
    if (error) {
      if (import.meta.env.DEV) console.error("[Detail] status update failed:", error);
      setSaving(false);
      return;
    }
    await logAdminAction({
      action: "status_change",
      entityId: id,
      oldValue: { status: oldStatus },
      newValue: { status, ...(reason ? { reason } : {}) },
      metadata: { reference_code: s.reference_code },
      actorName: displayName,
    });
    await load();
    setSaving(false);
  };

  const addNote = async () => {
    if (!newNote.trim() || !s) return;
    setSaving(true);
    const noteText = newNote.trim();
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("aid_request_notes").insert({
      request_id: id,
      note: noteText,
      author_id: u.user?.id ?? null,
    });
    if (error) {
      if (import.meta.env.DEV) console.error("[Detail] note insert failed:", error);
      setSaving(false);
      return;
    }
    await logAdminAction({
      action: "note_added",
      entityId: id,
      newValue: { content: noteText },
      metadata: { reference_code: s.reference_code },
      actorName: displayName,
    });
    setNewNote("");
    await load();
    setSaving(false);
  };

  const recalc = async () => {
    if (!s) return;
    setSaving(true);
    const oldTrust = s.trust_score;
    const oldUrgency = s.urgency_score;
    const oldEffective = s.effective_urgency;
    const { error } = await supabase.rpc("calculate_scores", { _request_id: id });
    if (error) {
      if (import.meta.env.DEV) console.error("[Detail] recalc failed:", error);
      setSaving(false);
      return;
    }
    const { data: updated } = await supabase
      .from("aid_requests")
      .select("trust_score, urgency_score, effective_urgency, urgency_tier")
      .eq("id", id)
      .single();
    await logAdminAction({
      action: "score_recalculated",
      entityId: id,
      oldValue: {
        trust_score: oldTrust,
        urgency_score: oldUrgency,
        effective_urgency: oldEffective,
      },
      newValue: {
        trust_score: updated?.trust_score ?? oldTrust,
        urgency_score: updated?.urgency_score ?? oldUrgency,
        effective_urgency: updated?.effective_urgency ?? oldEffective,
        urgency_tier: updated?.urgency_tier ?? null,
      },
      metadata: { reference_code: s.reference_code },
      actorName: displayName,
    });
    await load();
    setSaving(false);
  };

  if (loading) return <div className="p-8 text-sm text-muted-foreground">جارٍ التحميل...</div>;
  if (!s) return <div className="p-8 text-sm text-muted-foreground">لم يتم العثور على هذا الطلب.</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/admin/requests" className="text-xs text-muted-foreground hover:text-foreground">→ العودة إلى القائمة</Link>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={saving}
            onClick={() => updateStatus("reviewing")}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:border-foreground/40 disabled:opacity-50"
          >
            بدء المراجعة
          </button>
          <button
            disabled={saving}
            onClick={() => updateStatus("on_hold")}
            className="rounded-md border border-warning/40 bg-warning/10 px-3 py-1.5 text-xs text-warning hover:bg-warning/20 disabled:opacity-50"
          >
            تعليق
          </button>
          <button
            disabled={saving}
            onClick={() => updateStatus("approved")}
            className="rounded-md border border-success/40 bg-success/10 px-3 py-1.5 text-xs text-success hover:bg-success/20 disabled:opacity-50"
          >
            موافق عليه
          </button>
          <button
            disabled={saving}
            onClick={() => setRejectOpen(true)}
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/20 disabled:opacity-50"
          >
            رفض
          </button>
          <button
            disabled={saving}
            onClick={() => updateStatus("distributed")}
            className="rounded-md border border-border px-3 py-1.5 text-xs hover:border-foreground/40 disabled:opacity-50"
          >
            تم التوزيع
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl">{s.full_name}</h1>
            <div dir="ltr" className="mt-1 font-mono text-sm text-muted-foreground">
              {s.reference_code} · قُدّم {timeAgo(s.created_at)}
            </div>
            {(s.queue_number != null || queueInfo) && (
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border border-border bg-surface px-2 py-0.5 font-mono">
                  {formatQueueNumber(s.queue_number ?? queueInfo?.queue_number)}
                </span>
                {queueInfo && isPendingStatus(s.status) && (
                  <span>
                    الترتيب في الدور:{" "}
                    <strong>{formatQueuePosition(queueInfo.position_among_pending, queueInfo.pending_total)}</strong>
                  </span>
                )}
                {s.queued_at && (
                  <span>انتظار: {formatWaitDuration(s.queued_at)}</span>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={["rounded-full border px-3 py-1 text-xs", statusColor[s.status]].join(" ")}>
              {STATUS_AR[s.status]}
            </span>
            {s.priority_override && (
              <span className="rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-xs text-warning">
                أولوية عاجلة
              </span>
            )}
            {s.manual_urgency != null && (
              <span className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs text-accent">
                عجلة معدّلة يدوياً
              </span>
            )}
          </div>
        </div>
        {s.rejection_reason && (
          <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            سبب الرفض: {s.rejection_reason}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <EditableRequestSections
            request={s}
            requestId={id}
            actorName={displayName}
            onSaved={() => load()}
          />

          <Card
            title="المرجع"
            actions={
              reference?.is_whitelisted ? (
                <span className="rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[10px] text-success">
                  في قائمة المختارين
                </span>
              ) : null
            }
          >
            {reference ? (
              <>
                <Row label="نوع المرجع" value={reference.reference_type} />
                <Row label="الاسم" value={reference.full_name} />
                <Row
                  label="الهاتف"
                  value={<span dir="ltr" className="font-mono">{reference.phone}</span>}
                />
                <Row label="المنطقة" value={reference.region} />
                <Row label="القرية" value={reference.village} />
                <Row label="مدة المعرفة" value={reference.known_duration} />
                {reference.notes && <Row label="ملاحظات" value={reference.notes} />}
                {reference.mukhtar_whitelist && (
                  <Row
                    label="سجلّ المختار"
                    value={
                      <span>
                        {reference.mukhtar_whitelist.full_name}
                        {reference.mukhtar_whitelist.title
                          ? ` — ${reference.mukhtar_whitelist.title}`
                          : ""}
                        {reference.mukhtar_whitelist.verified_at && (
                          <span className="ms-2 text-success">موثّق</span>
                        )}
                      </span>
                    }
                  />
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                لا يوجد مرجع مسجّل بشكل منفصل — قد يكون مضمّناً في ملاحظات الطلب (طلبات قديمة).
              </p>
            )}
            {user && (
              <ReferenceContactSection
                requestId={id}
                referenceCode={s.reference_code}
                reference={reference}
                actorName={displayName}
                userId={user.id}
                onChanged={() => void load()}
              />
            )}
          </Card>

          {user && (
            <DocumentsSection
              requestId={id}
              referenceCode={s.reference_code}
              files={files}
              actorName={displayName}
              userId={user.id}
              onChanged={() => void load()}
            />
          )}

          <Card title="السجل الزمني">
            <RequestLifecycleTimeline
              history={history}
              submittedAt={s.created_at}
              currentStatus={s.status}
              statusLabels={STATUS_AR}
              timeAgo={timeAgo}
            />
          </Card>

          <Card title="ملاحظات إدارية">
            <div className="space-y-3">
              {notes.map((n) => (
                <div key={n.id} className="rounded-md border border-border bg-surface p-3 text-sm">
                  <div className="text-xs text-muted-foreground">{timeAgo(n.created_at)}</div>
                  <p className="mt-1 whitespace-pre-wrap">{n.note}</p>
                </div>
              ))}
              <textarea
                rows={3}
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="أضف ملاحظة جديدة..."
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
              <button
                disabled={saving || !newNote.trim()}
                onClick={addNote}
                className="rounded-md bg-primary px-4 py-2 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                حفظ
              </button>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <AssignReviewerSection request={s} actorName={displayName} onChanged={() => void load()} />
          <TagsSection
            requestId={id}
            referenceCode={s.reference_code}
            actorName={displayName}
            onChanged={() => void load()}
          />
          <FraudEventsSection
            requestId={id}
            referenceCode={s.reference_code}
            actorName={displayName}
            onChanged={() => void load()}
          />
          <Card title="نقاط الثقة">
            <div className="flex items-baseline gap-3">
              <div className="font-display text-5xl">{s.trust_score}</div>
              <div className="text-xs text-muted-foreground">
                {s.risk_level === "low"
                  ? "مخاطرة منخفضة"
                  : s.risk_level === "medium"
                    ? "متوسطة"
                    : s.risk_level === "high"
                      ? "عالية"
                      : s.risk_level === "critical"
                        ? "حرجة"
                        : "احتيال"}
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={[
                  "h-full",
                  s.trust_score >= 75 ? "bg-success" : s.trust_score >= 50 ? "bg-warning" : "bg-destructive",
                ].join(" ")}
                style={{ width: `${s.trust_score}%` }}
              />
            </div>
            {s.last_scored_at && (
              <div className="mt-2 text-[10px] text-muted-foreground">آخر احتساب: {timeAgo(s.last_scored_at)}</div>
            )}
          </Card>

          <Card
            title="نقاط العجلة"
            actions={
              <button
                disabled={saving}
                onClick={() => void recalc()}
                className="rounded-md border border-border px-2 py-1 text-[11px] hover:border-clay disabled:opacity-50"
              >
                إعادة احتساب
              </button>
            }
          >
            <UrgencyBreakdownCard
              urgencyScore={s.urgency_score}
              effectiveUrgency={s.effective_urgency}
              urgencyTier={s.urgency_tier}
              breakdown={s.urgency_breakdown}
              manualUrgency={s.manual_urgency}
              manualReason={s.manual_urgency_reason}
            />
            {user && (
              <div className="mt-4 border-t border-border pt-4">
                <div className="mb-2 text-xs font-medium text-muted-foreground">تعديل يدوي / أولوية</div>
                <UrgencyOverrideSection
                  request={s}
                  actorName={displayName}
                  userId={user.id}
                  onChanged={() => void load()}
                />
              </div>
            )}
          </Card>

          <Card title="سجل العجلة">
            <UrgencyHistoryPanel rows={urgencyHistory} />
          </Card>

          {s.flags.length > 0 && (
            <Card title="إشارات احتيال">
              <ul className="space-y-3 text-sm">
                {s.flags.map((f) => (
                  <li key={f} className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
                    <div className="text-xs text-destructive">{formatFlagLabel(f)}</div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      <AdminActionModal
        open={rejectOpen}
        title="رفض الطلب"
        description="يُسجَّل سبب الرفض في سجل الطلب ويظهر للمراجعين."
        preview={
          s
            ? [
                { label: "الاسم", value: s.full_name },
                { label: "الرمز", value: <span dir="ltr" className="font-mono">{s.reference_code}</span> },
                { label: "الحالة الحالية", value: STATUS_AR[s.status] },
              ]
            : undefined
        }
        cannedReasons={[
          "معلومات غير مكتملة",
          "وثيقة غير صالحة أو غير واضحة",
          "تكرار طلب",
          "المرجع رفض التأكيد",
          "لا يستوفي شروط المساعدة",
        ]}
        reasonLabel="سبب الرفض"
        reasonPlaceholder="اشرح سبب الرفض للفريق..."
        requireReason
        confirmLabel="رفض الطلب"
        variant="destructive"
        busy={saving}
        onClose={() => setRejectOpen(false)}
        onConfirm={async ({ reason }) => {
          await updateStatus("rejected", reason);
          setRejectOpen(false);
        }}
      />
    </div>
  );
}
