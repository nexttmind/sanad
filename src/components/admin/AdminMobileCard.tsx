import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AdminMobileCard({ children, className }: { children: ReactNode; className?: string }) {
  return <article className={cn("px-4 py-4", className)}>{children}</article>;
}

export function AdminMobileCardHeader({
  title,
  subtitle,
  badge,
  mono,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  mono?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="font-medium text-foreground">{title}</div>
        {subtitle && <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div>}
        {mono && (
          <div dir="ltr" className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
            {mono}
          </div>
        )}
      </div>
      {badge}
    </div>
  );
}

export function AdminMobileCardGrid({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
      {rows.map(({ label, value }) => (
        <div key={label} className="min-w-0">
          <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
          <dd className="mt-0.5 break-words text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AdminMobileCardActions({ children }: { children: ReactNode }) {
  return <div className="mt-3 flex flex-wrap gap-2">{children}</div>;
}

export function AdminMobileCardLink({
  to,
  params,
  children,
}: {
  to: "/admin/requests/$id";
  params: { id: string };
  children: ReactNode;
}) {
  return (
    <Link 
      to={to} 
      params={params} 
      className="inline-flex w-full items-center justify-center rounded-lg bg-clay/10 px-4 py-2.5 text-sm font-medium text-clay transition-colors hover:bg-clay/20 active:bg-clay/30"
    >
      {children}
    </Link>
  );
}

export function AdminMobileList({
  children,
  empty,
  loading,
  loadingMessage = "جارٍ التحميل...",
  emptyMessage = "لا توجد نتائج.",
}: {
  children: ReactNode;
  empty?: boolean;
  loading?: boolean;
  loadingMessage?: string;
  emptyMessage?: string;
}) {
  if (loading) {
    return (
      <div className="border-t border-border px-4 py-8 text-center text-sm text-muted-foreground md:hidden">
        {loadingMessage}
      </div>
    );
  }
  if (empty) {
    return (
      <div className="border-t border-border px-4 py-8 text-center text-sm text-muted-foreground md:hidden">
        {emptyMessage}
      </div>
    );
  }
  return <div className="divide-y divide-border border-t border-border md:hidden">{children}</div>;
}

/** Wrap desktop `<table>` — hidden below md breakpoint */
export function AdminDesktopTable({ children }: { children: ReactNode }) {
  return <div className="table-scroll hidden overflow-x-auto md:block">{children}</div>;
}
