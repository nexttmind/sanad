import { Link, Navigate, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, LogOut, Menu, X, Search } from "lucide-react";
import { AdminAlertsMenu } from "@/components/admin/AdminAlertsMenu";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { adminRequestsSearchUrl } from "@/lib/admin-global-search";
import { adminQueryKeys, useAdminNavBadges, type AdminNavBadgeKey } from "@/lib/admin-query";
import { useAdminMultiQueryRealtime } from "@/lib/use-admin-query-realtime";

type NavItem = {
  to: string;
  label: string;
  badgeKey?: AdminNavBadgeKey;
  adminOnly?: boolean;
};

const navItems: NavItem[] = [
  { to: "/admin", label: "نظرة عامة" },
  { to: "/admin/queue", label: "الدور", badgeKey: "queue" },
  { to: "/admin/requests", label: "الطلبات", badgeKey: "requests" },
  { to: "/admin/donations", label: "التبرّعات", badgeKey: "donations" },
  { to: "/admin/references", label: "قائمة المختارين" },
  { to: "/admin/distribution", label: "التوزيع" },
  { to: "/admin/public-settings", label: "إعدادات الموقع", adminOnly: true },
  { to: "/admin/analytics", label: "التحليلات" },
  { to: "/admin/scoring", label: "قواعد العجلة", adminOnly: true },
  { to: "/admin/users", label: "المستخدمون" },
  { to: "/admin/audit", label: "سجلّ التدقيق" },
];

function AdminHeaderSearch() {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const urlSearch = useRouterState({ select: (s) => s.location.search as Record<string, unknown> });
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (path.startsWith("/admin/requests") && typeof urlSearch.q === "string") {
      setQuery(urlSearch.q);
    }
  }, [path, urlSearch.q]);

  useEffect(() => {
    setMobileOpen(false);
  }, [path]);

  useEffect(() => {
    if (mobileOpen) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 50);
      return () => window.clearTimeout(t);
    }
  }, [mobileOpen]);

  const submit = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    void navigate(adminRequestsSearchUrl(trimmed));
    setMobileOpen(false);
  };

  const searchInput = (
    <input
      ref={inputRef}
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          submit();
        }
      }}
      placeholder="بحث بالاسم، الرمز، أو الهاتف..."
      className="w-full rounded-full border border-border bg-surface py-2 pe-3 ps-9 text-sm focus:border-clay focus:outline-none focus:ring-2 focus:ring-clay/20 md:pe-9 md:ps-3"
      aria-label="بحث في الطلبات"
    />
  );

  return (
    <>
      <div className="relative hidden md:block">
        <Search className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="بحث في الطلبات..."
          className="w-56 rounded-full border border-border bg-surface py-2 pe-9 ps-3 text-sm focus:border-clay focus:outline-none focus:ring-2 focus:ring-clay/20 lg:w-72"
          aria-label="بحث في الطلبات"
        />
      </div>
      <button
        type="button"
        onClick={() => setMobileOpen((v) => !v)}
        className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background hover:border-clay md:hidden"
        aria-label={mobileOpen ? "إغلاق البحث" : "فتح البحث"}
        aria-expanded={mobileOpen}
      >
        <Search className="h-4 w-4" />
      </button>
      {mobileOpen && (
        <div className="fixed inset-x-0 top-14 z-30 border-b border-border bg-background/95 px-3 py-2 backdrop-blur sm:top-16 md:hidden">
          <div className="relative flex items-center gap-2">
            <Search className="pointer-events-none absolute right-3 h-3.5 w-3.5 text-muted-foreground" />
            {searchInput}
            <button
              type="button"
              onClick={submit}
              className="shrink-0 rounded-full bg-primary px-4 py-2 text-xs text-primary-foreground hover:bg-primary/90"
            >
              بحث
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function AdminShell() {
  const navigate = useNavigate();
  const { displayName, initials, roleDisplay, signOut, roles } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { badges } = useAdminNavBadges();

  useAdminMultiQueryRealtime("admin-shell-nav", [
    { table: "aid_requests", queryKeys: [adminQueryKeys.overview()] },
    { table: "donations", queryKeys: [adminQueryKeys.pendingDonationsCount()] },
  ]);

  // Desktop: collapse to icon rail. Mobile: drawer open/closed.
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const current =
    navItems.find((n) => n.to === path) ??
    navItems.find((n) => path.startsWith(n.to + "/")) ??
    navItems[0];

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      void navigate({ to: "/auth" });
    } catch {
      setLoggingOut(false);
    }
  };

  // Close drawer on route change
  useEffect(() => { setMobileOpen(false); }, [path]);
  // Lock body scroll when drawer open
  useEffect(() => {
    if (mobileOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const SidebarInner = ({ collapsed, badges }: { collapsed: boolean; badges: Record<AdminNavBadgeKey, number> }) => (
    <>
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/20 bg-white/5 font-display">س</span>
        {!collapsed && (
          <div className="leading-tight">
            <div className="font-display text-base">سند</div>
            <div className="text-[10px] uppercase tracking-[0.32em] text-sidebar-foreground/60">Admin</div>
          </div>
        )}
        <button
          onClick={() => setMobileOpen(false)}
          className="ms-auto grid h-8 w-8 place-items-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent lg:hidden"
          aria-label="إغلاق"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems
          .filter((n) => !("adminOnly" in n && n.adminOnly) || roles.includes("admin"))
          .map((n) => {
          const active = n.to === current.to;
          const badgeCount = n.badgeKey ? badges[n.badgeKey] : 0;
          return (
            <Link
              key={n.to}
              to={n.to}
              className={[
                "flex items-center justify-between rounded-md px-3 py-2.5 text-sm transition",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
              ].join(" ")}
            >
              <span className={collapsed ? "sr-only" : ""}>{n.label}</span>
              {collapsed && <span className="mx-auto text-[10px] uppercase">{n.label.slice(0, 2)}</span>}
              {!collapsed && badgeCount > 0 && n.badgeKey && (
                <span className="rounded-full bg-clay px-2 py-0.5 text-[10px] text-white">
                  {badgeCount > 99 ? "99+" : badgeCount.toLocaleString("ar-EG")}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        {!collapsed ? (
          <div className="flex items-center gap-3 rounded-md px-2 py-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-clay text-xs text-white">
              {initials}
            </span>
            <div className="min-w-0">
              <div className="truncate text-xs">{displayName}</div>
              <div className="truncate text-[10px] text-sidebar-foreground/60">{roleDisplay}</div>
            </div>
          </div>
        ) : (
          <span className="mx-auto grid h-8 w-8 place-items-center rounded-full bg-clay text-xs text-white">
            {initials}
          </span>
        )}
        <button
          type="button"
          onClick={() => void handleLogout()}
          disabled={loggingOut}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-sidebar-border px-2 py-2 text-xs text-sidebar-foreground/80 hover:bg-sidebar-accent disabled:opacity-50"
        >
          {loggingOut ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <LogOut className="h-3.5 w-3.5" />
          )}
          {!collapsed && <span>تسجيل الخروج</span>}
        </button>
        <button
          type="button"
          onClick={() => setDesktopOpen((v) => !v)}
          className="mt-2 hidden w-full rounded-md border border-sidebar-border px-2 py-1.5 text-[10px] uppercase tracking-wider text-sidebar-foreground/70 hover:bg-sidebar-accent lg:block"
        >
          {collapsed ? "↔" : "طيّ"}
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* DESKTOP SIDEBAR */}
      <aside
        className={[
          "fixed inset-y-0 right-0 z-30 hidden flex-col border-l border-sidebar-border bg-sidebar text-sidebar-foreground transition-all lg:flex",
          desktopOpen ? "w-64" : "w-16",
        ].join(" ")}
      >
        <SidebarInner collapsed={!desktopOpen} badges={badges} />
      </aside>

      {/* MOBILE DRAWER */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 right-0 flex w-72 max-w-[85vw] flex-col border-l border-sidebar-border bg-sidebar text-sidebar-foreground shadow-2xl animate-in slide-in-from-right">
            <SidebarInner collapsed={false} badges={badges} />
          </aside>
        </div>
      )}

      {/* MAIN COLUMN */}
      <div className={["transition-all", desktopOpen ? "lg:pr-64" : "lg:pr-16"].join(" ")}>
        <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
          <div className="flex h-14 items-center justify-between gap-2 px-3 sm:h-16 sm:px-6 lg:px-10">
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={() => setMobileOpen(true)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border hover:border-clay lg:hidden"
              aria-label="القائمة"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <div className="hidden font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground sm:block">
                لوحة الإدارة
              </div>
              <div className="truncate font-display text-sm sm:text-lg">{current.label}</div>
            </div>
          </div>
          <div className="relative flex shrink-0 items-center gap-2 sm:gap-4">
            <AdminHeaderSearch />
            <AdminAlertsMenu />
            <span className="hidden h-8 w-8 place-items-center rounded-full bg-clay text-xs text-white sm:grid">
              {initials}
            </span>
          </div>
          </div>
        </header>
        <main className="px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-8 lg:px-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function AdminAccessDenied({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-xl text-foreground">لا تملك صلاحية الوصول</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          حسابك مسجّل لكنه غير مرتبط بأي دور في فريق سند.
        </p>
        <Button className="mt-6" onClick={onLogout}>
          تسجيل الخروج
        </Button>
      </div>
    </div>
  );
}

export function AdminShellGate() {
  const { user, isStaff, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" search={{ redirect: path }} />;
  }

  if (!isStaff) {
    return (
      <AdminAccessDenied
        onLogout={() => {
          void signOut().then(() => navigate({ to: "/auth" }));
        }}
      />
    );
  }

  return <AdminShell />;
}
