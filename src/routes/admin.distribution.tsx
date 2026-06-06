import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { QrScannerPanel } from "@/components/admin/QrScannerPanel";
import { useAuth } from "@/contexts/AuthContext";
import { logAdminAction } from "@/lib/audit-log";
import {
  completeDistribution,
  createDistributionEvent,
  DISTRIBUTION_STATUS_AR,
  fetchApprovedRequests,
  fetchDistributionEvents,
  fetchRequestForDistribution,
  parseSanadQrPayload,
  resolveRequestId,
  updateDistributionEventStatus,
  type DistributionRequestRow,
  type EventWithStats,
} from "@/lib/distribution";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/distribution")({
  component: Distribution,
});

function formatEventDate(iso: string) {
  return new Date(iso).toLocaleString("ar-LB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Distribution() {
  const { user, displayName } = useAuth();
  const [events, setEvents] = useState<EventWithStats[]>([]);
  const [approved, setApproved] = useState<DistributionRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [manageId, setManageId] = useState<string | null>(null);
  const [scanEventId, setScanEventId] = useState<string>("");
  const [refInput, setRefInput] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [preview, setPreview] = useState<DistributionRequestRow | null>(null);
  const [createForm, setCreateForm] = useState({
    name: "",
    location: "",
    scheduled_at: "",
    notes: "",
    capacity: "",
  });

  const load = async () => {
    try {
      setError(null);
      const [ev, ap] = await Promise.all([fetchDistributionEvents(), fetchApprovedRequests()]);
      setEvents(ev);
      setApproved(ap);
      if (!scanEventId && ev.length > 0) {
        const active = ev.find((e) => e.status === "in_progress") ?? ev[0];
        setScanEventId(active.id);
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error("[Distribution]", err);
      setError("تعذّر تحميل بيانات التوزيع.");
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      await load();
      if (alive) setLoading(false);
    })();
    const ch = supabase
      .channel("admin-distribution")
      .on("postgres_changes", { event: "*", schema: "public", table: "distribution_events" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "qr_completions" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "aid_requests" }, () => void load())
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitCreate = async () => {
    if (!createForm.name.trim() || !createForm.location.trim() || !createForm.scheduled_at) {
      setError("يرجى تعبئة اسم الجلسة والموقع والتاريخ.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createDistributionEvent({
        name: createForm.name,
        location: createForm.location,
        scheduled_at: new Date(createForm.scheduled_at).toISOString(),
        notes: createForm.notes || null,
        capacity: createForm.capacity ? Number(createForm.capacity) : null,
        created_by: user?.id ?? null,
      });
      setCreateForm({ name: "", location: "", scheduled_at: "", notes: "", capacity: "" });
      setShowCreate(false);
      await load();
    } catch (err) {
      if (import.meta.env.DEV) console.error("[Distribution] create", err);
      setError("تعذّر إنشاء الجلسة.");
    }
    setBusy(false);
  };

  const lookupPreview = useCallback(async (raw: string) => {
    setError(null);
    setSuccess(null);
    const requestId = await resolveRequestId(raw);
    if (!requestId) {
      setPreview(null);
      setError("تعذّر قراءة الرمز — تحقق من صيغة QR أو رقم الطلب.");
      return;
    }
    const req = await fetchRequestForDistribution(requestId);
    if (!req) {
      setPreview(null);
      setError("لم يتم العثور على الطلب.");
      return;
    }
    setPreview(req);
    setRefInput(req.reference_code);
    if (req.status !== "approved") {
      setError("الطلب غير معتمد للتوزيع.");
    }
  }, []);

  const onQrDecode = useCallback(
    (text: string) => {
      const parsed = parseSanadQrPayload(text);
      if (parsed) setRefInput(parsed.refCode);
      void lookupPreview(text);
    },
    [lookupPreview],
  );

  const confirmPickup = async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    setSuccess(null);

    const requestId = preview?.id ?? (await resolveRequestId(refInput));
    if (!requestId) {
      setError("يرجى مسح الرمز أو إدخال رقم الطلب.");
      setBusy(false);
      return;
    }
    if (!pinInput.trim()) {
      setError("يرجى إدخال رمز PIN.");
      setBusy(false);
      return;
    }

    const event = events.find((e) => e.id === scanEventId);
    const result = await completeDistribution({
      requestId,
      pin: pinInput,
      eventId: scanEventId || null,
      eventLocation: event?.location ?? "ميدان",
      scannedBy: user.id,
    });

    if (!result.ok) {
      setError(result.message);
      setBusy(false);
      return;
    }

    const req = preview ?? (await fetchRequestForDistribution(requestId));
    if (req) {
      await logAdminAction({
        action: "status_change",
        entityId: requestId,
        oldValue: { status: "approved" },
        newValue: { status: "distributed" },
        metadata: { reference_code: req.reference_code, event_id: scanEventId || null },
        actorName: displayName,
      });
    }

    setSuccess(`تم تأكيد استلام ${req?.full_name ?? "الطلب"} بنجاح.`);
    setPreview(null);
    setRefInput("");
    setPinInput("");
    await load();
    setBusy(false);
  };

  const managed = events.find((e) => e.id === manageId);
  const scanEvent = events.find((e) => e.id === scanEventId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="font-display text-lg">جلسات التوزيع</div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
        >
          {showCreate ? "إلغاء" : "+ جلسة جديدة"}
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">
          {success}
        </div>
      )}

      {showCreate && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 font-display text-base">جلسة توزيع جديدة</div>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={createForm.name}
              onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="اسم الجلسة"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              value={createForm.location}
              onChange={(e) => setCreateForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="الموقع"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              type="datetime-local"
              value={createForm.scheduled_at}
              onChange={(e) => setCreateForm((f) => ({ ...f, scheduled_at: e.target.value }))}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              value={createForm.capacity}
              onChange={(e) => setCreateForm((f) => ({ ...f, capacity: e.target.value }))}
              placeholder="السعة (اختياري)"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <textarea
              value={createForm.notes}
              onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="ملاحظات"
              rows={2}
              className="md:col-span-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submitCreate()}
            className="mt-4 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            حفظ الجلسة
          </button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {loading && <div className="text-sm text-muted-foreground">جارٍ التحميل...</div>}
        {!loading && events.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
            لا توجد جلسات توزيع بعد.
          </div>
        )}
        {events.map((e) => (
          <div key={e.id} className="rounded-xl border border-border bg-card p-5">
            <div className="font-display text-lg">{e.name}</div>
            <div className="mt-1 text-xs text-muted-foreground">{e.location}</div>
            <div className="mt-3 font-mono text-xs">{formatEventDate(e.scheduled_at)}</div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-md border border-border p-2">
                <div className="font-display text-lg">{e.approved_count}</div>
                <div className="text-muted-foreground">معتمدة</div>
              </div>
              <div className="rounded-md border border-border p-2">
                <div className="font-display text-lg text-success">{e.done_count}</div>
                <div className="text-muted-foreground">منجزة</div>
              </div>
              <div className="rounded-md border border-border p-2">
                <div className="font-display text-lg">{Math.max(0, e.approved_count - e.done_count)}</div>
                <div className="text-muted-foreground">متبقي</div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span
                className={[
                  "rounded-full border px-2 py-0.5 text-[11px]",
                  e.status === "in_progress"
                    ? "border-clay text-clay"
                    : e.status === "completed"
                      ? "border-success/40 text-success"
                      : "border-border text-muted-foreground",
                ].join(" ")}
              >
                {DISTRIBUTION_STATUS_AR[e.status]}
              </span>
              <button
                type="button"
                onClick={() => setManageId(manageId === e.id ? null : e.id)}
                className="text-xs text-clay hover:underline"
              >
                إدارة
              </button>
            </div>
          </div>
        ))}
      </div>

      {managed && (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-display text-base">{managed.name}</div>
              <div className="text-xs text-muted-foreground">الطلبات المعتمدة الجاهزة للتوزيع</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {managed.status === "scheduled" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void updateDistributionEventStatus(managed.id, "in_progress").then(load)}
                  className="rounded-md border border-clay px-3 py-1.5 text-xs text-clay hover:bg-clay/10 disabled:opacity-50"
                >
                  بدء الجلسة
                </button>
              )}
              {managed.status === "in_progress" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void updateDistributionEventStatus(managed.id, "completed").then(load)}
                  className="rounded-md border border-success/40 px-3 py-1.5 text-xs text-success hover:bg-success/10 disabled:opacity-50"
                >
                  إنهاء الجلسة
                </button>
              )}
            </div>
          </div>
          <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto text-sm">
            {approved.length === 0 && (
              <li className="text-xs text-muted-foreground">لا توجد طلبات معتمدة حالياً.</li>
            )}
            {approved.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
                <div>
                  <div className="font-medium">{r.full_name}</div>
                  <div dir="ltr" className="font-mono text-[11px] text-muted-foreground">
                    {r.reference_code} · {r.family_size} فرد
                  </div>
                </div>
                <Link to="/admin/requests/$id" params={{ id: r.id }} className="text-xs text-clay hover:underline">
                  عرض
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="font-display text-base">مسح QR — وضع الميدان</div>
        <p className="mt-1 text-xs text-muted-foreground">ضع كاميرا الجهاز أمام رمز QR لتأكيد الاستلام.</p>

        <div className="mt-3">
          <label className="text-xs text-muted-foreground">جلسة التوزيع النشطة</label>
          <select
            value={scanEventId}
            onChange={(e) => setScanEventId(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm md:max-w-md"
          >
            <option value="">— بدون جلسة —</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({DISTRIBUTION_STATUS_AR[e.status]})
              </option>
            ))}
          </select>
          {scanEvent && (
            <p className="mt-1 text-[11px] text-muted-foreground">الموقع: {scanEvent.location}</p>
          )}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_2fr]">
          <QrScannerPanel onDecode={onQrDecode} />
          <div>
            <input
              dir="ltr"
              value={refInput}
              onChange={(e) => setRefInput(e.target.value)}
              onBlur={() => refInput && void lookupPreview(refInput)}
              placeholder="SND-XXXXX أو لصق رمز QR"
              className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm"
            />
            <input
              dir="ltr"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="PIN"
              className="mt-3 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm"
            />

            {preview && (
              <div className="mt-4 rounded-md border border-border bg-surface p-3 text-sm">
                <div className="font-medium">{preview.full_name}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {preview.family_size} فرد · {preview.needs.slice(0, 3).join("، ") || "—"}
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={busy}
              onClick={() => void confirmPickup()}
              className="mt-4 w-full rounded-md bg-success py-2.5 text-sm text-white disabled:opacity-50"
            >
              تأكيد الاستلام
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
