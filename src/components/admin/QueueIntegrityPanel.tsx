import { Link } from "@tanstack/react-router";
import { Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { formatQueueNumber } from "@/lib/queue";
import {
  runQueueIntegrityCheck,
  type QueueIntegrityReport,
} from "@/lib/queue-integrity";

const STATUS_AR: Record<string, string> = {
  submitted: "قيد الانتظار",
  reviewing: "قيد المراجعة",
  verifying: "قيد التحقق",
  on_hold: "معلّق",
};

export function QueueIntegrityPanel() {
  const { displayName } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<QueueIntegrityReport | null>(null);

  const handleRun = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await runQueueIntegrityCheck(displayName);
      setReport(result);
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : "تعذّر تشغيل فحص سلامة الدور");
    } finally {
      setBusy(false);
    }
  };

  const checkedLabel = report
    ? new Date(report.checked_at).toLocaleString("ar-LB", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">فحص سلامة الدور</div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            التحقق من تفرّد أرقام الدور، تزامن التسلسل، وأرقام الهاتف المكرّرة في الطلبات النشطة.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleRun()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:border-foreground/40 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          تشغيل الفحص
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      {report && (
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          <div className="flex flex-wrap items-center gap-3">
            {report.healthy ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-700 dark:text-emerald-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                الدور سليم
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1 text-xs text-destructive">
                <ShieldAlert className="h-3.5 w-3.5" />
                تُوجد مشكلات في سلامة الدور
              </span>
            )}
            {checkedLabel && (
              <span className="text-[11px] text-muted-foreground">آخر فحص: {checkedLabel}</span>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="أرقام الدور"
              value={report.queue_numbers.unique ? "فريدة" : "مكرّرة"}
              ok={report.queue_numbers.unique}
              detail={`${report.queue_numbers.total_assigned.toLocaleString("ar-EG")} طلب — أقصى رقم ${formatQueueNumber(report.queue_numbers.max)}`}
            />
            <StatCard
              label="تسلسل قاعدة البيانات"
              value={report.sequence.ok ? "متزامن" : "غير متزامن"}
              ok={report.sequence.ok}
              detail={`التالي: ${report.sequence.next_value.toLocaleString("ar-EG")} — الأقصى: ${report.sequence.max_queue_number.toLocaleString("ar-EG")}`}
            />
            <StatCard
              label="طلبات نشطة"
              value={report.pending_total.toLocaleString("ar-EG")}
              ok
              detail="قيد الانتظار / المراجعة / التحقق / معلّق"
            />
            <StatCard
              label="هواتف مكرّرة"
              value={report.duplicate_phones_pending.length.toLocaleString("ar-EG")}
              ok={report.duplicate_phones_pending.length === 0}
              detail="إعلامي — لا يوقف الدور"
              warnOnly
            />
          </div>

          {!report.queue_numbers.unique && report.queue_numbers.duplicates.length > 0 && (
            <IssueBlock title="أرقام دور مكرّرة">
              <ul className="space-y-2 text-xs">
                {report.queue_numbers.duplicates.map((dup) => (
                  <li key={dup.queue_number} className="rounded-md border border-destructive/20 bg-destructive/5 p-2">
                    <span className="font-mono">{formatQueueNumber(dup.queue_number)}</span>
                    <span className="text-muted-foreground"> — {dup.count} طلبات: </span>
                    {dup.requests.map((r, i) => (
                      <span key={r.id}>
                        {i > 0 && "، "}
                        <Link to="/admin/requests/$id" params={{ id: r.id }} className="text-clay hover:underline">
                          {r.reference_code}
                        </Link>
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
            </IssueBlock>
          )}

          {!report.sequence.ok && (
            <IssueBlock title="تسلسل أرقام الدور غير متزامن">
              <p className="text-xs text-muted-foreground">
                القيمة التالية للتسلسل ({report.sequence.next_value.toLocaleString("ar-EG")}) يجب أن تكون
                أكبر من أقصى رقم دور ({report.sequence.max_queue_number.toLocaleString("ar-EG")}).
                قد يؤدي ذلك إلى تعارض عند إدراج طلبات جديدة.
              </p>
            </IssueBlock>
          )}

          {report.duplicate_phones_pending.length > 0 && (
            <IssueBlock title="أرقام هاتف مكرّرة في الدور النشط (إعلامي)">
              <div className="table-scroll overflow-x-auto">
                <table className="w-full min-w-[480px] text-right text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="px-2 py-2">الهاتف</th>
                      <th className="px-2 py-2">الطلبات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.duplicate_phones_pending.map((group) => (
                      <tr key={group.phone} className="border-b border-border/60">
                        <td dir="ltr" className="px-2 py-2 font-mono">
                          {group.phone}
                        </td>
                        <td className="px-2 py-2">
                          {group.requests.map((r, i) => (
                            <span key={r.id}>
                              {i > 0 && " · "}
                              <Link
                                to="/admin/requests/$id"
                                params={{ id: r.id }}
                                className="text-clay hover:underline"
                              >
                                {r.reference_code}
                              </Link>
                              {r.queue_number != null && (
                                <span className="text-muted-foreground"> ({formatQueueNumber(r.queue_number)})</span>
                              )}
                              {r.status && (
                                <span className="text-muted-foreground"> — {STATUS_AR[r.status] ?? r.status}</span>
                              )}
                            </span>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </IssueBlock>
          )}

          {report.healthy && report.duplicate_phones_pending.length === 0 && (
            <p className="text-xs text-muted-foreground">
              لا توجد مشكلات حرجة ولا هواتف مكرّرة في الدور النشط.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
  ok,
  warnOnly = false,
}: {
  label: string;
  value: string;
  detail: string;
  ok: boolean;
  warnOnly?: boolean;
}) {
  const tone = ok
    ? "border-border bg-surface"
    : warnOnly
      ? "border-amber-500/30 bg-amber-500/5"
      : "border-destructive/30 bg-destructive/5";

  return (
    <div className={["rounded-lg border p-3", tone].join(" ")}>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
      <div className="mt-1 text-[10px] text-muted-foreground">{detail}</div>
    </div>
  );
}

function IssueBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="mb-2 text-xs font-medium">{title}</div>
      {children}
    </div>
  );
}
