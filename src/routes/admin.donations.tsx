import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  DONATION_STATUS_AR,
  DONATION_STATUS_COLOR,
  donorDisplay,
  fetchAdminDonations,
  getDonationProofUrl,
  methodLabel,
  rejectDonation,
  verifyDonation,
  type AdminDonationRow,
  type DonationStatus,
} from "@/lib/admin-donations";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/donations")({
  component: DonationsAdmin,
});

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("ar-LB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DonationsAdmin() {
  const { displayName } = useAuth();
  const [rows, setRows] = useState<AdminDonationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<DonationStatus | "all">("pending");

  const load = async () => {
    try {
      setError(null);
      const data = await fetchAdminDonations();
      setRows(data);
    } catch (err) {
      if (import.meta.env.DEV) console.error("[DonationsAdmin]", err);
      setError("تعذّر تحميل التبرّعات.");
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
      .channel("admin-donations")
      .on("postgres_changes", { event: "*", schema: "public", table: "donations" }, () => {
        void load();
      })
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, []);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (status !== "all" && r.status !== status) return false;
        if (!q.trim()) return true;
        const hay = `${r.reference_code} ${r.donor_name ?? ""} ${r.pledged_request_code ?? ""}`.toLowerCase();
        return hay.includes(q.trim().toLowerCase());
      }),
    [rows, q, status],
  );

  const counts = useMemo(() => {
    const c = { pending: 0, verified: 0, rejected: 0, all: rows.length };
    for (const r of rows) {
      if (r.status === "pending") c.pending++;
      else if (r.status === "verified") c.verified++;
      else if (r.status === "rejected") c.rejected++;
    }
    return c;
  }, [rows]);

  const handleVerify = async (row: AdminDonationRow) => {
    if (!window.confirm(`تأكيد التبرّع ${row.reference_code} بمبلغ $${row.amount}؟`)) return;
    setBusyId(row.id);
    setError(null);
    try {
      await verifyDonation(row, displayName);
      await load();
    } catch (err) {
      if (import.meta.env.DEV) console.error("[DonationsAdmin] verify", err);
      setError("تعذّر توثيق التبرّع.");
    }
    setBusyId(null);
  };

  const handleReject = async (row: AdminDonationRow) => {
    const reason = window.prompt("سبب الرفض (اختياري):");
    if (reason === null) return;
    setBusyId(row.id);
    setError(null);
    try {
      await rejectDonation(row, reason, displayName);
      await load();
    } catch (err) {
      if (import.meta.env.DEV) console.error("[DonationsAdmin] reject", err);
      setError("تعذّر رفض التبرّع.");
    }
    setBusyId(null);
  };

  const handleProof = async (row: AdminDonationRow) => {
    if (!row.proof) return;
    setBusyId(row.id);
    try {
      const url = await getDonationProofUrl(row.proof.storage_path);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      else setError("تعذّر فتح إثبات الدفع.");
    } catch (err) {
      if (import.meta.env.DEV) console.error("[DonationsAdmin] proof", err);
      setError("تعذّر فتح إثبات الدفع.");
    }
    setBusyId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">التبرّعات</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            راجع التبرّعات الواردة، وثّقها لتظهر في السجل العام.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[12px]">
          <span className="rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-warning">
            {counts.pending} بانتظار
          </span>
          <span className="rounded-full border border-success/40 bg-success/10 px-3 py-1 text-success">
            {counts.verified} موثّق
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="بحث برمز التبرّع أو اسم المتبرّع..."
          className="min-w-[220px] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as DonationStatus | "all")}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="all">كل الحالات ({counts.all})</option>
          <option value="pending">بانتظار ({counts.pending})</option>
          <option value="verified">موثّق ({counts.verified})</option>
          <option value="rejected">مرفوض ({counts.rejected})</option>
        </select>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="border-b border-border bg-surface/60 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-right">الرمز</th>
              <th className="px-4 py-3 text-right">التاريخ</th>
              <th className="px-4 py-3 text-right">المتبرّع</th>
              <th className="px-4 py-3 text-right">المبلغ</th>
              <th className="px-4 py-3 text-right">الطريقة</th>
              <th className="px-4 py-3 text-right">العائلة</th>
              <th className="px-4 py-3 text-right">الإثبات</th>
              <th className="px-4 py-3 text-right">الحالة</th>
              <th className="px-4 py-3 text-right">إجراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                  جارٍ التحميل...
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                  لا توجد تبرّعات مطابقة.
                </td>
              </tr>
            )}
            {!loading &&
              filtered.map((r) => (
                <tr key={r.id} className="hover:bg-surface/40">
                  <td dir="ltr" className="px-4 py-3 font-mono text-[12px]">
                    {r.reference_code}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-muted-foreground">{formatWhen(r.created_at)}</td>
                  <td className="px-4 py-3">{donorDisplay(r)}</td>
                  <td className="px-4 py-3 font-mono">
                    ${Math.round(r.amount)} {r.currency}
                  </td>
                  <td className="px-4 py-3">{methodLabel(r.method)}</td>
                  <td dir="ltr" className="px-4 py-3 font-mono text-[12px]">
                    {r.pledged_request_code ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {r.proof ? (
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => void handleProof(r)}
                        className="text-[12px] text-clay hover:underline disabled:opacity-50"
                      >
                        عرض
                      </button>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        "inline-flex rounded-full border px-2 py-0.5 text-[11px]",
                        DONATION_STATUS_COLOR[r.status],
                      ].join(" ")}
                    >
                      {DONATION_STATUS_AR[r.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {r.status === "pending" ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => void handleVerify(r)}
                          className="rounded-md bg-success px-2.5 py-1 text-[12px] text-white hover:bg-success/90 disabled:opacity-50"
                        >
                          توثيق
                        </button>
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => void handleReject(r)}
                          className="rounded-md border border-destructive/40 px-2.5 py-1 text-[12px] text-destructive hover:bg-destructive/10 disabled:opacity-50"
                        >
                          رفض
                        </button>
                      </div>
                    ) : (
                      <span className="text-[12px] text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {!loading && filtered.some((r) => r.message || r.internal_notes) && (
        <div className="space-y-3">
          <h2 className="font-display text-lg">ملاحظات</h2>
          {filtered
            .filter((r) => r.message || r.internal_notes)
            .slice(0, 8)
            .map((r) => (
              <div key={r.id} className="rounded-lg border border-border bg-surface/40 px-4 py-3 text-sm">
                <div dir="ltr" className="font-mono text-[12px] text-muted-foreground">
                  {r.reference_code}
                </div>
                {r.message && <p className="mt-1">«{r.message}»</p>}
                {r.internal_notes && (
                  <p className="mt-1 text-muted-foreground">ملاحظة داخلية: {r.internal_notes}</p>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
