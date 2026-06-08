import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminActionModal } from "@/components/admin/AdminActionModal";
import { logAdminAction } from "@/lib/audit-log";
import { fetchStaffMembers, type StaffMember } from "@/lib/admin-staff";
import {
  updateReferenceContact,
  type SubmissionReferenceWithWhitelist,
} from "@/lib/submission-reference";
import {
  CONTACT_RESULT_LABELS,
  type AidRowExtended,
  type ContactResult,
  type FileRowExtended,
  type FraudEventRow,
  type RequestTagRow,
  type TagRow,
} from "@/lib/request-detail-types";

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `قبل ${Math.floor(diff)} ث`;
  if (diff < 3600) return `قبل ${Math.floor(diff / 60)} د`;
  if (diff < 86400) return `قبل ${Math.floor(diff / 3600)} س`;
  return `قبل ${Math.floor(diff / 86400)} ي`;
}

type CardProps = {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
};

function Card({ title, children, actions }: CardProps) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="font-display text-base">{title}</div>
        {actions}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

/* ---------- Tags ---------- */
export function TagsSection({
  requestId,
  referenceCode,
  actorName,
  onChanged,
}: {
  requestId: string;
  referenceCode: string;
  actorName: string;
  onChanged: () => void;
}) {
  const [allTags, setAllTags] = useState<TagRow[]>([]);
  const [applied, setApplied] = useState<RequestTagRow[]>([]);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [tagsRes, appliedRes] = await Promise.all([
      supabase.from("tags").select("*").order("name_ar"),
      supabase.from("request_tags").select("tag_id, tags(*)").eq("request_id", requestId),
    ]);
    setAllTags(tagsRes.data ?? []);
    setApplied((appliedRes.data as RequestTagRow[] | null) ?? []);
  };

  useEffect(() => {
    void load();
  }, [requestId]);

  const addTag = async () => {
    if (!pick) return;
    setBusy(true);
    const tag = allTags.find((t) => t.id === pick);
    const { error } = await supabase.from("request_tags").insert({ request_id: requestId, tag_id: pick });
    if (!error && tag) {
      await logAdminAction({
        action: "tag_added",
        entityId: requestId,
        newValue: { tag: tag.name_ar },
        metadata: { reference_code: referenceCode },
        actorName,
      });
      setPick("");
      await load();
      onChanged();
    }
    setBusy(false);
  };

  const removeTag = async (tagId: string, tagName: string) => {
    setBusy(true);
    const { error } = await supabase.from("request_tags").delete().eq("request_id", requestId).eq("tag_id", tagId);
    if (!error) {
      await logAdminAction({
        action: "tag_removed",
        entityId: requestId,
        newValue: { tag: tagName },
        metadata: { reference_code: referenceCode },
        actorName,
      });
      await load();
      onChanged();
    }
    setBusy(false);
  };

  const available = allTags.filter((t) => !applied.some((a) => a.tag_id === t.id));

  return (
    <Card title="الوسوم">
      <div className="flex flex-wrap gap-2">
        {applied.length === 0 && <span className="text-xs text-muted-foreground">لا توجد وسوم.</span>}
        {applied.map((a) => (
          <span
            key={a.tag_id}
            className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs"
            style={{ borderColor: a.tags.color }}
          >
            {a.tags.name_ar}
            <button
              type="button"
              disabled={busy}
              onClick={() => void removeTag(a.tag_id, a.tags.name_ar)}
              className="text-muted-foreground hover:text-destructive"
              aria-label="إزالة"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <select
          value={pick}
          onChange={(e) => setPick(e.target.value)}
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">إضافة وسم...</option>
          {available.map((t) => (
            <option key={t.id} value={t.id}>{t.name_ar}</option>
          ))}
        </select>
        <button
          type="button"
          disabled={busy || !pick}
          onClick={() => void addTag()}
          className="rounded-md border border-border px-3 py-2 text-xs hover:border-clay disabled:opacity-50"
        >
          إضافة
        </button>
      </div>
    </Card>
  );
}

/* ---------- Assign reviewer ---------- */
export function AssignReviewerSection({
  request,
  actorName,
  onChanged,
}: {
  request: AidRowExtended;
  actorName: string;
  onChanged: () => void;
}) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchStaffMembers().then(setStaff).catch(() => setStaff([]));
  }, []);

  const assign = async (userId: string) => {
    setBusy(true);
    const { error } = await (supabase as SupabaseClient)
      .from("aid_requests")
      .update({ assigned_to: userId || null } as never)
      .eq("id", request.id);
    if (!error) {
      await logAdminAction({
        action: "reviewer_assigned",
        entityId: request.id,
        newValue: { reviewer_id: userId || null },
        metadata: { reference_code: request.reference_code },
        actorName,
      });
      onChanged();
    }
    setBusy(false);
  };

  return (
    <Card title="تعيين مراجع">
      <select
        value={request.assigned_to ?? ""}
        disabled={busy}
        onChange={(e) => void assign(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      >
        <option value="">— غير معيّن —</option>
        {staff.map((m) => (
          <option key={m.user_id} value={m.user_id}>
            {m.display_name} ({m.role})
          </option>
        ))}
      </select>
    </Card>
  );
}

/* ---------- Reference contact ---------- */
export function ReferenceContactSection({
  requestId,
  referenceCode,
  reference,
  actorName,
  userId,
  onChanged,
}: {
  requestId: string;
  referenceCode: string;
  reference: SubmissionReferenceWithWhitelist | null;
  actorName: string;
  userId: string;
  onChanged: () => void;
}) {
  const [notes, setNotes] = useState(reference?.contact_notes ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setNotes(reference?.contact_notes ?? "");
  }, [reference?.contact_notes]);

  const saveContact = async (result: ContactResult) => {
    if (!reference) return;
    setBusy(true);
    try {
      await updateReferenceContact(requestId, result, notes.trim() || null, userId);
      await logAdminAction({
        action: "reference_contacted",
        entityId: requestId,
        newValue: { result },
        metadata: { reference_code: referenceCode },
        actorName,
      });
      onChanged();
    } catch (err) {
      if (import.meta.env.DEV) console.error("[ReferenceContact]", err);
    }
    setBusy(false);
  };

  if (!reference) {
    return null;
  }

  const result = reference.contact_result as ContactResult;

  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="mb-2 text-xs font-medium text-foreground">تواصل مع المرجع</div>
      {reference.contacted_at && (
        <p className="mb-2 text-xs text-muted-foreground">
          {CONTACT_RESULT_LABELS[result]} — {timeAgo(reference.contacted_at)}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["confirmed", "مؤكّد"],
            ["denied", "رفض"],
            ["no_answer", "لا يجيب"],
            ["wrong_number", "رقم خاطئ"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            disabled={busy}
            onClick={() => void saveContact(key)}
            className={[
              "rounded-md border px-3 py-1.5 text-xs disabled:opacity-50",
              result === key ? "border-clay bg-clay/10 text-clay" : "border-border hover:border-foreground/40",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>
      <textarea
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="ملاحظات التواصل..."
        className="mt-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
    </div>
  );
}

/* ---------- Documents ---------- */
function isImageMime(mime: string | null, path: string): boolean {
  if (mime) return mime.startsWith("image/");
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return ["jpg", "jpeg", "png", "webp", "gif"].includes(ext);
}

function isPdfMime(mime: string | null, path: string): boolean {
  if (mime) return mime === "application/pdf";
  return path.split(".").pop()?.toLowerCase() === "pdf";
}

export function DocumentsSection({
  requestId,
  referenceCode,
  files,
  actorName,
  userId,
  onChanged,
  onOpen,
}: {
  requestId: string;
  referenceCode: string;
  files: FileRowExtended[];
  actorName: string;
  userId: string;
  onChanged: () => void;
  onOpen?: (file: FileRowExtended) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<FileRowExtended | null>(null);

  const openPreview = async (f: FileRowExtended) => {
    if (previewId === f.id) {
      setPreviewId(null);
      setPreviewUrl(null);
      return;
    }
    setPreviewId(f.id);
    setPreviewUrl(null);
    setPreviewLoading(true);
    const { data } = await (supabase as SupabaseClient)
      .storage.from(f.bucket).createSignedUrl(f.storage_path, 300);
    setPreviewUrl(data?.signedUrl ?? null);
    setPreviewLoading(false);
    if (onOpen) onOpen(f);
  };

  const verify = async (file: FileRowExtended) => {
    setBusy(true);
    const { error } = await (supabase as SupabaseClient)
      .from("aid_request_files")
      .update({
        doc_admin_verified: true,
        doc_verified_by: userId,
        doc_verified_at: new Date().toISOString(),
        doc_rejection_reason: null,
      } as never)
      .eq("id", file.id);
    if (!error) {
      await logAdminAction({
        action: "document_verified",
        entityId: requestId,
        metadata: { reference_code: referenceCode, file_id: file.id },
        actorName,
      });
      onChanged();
    }
    setBusy(false);
  };

  const reject = async (file: FileRowExtended, reason: string) => {
    setBusy(true);
    const { error } = await (supabase as SupabaseClient)
      .from("aid_request_files")
      .update({
        doc_admin_verified: false,
        doc_verified_by: userId,
        doc_verified_at: new Date().toISOString(),
        doc_rejection_reason: reason,
      } as never)
      .eq("id", file.id);
    if (!error) {
      await logAdminAction({
        action: "document_rejected",
        entityId: requestId,
        newValue: { reason },
        metadata: { reference_code: referenceCode, file_id: file.id },
        actorName,
      });
      onChanged();
    }
    setBusy(false);
  };

  const KIND_LABELS: Record<string, string> = {
    lebanese_id: "هوية لبنانية",
    passport: "جواز سفر",
    id_doc: "وثيقة هوية",
  };

  return (
    <Card title="الوثائق">
      <ul className="space-y-4 text-sm">
        {files.length === 0 && <li className="text-xs text-muted-foreground">لا توجد وثائق مرفقة.</li>}
        {files.map((f) => {
          const isOpen = previewId === f.id;
          const isImage = isImageMime(f.mime, f.storage_path);
          const isPdf = isPdfMime(f.mime, f.storage_path);
          return (
            <li key={f.id} className="rounded-md border border-border/60 overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-2 p-3">
                <div>
                  <div className="font-medium text-xs">{KIND_LABELS[f.kind] ?? f.kind}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 font-mono break-all">
                    {f.storage_path.split("/").pop()}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {f.doc_admin_verified === true && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[10px] text-success">
                        ✓ تم التحقق
                      </span>
                    )}
                    {f.doc_admin_verified === false && !f.doc_rejection_reason && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] text-warning">
                        بانتظار
                      </span>
                    )}
                    {f.doc_rejection_reason && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] text-destructive">
                        مرفوض: {f.doc_rejection_reason}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => void openPreview(f)}
                    className={[
                      "rounded-md border px-2 py-1 text-xs transition",
                      isOpen
                        ? "border-clay bg-clay/10 text-clay"
                        : "border-border bg-background hover:border-clay",
                    ].join(" ")}
                  >
                    {isOpen ? "إخفاء" : "عرض"}
                  </button>
                  {previewUrl && isOpen && (
                    <a
                      href={previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md border border-border bg-background px-2 py-1 text-xs hover:border-foreground/40"
                    >
                      ↗ فتح
                    </a>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void verify(f)}
                    className="rounded-md border border-success/40 bg-success/10 px-2 py-1 text-xs text-success disabled:opacity-50"
                  >
                    تحقق
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setRejectTarget(f)}
                    className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-xs text-destructive disabled:opacity-50"
                  >
                    رفض
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-border/60 bg-surface">
                  {previewLoading && (
                    <div className="flex items-center justify-center py-10 text-xs text-muted-foreground">
                      جارٍ تحميل الوثيقة...
                    </div>
                  )}
                  {!previewLoading && !previewUrl && (
                    <div className="flex items-center justify-center py-10 text-xs text-muted-foreground">
                      تعذّر تحميل الوثيقة.
                    </div>
                  )}
                  {!previewLoading && previewUrl && isImage && (
                    <img
                      src={previewUrl}
                      alt={KIND_LABELS[f.kind] ?? f.kind}
                      className="mx-auto block max-h-[520px] w-full object-contain p-2"
                    />
                  )}
                  {!previewLoading && previewUrl && isPdf && (
                    <iframe
                      src={previewUrl}
                      title={KIND_LABELS[f.kind] ?? f.kind}
                      className="h-[600px] w-full"
                    />
                  )}
                  {!previewLoading && previewUrl && !isImage && !isPdf && (
                    <div className="flex flex-col items-center justify-center gap-3 py-10 text-sm text-muted-foreground">
                      <p>لا يمكن معاينة هذا النوع من الملفات مباشرة.</p>
                      <a
                        href={previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border border-clay px-4 py-2 text-xs text-clay hover:bg-clay/10"
                      >
                        تحميل الملف
                      </a>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <AdminActionModal
        open={rejectTarget != null}
        title="رفض الوثيقة"
        description="يُبلَّغ مقدّم الطلب بضرورة إعادة رفع وثيقة صالحة."
        preview={
          rejectTarget
            ? [
                { label: "نوع الوثيقة", value: KIND_LABELS[rejectTarget.kind] ?? rejectTarget.kind },
                { label: "الملف", value: rejectTarget.storage_path.split("/").pop() ?? "—" },
              ]
            : undefined
        }
        cannedReasons={[
          "صورة غير واضحة",
          "وثيقة منتهية الصلاحية",
          "لا تطابق بيانات الطلب",
          "نوع وثيقة خاطئ",
        ]}
        reasonLabel="سبب الرفض"
        requireReason
        confirmLabel="رفض الوثيقة"
        variant="destructive"
        busy={busy}
        onClose={() => setRejectTarget(null)}
        onConfirm={async ({ reason }) => {
          if (!rejectTarget) return;
          await reject(rejectTarget, reason);
          setRejectTarget(null);
        }}
      />
    </Card>
  );
}
export function FraudEventsSection({
  requestId,
  referenceCode,
  actorName,
  onChanged,
}: {
  requestId: string;
  referenceCode: string;
  actorName: string;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState<FraudEventRow[]>([]);
  const [resolved, setResolved] = useState<FraudEventRow[]>([]);
  const [showResolved, setShowResolved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<FraudEventRow | null>(null);

  const load = async () => {
    const { data } = await supabase.from("fraud_events").select("*").eq("request_id", requestId).order("created_at", { ascending: false });
    const rows = (data as FraudEventRow[] | null) ?? [];
    setOpen(rows.filter((r) => !r.resolved));
    setResolved(rows.filter((r) => r.resolved));
  };

  useEffect(() => {
    void load();
  }, [requestId]);

  const resolve = async (event: FraudEventRow, note: string) => {
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("fraud_events")
      .update({
        resolved: true,
        resolved_by: u.user?.id ?? null,
        resolved_at: new Date().toISOString(),
        resolution_note: note,
      } as never)
      .eq("id", event.id);
    if (!error) {
      await supabase.rpc("calculate_scores", { _request_id: requestId });
      await logAdminAction({
        action: "fraud_resolved",
        entityId: requestId,
        newValue: { flag_code: event.code, note },
        metadata: { reference_code: referenceCode },
        actorName,
      });
      await load();
      onChanged();
    }
    setBusy(false);
  };

  if (open.length === 0 && resolved.length === 0) return null;

  return (
    <Card title="إشارات الاحتيال">
      <ul className="space-y-3 text-sm">
        {open.map((e) => (
          <li key={e.id} className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
            <div dir="ltr" className="font-mono text-xs text-destructive">{e.code}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">{timeAgo(e.created_at)}</div>
            <button
              type="button"
              disabled={busy}
              onClick={() => setResolveTarget(e)}
              className="mt-2 rounded-md border border-border bg-background px-2 py-1 text-xs hover:border-clay disabled:opacity-50"
            >
              حلّ الإشارة
            </button>
          </li>
        ))}
      </ul>
      {resolved.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowResolved((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {showResolved ? "إخفاء المحلولة" : `عرض المحلولة (${resolved.length})`}
          </button>
          {showResolved && (
            <ul className="mt-2 space-y-2 text-xs text-muted-foreground">
              {resolved.map((e) => (
                <li key={e.id} className="rounded border border-border/60 p-2">
                  <span dir="ltr" className="font-mono">{e.code}</span>
                  {e.resolution_note && <span className="ms-2">— {e.resolution_note}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <AdminActionModal
        open={resolveTarget != null}
        title="حلّ إشارة الاحتيال"
        description="سجّل كيف تم التحقق من الإشارة أو تبريرها."
        preview={
          resolveTarget
            ? [{ label: "الرمز", value: <span dir="ltr" className="font-mono">{resolveTarget.code}</span> }]
            : undefined
        }
        cannedReasons={[
          "تم التحقق — لا مخالفة",
          "خطأ في النظام",
          "تكرار مشروع — تمت المراجعة",
        ]}
        reasonLabel="ملاحظة الحلّ"
        requireReason
        confirmLabel="تأكيد الحلّ"
        variant="default"
        busy={busy}
        onClose={() => setResolveTarget(null)}
        onConfirm={async ({ reason }) => {
          if (!resolveTarget) return;
          await resolve(resolveTarget, reason);
          setResolveTarget(null);
        }}
      />
    </Card>
  );
}
