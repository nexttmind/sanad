import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

const links = [
  { to: "/", label: "قدّم طلباً" },
  { to: "/donate", label: "التبرّع" },
  { to: "/track", label: "تتبّع طلبك" },
];

export function PublicNav({
  tone = "light",
  greenMobileMenu = false,
}: {
  tone?: "light" | "dark" | "hero";
  greenMobileMenu?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const isDark = tone === "dark";
  const isHero = tone === "hero";
  const greenMenu = greenMobileMenu || isHero;

  // lock scroll while menu open
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  const headerText = isHero ? "text-primary" : isDark ? "text-white" : "text-foreground";
  const logoBorder = isHero
    ? "border-primary/40 bg-primary/10"
    : isDark
      ? "border-white/30 bg-white/5"
      : "border-foreground/20 bg-background/60";
  const subtitleText = isHero
    ? "text-primary/75"
    : isDark
      ? "text-white/60"
      : "text-muted-foreground";
  const linkText = isHero ? "text-white/90" : isDark ? "text-white/90" : "text-foreground/80";
  const donateBtn = isHero
    ? "bg-primary text-primary-foreground hover:bg-primary/90"
    : isDark
      ? "bg-white text-ink hover:bg-white/90"
      : "bg-primary text-primary-foreground hover:bg-primary/90";

  const mobileMenuBtn = open
    ? "text-foreground"
    : greenMenu
      ? "text-primary"
      : isDark
        ? "text-white"
        : "text-foreground";

  return (
    <header className={["absolute inset-x-0 top-0 z-50", headerText].join(" ")}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-6 sm:py-6 lg:px-10">
        <Link to="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <span
            className={["grid h-9 w-9 place-items-center rounded-full border font-display text-lg", logoBorder].join(" ")}
            aria-hidden
          >س</span>
          <div className="leading-tight">
            <div className="font-display text-lg tracking-tight">سند</div>
            <div className={["text-[10px] uppercase tracking-[0.32em]", subtitleText].join(" ")}>
              SANAD
            </div>
          </div>
        </Link>

        <nav className="hidden items-center gap-10 md:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              activeOptions={{ exact: true }}
              className={["text-sm transition hover:opacity-80", linkText].join(" ")}
              activeProps={{ className: "opacity-100 font-medium" }}
            >
              {l.label}
            </Link>
          ))}
          <Link
            to="/donate"
            className={["rounded-full px-5 py-2 text-sm transition", donateBtn].join(" ")}
          >
            تبرّع الآن
          </Link>
        </nav>

        {/* Animated hamburger */}
        <button
          className={[
            "relative z-50 grid h-10 w-10 place-items-center md:hidden",
            mobileMenuBtn,
          ].join(" ")}
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "إغلاق القائمة" : "فتح القائمة"}
          aria-expanded={open}
        >
          <span className="relative block h-4 w-7">
            <span
              className={[
                "absolute right-0 block h-px w-7 bg-current transition-all duration-300 ease-out",
                open ? "top-1/2 -translate-y-1/2 rotate-45" : "top-0",
              ].join(" ")}
            />
            <span
              className={[
                "absolute right-0 top-1/2 block h-px -translate-y-1/2 bg-current transition-all duration-200",
                open ? "w-0 opacity-0" : "w-7 opacity-100",
              ].join(" ")}
            />
            <span
              className={[
                "absolute right-0 block h-px bg-current transition-all duration-300 ease-out",
                open ? "top-1/2 w-7 -translate-y-1/2 -rotate-45" : "bottom-0 w-5",
              ].join(" ")}
            />
          </span>
        </button>
      </div>

      {/* Mobile overlay menu */}
      <div
        className={[
          "fixed inset-0 z-40 md:hidden",
          open ? "pointer-events-auto" : "pointer-events-none",
        ].join(" ")}
        aria-hidden={!open}
      >
        {/* Backdrop */}
        <div
          onClick={() => setOpen(false)}
          className={[
            "absolute inset-0 bg-ink/70 backdrop-blur-md transition-opacity duration-300",
            open ? "opacity-100" : "opacity-0",
          ].join(" ")}
        />

        {/* Sheet */}
        <div
          className={[
            "absolute inset-x-0 top-0 origin-top bg-background text-foreground shadow-2xl",
            "transition-all duration-400 ease-[cubic-bezier(0.2,0.7,0.2,1)]",
            open ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0",
          ].join(" ")}
          style={{ transitionDuration: "350ms" }}
        >
          <div className="mx-auto max-w-7xl px-5 pt-20 pb-8 sm:px-6">
            <div className="font-mono text-[10px] uppercase tracking-[0.42em] text-clay">القائمة</div>
            <nav className="mt-4 flex flex-col">
              {links.map((l, i) => (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setOpen(false)}
                  className={[
                    "group flex items-baseline justify-between gap-4 border-b border-border py-5 font-display text-2xl text-foreground transition",
                    "hover:text-clay",
                    open ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0",
                  ].join(" ")}
                  style={{
                    transitionProperty: "opacity, transform",
                    transitionDuration: "500ms",
                    transitionDelay: open ? `${120 + i * 70}ms` : "0ms",
                    transitionTimingFunction: "cubic-bezier(0.2,0.7,0.2,1)",
                  }}
                >
                  <span>{l.label}</span>
                  <span className="font-mono text-sm text-muted-foreground transition group-hover:-translate-x-1 group-hover:text-clay">←</span>
                </Link>
              ))}
            </nav>
            <Link
              to="/donate"
              onClick={() => setOpen(false)}
              className={[
                "mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90",
                open ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
              ].join(" ")}
              style={{
                transitionProperty: "opacity, transform",
                transitionDuration: "500ms",
                transitionDelay: open ? "360ms" : "0ms",
              }}
            >
              تبرّع الآن
            </Link>
            <div
              className={[
                "mt-6 text-[11px] text-muted-foreground transition",
                open ? "opacity-100" : "opacity-0",
              ].join(" ")}
              style={{ transitionDelay: open ? "440ms" : "0ms", transitionDuration: "500ms" }}
            >
              للتواصل المباشر · <span dir="ltr" className="font-mono text-foreground">+961 70 000 000</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
