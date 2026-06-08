import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  activateAdminUser,
  ASSIGNABLE_ROLES,
  createAdminUser,
  deactivateAdminUser,
  fetchAdminUsers,
  formatLastSignIn,
  roleLabel,
  updateAdminUserRole,
  type AdminUserRow,
} from "@/lib/admin-users";
import type { AppRole } from "@/lib/auth";
import { useAdminTableRealtime } from "@/lib/use-admin-realtime";
import {
  AdminDesktopTable,
  AdminMobileCard,
  AdminMobileCardActions,
  AdminMobileCardGrid,
  AdminMobileCardHeader,
  AdminMobileList,
} from "@/components/admin/AdminMobileCard";
import { AdminActionModal } from "@/components/admin/AdminActionModal";

export const Route = createFileRoute("/admin/users")({
  component: Users,
});

function Users() {
  const { user, roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "reviewer" as AppRole,
  });
  const [roleTarget, setRoleTarget] = useState<AdminUserRow | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchAdminUsers();
      setRows(data);
    } catch (err) {
      if (import.meta.env.DEV) console.error("[Users]", err);
      setError("تعذّر تحميل المستخدمين. تأكد من تطبيق migration 20260605200000.");
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      setLoading(true);
      await load();
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [isAdmin, load]);

  useAdminTableRealtime("admin-users", "user_roles", () => {
    if (isAdmin) void load();
  });

  const submitCreate = async () => {
    if (!form.full_name.trim() || !form.email.trim() || form.password.length < 8) {
      setError("يرجى تعبئة الاسم والبريد وكلمة مرور (8 أحرف على الأقل).");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await createAdminUser(form);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setForm({ full_name: "", email: "", password: "", role: "reviewer" });
    setShowCreate(false);
    await load();
  };

  const toggleActive = async (row: AdminUserRow) => {
    setBusy(true);
    setError(null);
    const result = row.is_active
      ? await deactivateAdminUser(row.user_id)
      : await activateAdminUser(row.user_id);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    await load();
  };

  const changeRole = async (row: AdminUserRow, next: AppRole) => {
    if (!ASSIGNABLE_ROLES.includes(next)) return;
    setBusy(true);
    setError(null);
    const result = await updateAdminUserRole(row.user_id, next);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    await load();
  };

  if (!isAdmin) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <div className="font-display text-lg">صلاحية المدير مطلوبة</div>
        <p className="mt-2 text-sm text-muted-foreground">
          للوصول الكامل لهذه الصفحة يجب أن تكون مديراً.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          إدارة حسابات فريق سند — إنشاء وتعطيل وتعديل الأدوار.
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
        >
          {showCreate ? "إلغاء" : "+ مستخدم جديد"}
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {showCreate && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 font-display text-base">مستخدم جديد</div>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              placeholder="الاسم الكامل"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              dir="ltr"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="email@example.com"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              dir="ltr"
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="كلمة المرور (8+ أحرف)"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as AppRole }))}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            لا يُرسل بريد تأكيد — يمكن للمستخدم تسجيل الدخول مباشرة بالبريد وكلمة المرور.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submitCreate()}
            className="mt-4 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            إنشاء
          </button>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3 text-xs text-muted-foreground sm:px-5">
          {loading ? "جارٍ التحميل..." : `${rows.length} مستخدم`}
        </div>
        <AdminDesktopTable>
        <table className="w-full min-w-[640px] text-right text-sm">
          <thead>
            <tr className="border-b border-border bg-surface text-[11px] uppercase text-muted-foreground">
              <th className="px-4 py-3 font-medium">الاسم</th>
              <th className="px-4 py-3 font-medium">البريد</th>
              <th className="px-4 py-3 font-medium">الدور</th>
              <th className="px-4 py-3 font-medium">الحالة</th>
              <th className="px-4 py-3 font-medium">آخر دخول</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={`${u.user_id}-${u.role}`} className="border-b border-border/60">
                <td className="px-4 py-3 font-medium">{u.display_name}</td>
                <td className="px-4 py-3">
                  <span dir="ltr" className="font-mono text-xs">
                    {u.email}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs">
                  <span className="rounded-full bg-foreground/10 px-2 py-0.5">{roleLabel(u.role)}</span>
                </td>
                <td className="px-4 py-3 text-xs">
                  {u.is_active ? (
                    <span className="text-success">نشط</span>
                  ) : (
                    <span className="text-muted-foreground">معطّل</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {formatLastSignIn(u.last_sign_in_at)}
                </td>
                <td className="px-4 py-3 text-left">
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      disabled={busy || u.user_id === user?.id}
                      onClick={() => setRoleTarget(u)}
                      className="text-xs text-clay hover:underline disabled:opacity-50"
                    >
                      تعديل
                    </button>
                    {u.user_id !== user?.id && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void toggleActive(u)}
                        className={[
                          "text-xs hover:underline disabled:opacity-50",
                          u.is_active ? "text-destructive" : "text-success",
                        ].join(" ")}
                      >
                        {u.is_active ? "تعطيل" : "تفعيل"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  لا يوجد مستخدمون.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </AdminDesktopTable>

        <AdminMobileList loading={loading} empty={!loading && rows.length === 0} emptyMessage="لا يوجد مستخدمون.">
          {rows.map((u) => (
            <AdminMobileCard key={`${u.user_id}-${u.role}`}>
              <AdminMobileCardHeader
                title={u.display_name}
                mono={u.email}
                badge={
                  <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px]">
                    {roleLabel(u.role)}
                  </span>
                }
              />
              <AdminMobileCardGrid
                rows={[
                  { label: "الحالة", value: u.is_active ? "نشط" : "معطّل" },
                  { label: "آخر دخول", value: formatLastSignIn(u.last_sign_in_at) },
                ]}
              />
              <AdminMobileCardActions>
                <button
                  type="button"
                  disabled={busy || u.user_id === user?.id}
                  onClick={() => setRoleTarget(u)}
                  className="text-xs text-clay hover:underline disabled:opacity-50"
                >
                  تعديل الدور
                </button>
                {u.user_id !== user?.id && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void toggleActive(u)}
                    className={[
                      "text-xs hover:underline disabled:opacity-50",
                      u.is_active ? "text-destructive" : "text-success",
                    ].join(" ")}
                  >
                    {u.is_active ? "تعطيل" : "تفعيل"}
                  </button>
                )}
              </AdminMobileCardActions>
            </AdminMobileCard>
          ))}
        </AdminMobileList>
      </div>
      <AdminActionModal
        open={roleTarget != null}
        title="تعديل دور المستخدم"
        preview={
          roleTarget
            ? [
                { label: "الاسم", value: roleTarget.display_name },
                { label: "البريد", value: <span dir="ltr">{roleTarget.email}</span> },
                { label: "الدور الحالي", value: roleLabel(roleTarget.role) },
              ]
            : undefined
        }
        selectLabel="الدور الجديد"
        selectOptions={ASSIGNABLE_ROLES.map((r) => ({ value: r, label: roleLabel(r) }))}
        selectValue={roleTarget?.role}
        confirmLabel="حفظ الدور"
        busy={busy}
        onClose={() => setRoleTarget(null)}
        onConfirm={async ({ selected }) => {
          if (!roleTarget || !selected) return;
          await changeRole(roleTarget, selected as AppRole);
          setRoleTarget(null);
        }}
      />
    </div>
  );
}
