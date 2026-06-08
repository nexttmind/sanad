import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAdminNavBadges } from "@/lib/admin-query";

type AlertItem = {
  label: string;
  count: number;
  tone: string;
  href?: string;
  requestsSearch?: Record<string, string>;
};

export function AdminAlertsMenu() {
  const { badges, alertCount, alerts } = useAdminNavBadges();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const items: AlertItem[] = [
    {
      label: "حالات حرجة معلّقة",
      count: alerts?.critical ?? 0,
      tone: "text-destructive",
      requestsSearch: { status: "submitted", urgency_min: "85", sort: "effective_urgency", dir: "desc" },
    },
    {
      label: "موسومة باحتيال",
      count: alerts?.flagged ?? 0,
      tone: "text-warning",
      requestsSearch: { flags: "1", sort: "created_at", dir: "desc" },
    },
    {
      label: "تبرّعات بانتظار التحقق",
      count: badges.donations,
      tone: "text-warning",
      href: "/admin/donations",
    },
    {
      label: "طلبات قيد الانتظار",
      count: badges.requests,
      tone: "text-clay",
      requestsSearch: { status: "submitted", sort: "effective_urgency", dir: "desc" },
    },
    {
      label: "قيد الدور",
      count: badges.queue,
      tone: "text-muted-foreground",
      href: "/admin/queue",
    },
  ].filter((item) => item.count > 0);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative grid h-9 w-9 place-items-center rounded-full border border-border bg-background hover:border-clay"
        aria-label="تنبيهات الإدارة"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Bell className="h-4 w-4" />
        {alertCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-clay px-1 text-[10px] text-white">
            {alertCount > 99 ? "99+" : alertCount.toLocaleString("ar-EG")}
          </span>
        )}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-2 w-72 rounded-xl border border-border bg-card p-2 shadow-lg"
        >
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">يتطلب انتباهاً</div>
          {items.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">لا توجد تنبيهات حالياً.</p>
          ) : (
            <ul className="space-y-0.5">
              {items.map((item) => {
                const inner = (
                  <span className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-surface">
                    <span className={item.tone}>{item.label}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {item.count.toLocaleString("ar-EG")}
                    </span>
                  </span>
                );
                return (
                  <li key={item.label}>
                    {item.href ? (
                      <Link to={item.href} onClick={() => setOpen(false)} className="block rounded-md">
                        {inner}
                      </Link>
                    ) : (
                      <Link
                        to="/admin/requests"
                        search={item.requestsSearch}
                        onClick={() => setOpen(false)}
                        className="block rounded-md"
                      >
                        {inner}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
