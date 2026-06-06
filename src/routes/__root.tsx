import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">404</p>
        <h1 className="mt-4 text-3xl font-display text-foreground">الصفحة غير موجودة</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          الرابط الذي اتبعته لا يقود إلى أي صفحة في سند.
        </p>
        <a
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm text-primary-foreground transition hover:bg-primary/90"
        >
          العودة إلى الرئيسية
        </a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    if (import.meta.env.DEV) console.error("[Root error boundary]", error);
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-display text-foreground">حدث خلل في تحميل الصفحة</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          يمكنك المحاولة مجدداً أو العودة إلى الرئيسية.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            إعادة المحاولة
          </button>
          <a href="/" className="rounded-md border border-border bg-background px-4 py-2 text-sm hover:bg-secondary">
            الرئيسية
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "سند — منصة المساعدات الإنسانية" },
      { name: "description", content: "سند: منصة لإيصال المساعدات الإنسانية إلى العائلات النازحة في الجنوب اللبناني، بشفافية ودون وسطاء." },
      { name: "author", content: "SANAD" },
      { property: "og:title", content: "سند — منصة المساعدات الإنسانية" },
      { property: "og:description", content: "سند: منصة لإيصال المساعدات الإنسانية إلى العائلات النازحة في الجنوب اللبناني، بشفافية ودون وسطاء." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "سند — منصة المساعدات الإنسانية" },
      { name: "twitter:description", content: "سند: منصة لإيصال المساعدات الإنسانية إلى العائلات النازحة في الجنوب اللبناني، بشفافية ودون وسطاء." },
    ],
    links: [
      { rel: "icon", href: "/favicon.jpg", type: "image/jpeg" },
      { rel: "apple-touch-icon", href: "/favicon.jpg" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Noto+Kufi+Arabic:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster position="top-center" richColors />
      </AuthProvider>
    </QueryClientProvider>
  );
}
