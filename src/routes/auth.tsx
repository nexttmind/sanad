import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  checkIsStaff,
  claimFirstAdmin,
  safeAdminRedirect,
} from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthSearch = {
  redirect?: string;
};

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — سند" },
      { name: "description", content: "تسجيل دخول فريق سند إلى لوحة الإدارة." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const { user, isStaff, loading, refreshProfile } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user && isStaff) {
      void navigate({ to: safeAdminRedirect(redirect) });
    }
  }, [loading, user, isStaff, redirect, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        if (import.meta.env.DEV) console.error("[Auth] signIn failed:", signInError.message);
        const msg = signInError.message.toLowerCase();
        if (msg.includes("invalid api key") || msg.includes("unregistered api key")) {
          setError("خطأ في إعدادات الاتصال بقاعدة البيانات. راجع ملف .env وأعد تشغيل الخادم.");
        } else if (msg.includes("email not confirmed")) {
          setError("يجب تأكيد البريد الإلكتروني قبل تسجيل الدخول.");
        } else {
          setError("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
        }
        return;
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        setError("تعذّر التحقق من الجلسة. حاول مجدداً.");
        return;
      }

      let staff = await checkIsStaff(userData.user.id);
      if (!staff) {
        const claimed = await claimFirstAdmin();
        if (claimed) staff = await checkIsStaff(userData.user.id);
      }

      if (!staff) {
        await supabase.auth.signOut();
        setError("ليس لديك صلاحية للوصول إلى لوحة الإدارة.");
        return;
      }

      await refreshProfile();
      void navigate({ to: safeAdminRedirect(redirect) });
    } catch (err) {
      if (import.meta.env.DEV) console.error("[Auth] login error:", err);
      setError("حدث خطأ أثناء تسجيل الدخول. حاول مجدداً.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (user && isStaff) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full border border-border bg-surface font-display text-xl">
            س
          </div>
          <h1 className="font-display text-2xl text-foreground">تسجيل الدخول</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            لوحة إدارة سند — للموظفين المصرّح لهم فقط
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-xl border border-border bg-surface p-6 shadow-sm"
        >
          <div className="space-y-2">
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              dir="ltr"
              className="text-left"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">كلمة المرور</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              dir="ltr"
              className="text-left"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={submitting}
              minLength={6}
            />
          </div>

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري الدخول...
              </>
            ) : (
              "دخول"
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <a href="/" className="underline-offset-2 hover:underline">
            العودة إلى الموقع العام
          </a>
        </p>
      </div>
    </div>
  );
}
