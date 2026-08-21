import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { logAdminAction } from "@/lib/audit-log";
import {
  cloneDefaultPublicSiteConfig,
  DEFAULT_PUBLIC_SITE_CONFIG,
  fetchPublicSiteConfig,
  savePublicSiteConfig,
  type PublicSiteConfig,
  type RequestStatus,
} from "@/lib/public-site-config";

export const Route = createFileRoute("/admin/public-settings")({
  component: PublicSettingsPage,
});

const STATUS_KEYS: RequestStatus[] = [
  "submitted",
  "reviewing",
  "verifying",
  "approved",
  "distributed",
  "rejected",
  "on_hold",
];

function PublicSettingsPage() {
  const { roles, displayName } = useAuth();
  const [config, setConfig] = useState<PublicSiteConfig>(DEFAULT_PUBLIC_SITE_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<"track" | "qr" | "contact">("track");

  useEffect(() => {
    void (async () => {
      try {
        setConfig(await fetchPublicSiteConfig(true));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (!roles.includes("admin")) {
    return <Navigate to="/admin" />;
  }

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await savePublicSiteConfig(config);
      await logAdminAction({
        action: "public_site_config_updated",
        actorName: displayName,
        metadata: { tab },
      });
      setMessage("تم حفظ الإعدادات.");
    } catch {
      setMessage("تعذّر حفظ الإعدادات.");
    } finally {
      setSaving(false);
    }
  };

  const updateTrack = <K extends keyof PublicSiteConfig["track"]>(
    key: K,
    value: PublicSiteConfig["track"][K],
  ) => {
    setConfig((c) => ({ ...c, track: { ...c.track, [key]: value } }));
  };

  const updateQr = <K extends keyof PublicSiteConfig["qr"]>(
    key: K,
    value: PublicSiteConfig["qr"][K],
  ) => {
    setConfig((c) => ({ ...c, qr: { ...c.qr, [key]: value } }));
  };

  const updateContact = <K extends keyof PublicSiteConfig["contact"]>(
    key: K,
    value: PublicSiteConfig["contact"][K],
  ) => {
    setConfig((c) => ({ ...c, contact: { ...c.contact, [key]: value } }));
  };

  const updateLines = (field: "not_found_bullets" | "reminders" | "submit_success_steps", text: string) => {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (field === "submit_success_steps") updateQr("submit_success_steps", lines);
    else updateTrack(field, lines);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-2xl">إعدادات الموقع العام</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            تحكم بنصوص صفحة التتبّع، رمز QR، ومعلومات التواصل الظاهرة للجمهور. احفظ بعد كل تعديل لترى التغيير على الموقع.
          </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {([
          ["track", "صفحة التتبّع"],
          ["qr", "رمز QR"],
          ["contact", "التواصل"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={[
              "rounded-full px-4 py-2 text-sm transition",
              tab === id ? "bg-primary text-primary-foreground" : "border border-border hover:border-clay",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "track" && (
        <div className="space-y-5 rounded-xl border border-border bg-card p-5">
          <Toggle
            label="تفعيل صفحة التتبّع"
            checked={config.track.enabled}
            onChange={(v) => updateTrack("enabled", v)}
          />
          <Toggle
            label="إظهار دور القائمة"
            checked={config.track.show_queue_position}
            onChange={(v) => updateTrack("show_queue_position", v)}
          />
          <Field label="عنوان الصفحة" value={config.track.page_title} onChange={(v) => updateTrack("page_title", v)} />
          <Field label="الوصف" value={config.track.page_subtitle} onChange={(v) => updateTrack("page_subtitle", v)} multiline />
          <Field label="عنوان «لم يُعثر»" value={config.track.not_found_title} onChange={(v) => updateTrack("not_found_title", v)} />
          <Field
            label="نقاط «لم يُعثر» (سطر لكل نقطة)"
            value={config.track.not_found_bullets.join("\n")}
            onChange={(v) => updateLines("not_found_bullets", v)}
            multiline
          />
          <Field label="رسالة تجاوز الحد" value={config.track.rate_limit_message} onChange={(v) => updateTrack("rate_limit_message", v)} multiline />
          <Field
            label="التذكيرات (سطر لكل تذكير)"
            value={config.track.reminders.join("\n")}
            onChange={(v) => updateLines("reminders", v)}
            multiline
          />
          <Field label="عنوان التواصل العاجل" value={config.track.contact_heading} onChange={(v) => updateTrack("contact_heading", v)} />
          <Field label="هاتف التواصل" value={config.track.contact_phone} onChange={(v) => updateTrack("contact_phone", v)} ltr />
          <Field label="ساعات العمل" value={config.track.contact_hours} onChange={(v) => updateTrack("contact_hours", v)} />

          <div className="border-t border-border pt-4">
            <h2 className="font-display text-lg">مراحل المسار (التايملاين)</h2>
            <div className="mt-3 space-y-4">
              {config.track.timeline_stages.map((stage, index) => (
                <div key={`${stage.key}-${index}`} className="rounded-lg border border-border p-4 space-y-3">
                  <Field
                    label={`مفتاح المرحلة ${index + 1}`}
                    value={stage.key}
                    onChange={(v) => {
                      const next = [...config.track.timeline_stages];
                      next[index] = { ...next[index], key: v };
                      updateTrack("timeline_stages", next);
                    }}
                    ltr
                  />
                  <Field
                    label="العنوان"
                    value={stage.title}
                    onChange={(v) => {
                      const next = [...config.track.timeline_stages];
                      next[index] = { ...next[index], title: v };
                      updateTrack("timeline_stages", next);
                    }}
                  />
                  <Field
                    label="الوصف"
                    value={stage.desc}
                    onChange={(v) => {
                      const next = [...config.track.timeline_stages];
                      next[index] = { ...next[index], desc: v };
                      updateTrack("timeline_stages", next);
                    }}
                    multiline
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <h2 className="font-display text-lg">تسميات الحالة</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {STATUS_KEYS.map((status) => (
                <Field
                  key={status}
                  label={status}
                  value={config.track.status_labels[status]}
                  onChange={(v) =>
                    updateTrack("status_labels", { ...config.track.status_labels, [status]: v })
                  }
                />
              ))}
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <h2 className="font-display text-lg">«ماذا يحدث الآن» لكل حالة</h2>
            <div className="mt-3 space-y-3">
              {STATUS_KEYS.map((status) => (
                <Field
                  key={status}
                  label={status}
                  value={config.track.next_steps[status]}
                  onChange={(v) =>
                    updateTrack("next_steps", { ...config.track.next_steps, [status]: v })
                  }
                  multiline
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "qr" && (
        <div className="space-y-5 rounded-xl border border-border bg-card p-5">
          <Toggle
            label="إظهار QR بعد تقديم الطلب"
            checked={config.qr.show_on_submit_success}
            onChange={(v) => updateQr("show_on_submit_success", v)}
          />
          <Toggle
            label="إظهار QR في التتبّع عند الموافقة"
            checked={config.qr.show_on_track_when_approved}
            onChange={(v) => updateQr("show_on_track_when_approved", v)}
          />
          <Field label="عنوان النجاح" value={config.qr.submit_success_title} onChange={(v) => updateQr("submit_success_title", v)} />
          <Field label="وصف النجاح" value={config.qr.submit_success_subtitle} onChange={(v) => updateQr("submit_success_subtitle", v)} multiline />
          <Field label="تعليمات QR بعد التقديم" value={config.qr.submit_success_instructions} onChange={(v) => updateQr("submit_success_instructions", v)} multiline />
          <Field
            label="خطوات «ماذا يحدث الآن» بعد التقديم"
            value={config.qr.submit_success_steps.join("\n")}
            onChange={(v) => updateLines("submit_success_steps", v)}
            multiline
          />
          <Field label="تعليمات QR في صفحة التتبّع" value={config.qr.track_qr_instructions} onChange={(v) => updateQr("track_qr_instructions", v)} multiline />
        </div>
      )}

      {tab === "contact" && (
        <div className="space-y-5 rounded-xl border border-border bg-card p-5">
          <Field label="هاتف التذييل" value={config.contact.footer_phone} onChange={(v) => updateContact("footer_phone", v)} ltr />
          <Field label="البريد" value={config.contact.footer_email} onChange={(v) => updateContact("footer_email", v)} ltr />
          <Field label="الموقع" value={config.contact.footer_location} onChange={(v) => updateContact("footer_location", v)} />
          <Field label="رابط Instagram" value={config.contact.instagram_url} onChange={(v) => updateContact("instagram_url", v)} ltr />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="rounded-full bg-primary px-6 py-2.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {saving ? "جارٍ الحفظ..." : "حفظ الإعدادات"}
        </button>
        <button
          type="button"
          onClick={() => setConfig(cloneDefaultPublicSiteConfig())}
          className="rounded-full border border-border px-5 py-2.5 text-sm hover:border-clay"
        >
          استعادة الافتراضي
        </button>
        {message && <span className="text-sm text-muted-foreground">{message}</span>}
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border px-4 py-3">
      <span className="text-sm">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
  ltr,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  ltr?: boolean;
}) {
  const cls =
    "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-clay focus:outline-none focus:ring-2 focus:ring-clay/20";
  return (
    <label className="block text-sm">
      <span className="text-muted-foreground">{label}</span>
      {multiline ? (
        <textarea dir={ltr ? "ltr" : undefined} rows={3} value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
      ) : (
        <input dir={ltr ? "ltr" : undefined} value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
      )}
    </label>
  );
}
