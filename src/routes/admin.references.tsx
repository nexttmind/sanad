import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  deactivateMukhtarWhitelist,
  fetchMukhtarWhitelist,
  insertMukhtarWhitelist,
  isLebPhone,
  REFERENCE_TYPES,
  verifyMukhtarWhitelist,
  type MukhtarWhitelistRow,
} from "@/lib/mukhtar-whitelist";
import { supabase } from "@/integrations/supabase/client";
import {
  AdminDesktopTable,
  AdminMobileCard,
  AdminMobileCardActions,
  AdminMobileCardGrid,
  AdminMobileCardHeader,
  AdminMobileList,
} from "@/components/admin/AdminMobileCard";

export const Route = createFileRoute("/admin/references")({
  component: References,
});

function References() {
  const { user } = useAuth();
  const [rows, setRows] = useState<MukhtarWhitelistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("all");
  const [refType, setRefType] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    reference_type: "",
    region: "",
    village: "",
  });

  const load = async () => {
    try {
      setError(null);
      const data = await fetchMukhtarWhitelist();
      setRows(data);
    } catch (err) {
      if (import.meta.env.DEV) console.error("[References]", err);
      setError("تعذّر تحميل قائمة المختارين. تأكد من تطبيق migration 20260605170000.");
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
      .channel("admin-references")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mukhtar_whitelist" },
        () => {
          void load();
        },
      )
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, []);

  const regions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.region) set.add(r.region);
    }
    return [...set].sort();
  }, [rows]);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const hay = `${r.full_name} ${r.phone}`.toLowerCase();
        if (q && !hay.includes(q.toLowerCase())) return false;
        if (region !== "all" && r.region !== region) return false;
        const type = r.reference_type ?? r.title;
        if (refType !== "all" && type !== refType) return false;
        return true;
      }),
    [rows, q, region, refType],
  );

  const submitAdd = async () => {
    if (!form.full_name.trim()) {
      setError("يرجى إدخال الاسم.");
      return;
    }
    if (!isLebPhone(form.phone)) {
      setError("يرجى إدخال رقم هاتف لبناني صحيح.");
      return;
    }
    if (!form.reference_type) {
      setError("يرجى اختيار نوع المرجع.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await insertMukhtarWhitelist({
        full_name: form.full_name,
        phone: form.phone,
        reference_type: form.reference_type,
        region: form.region || null,
        village: form.village || null,
        added_by: user?.id ?? null,
      });
      setForm({ full_name: "", phone: "", reference_type: "", region: "", village: "" });
      setShowAdd(false);
      await load();
    } catch (err) {
      if (import.meta.env.DEV) console.error("[References] add", err);
      setError("تعذّر إضافة المرجع — قد يكون الرقم مسجّلاً مسبقاً.");
    }
    setBusy(false);
  };

  const verify = async (row: MukhtarWhitelistRow) => {
    if (!user) return;
    const notes = window.prompt("ملاحظات التحقق (اختياري)") ?? "";
    setBusy(true);
    setError(null);
    try {
      await verifyMukhtarWhitelist(row.id, user.id, notes || null);
      await load();
    } catch (err) {
      if (import.meta.env.DEV) console.error("[References] verify", err);
      setError("تعذّر توثيق المرجع.");
    }
    setBusy(false);
  };

  const deactivate = async (row: MukhtarWhitelistRow) => {
    const reason = window.prompt("سبب التعطيل؟")?.trim();
    if (!reason) return;
    setBusy(true);
    setError(null);
    try {
      await deactivateMukhtarWhitelist(row.id, reason);
      await load();
    } catch (err) {
      if (import.meta.env.DEV) console.error("[References] deactivate", err);
      setError("تعذّر تعطيل المرجع.");
    }
    setBusy(false);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="بحث بالاسم أو الهاتف"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="all">كل المناطق</option>
            {regions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <select
            value={refType}
            onChange={(e) => setRefType(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="all">كل الأنواع</option>
            {REFERENCE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            {showAdd ? "إلغاء" : "+ إضافة مرجع"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {showAdd && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 font-display text-base">إضافة مرجع جديد</div>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              placeholder="الاسم الكامل"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              dir="ltr"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="+961 71 234 567"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <select
              value={form.reference_type}
              onChange={(e) => setForm((f) => ({ ...f, reference_type: e.target.value }))}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">نوع المرجع</option>
              {REFERENCE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <input
              value={form.region}
              onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
              placeholder="المنطقة / القضاء"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              value={form.village}
              onChange={(e) => setForm((f) => ({ ...f, village: e.target.value }))}
              placeholder="القرية / البلدة"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submitAdd()}
            className="mt-4 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            حفظ
          </button>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 text-xs text-muted-foreground sm:px-5">
          <div>{loading ? "جارٍ التحميل..." : `${filtered.length} مرجع`}</div>
        </div>
        <AdminDesktopTable>
        <table className="w-full min-w-[640px] text-right text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-[11px] uppercase text-muted-foreground">
              <th className="px-4 py-3 font-medium">الاسم</th>
              <th className="px-4 py-3 font-medium">الهاتف</th>
              <th className="px-4 py-3 font-medium">النوع</th>
              <th className="px-4 py-3 font-medium">المنطقة</th>
              <th className="px-4 py-3 font-medium">التحقق</th>
              <th className="px-4 py-3 font-medium">عدد الإشارات</th>
              <th className="px-4 py-3 font-medium">الحالة</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const type = r.reference_type ?? r.title ?? "—";
              const active = r.is_active !== false;
              const verified = !!r.verified_at;
              return (
                <tr key={r.id} className="border-b border-border/60">
                  <td className="px-4 py-3 font-medium">{r.full_name}</td>
                  <td className="px-4 py-3">
                    <span dir="ltr" className="font-mono text-xs">{r.phone}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{type}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {r.region ?? "—"}
                    {r.village && (
                      <>
                        <br />
                        <span>{r.village}</span>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {verified ? (
                      <span className="rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[11px] text-success">
                        موثّق
                      </span>
                    ) : (
                      <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[11px] text-warning">
                        قيد التحقق
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{r.times_referenced ?? 0}</td>
                  <td className="px-4 py-3">
                    {active ? (
                      <span className="text-xs text-foreground">نشط</span>
                    ) : (
                      <span className="text-xs text-muted-foreground" title={r.deactivation_reason ?? undefined}>
                        معطّل
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-left">
                    <div className="flex flex-wrap justify-end gap-2">
                      {!verified && active && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void verify(r)}
                          className="text-xs text-success hover:underline disabled:opacity-50"
                        >
                          توثيق
                        </button>
                      )}
                      {active && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void deactivate(r)}
                          className="text-xs text-destructive hover:underline disabled:opacity-50"
                        >
                          تعطيل
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  لا توجد مراجع.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </AdminDesktopTable>

        <AdminMobileList loading={loading} empty={!loading && filtered.length === 0} emptyMessage="لا توجد مراجع.">
          {filtered.map((r) => {
            const type = r.reference_type ?? r.title ?? "—";
            const active = r.is_active !== false;
            const verified = !!r.verified_at;
            return (
              <AdminMobileCard key={r.id}>
                <AdminMobileCardHeader
                  title={r.full_name}
                  mono={r.phone}
                  badge={
                    verified ? (
                      <span className="rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[10px] text-success">
                        موثّق
                      </span>
                    ) : (
                      <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] text-warning">
                        قيد التحقق
                      </span>
                    )
                  }
                />
                <AdminMobileCardGrid
                  rows={[
                    { label: "النوع", value: type },
                    {
                      label: "المنطقة",
                      value: [r.region, r.village].filter(Boolean).join(" · ") || "—",
                    },
                    { label: "الإشارات", value: r.times_referenced ?? 0 },
                    { label: "الحالة", value: active ? "نشط" : "معطّل" },
                  ]}
                />
                <AdminMobileCardActions>
                  {!verified && active && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void verify(r)}
                      className="text-xs text-success hover:underline disabled:opacity-50"
                    >
                      توثيق
                    </button>
                  )}
                  {active && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void deactivate(r)}
                      className="text-xs text-destructive hover:underline disabled:opacity-50"
                    >
                      تعطيل
                    </button>
                  )}
                </AdminMobileCardActions>
              </AdminMobileCard>
            );
          })}
        </AdminMobileList>
      </div>
    </div>
  );
}
