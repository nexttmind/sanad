import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";

export type RequestStatus = Database["public"]["Enums"]["request_status"];

export type TimelineStage = { key: string; title: string; desc: string };

export type PublicSiteConfig = {
  track: {
    enabled: boolean;
    show_queue_position: boolean;
    page_title: string;
    page_subtitle: string;
    not_found_title: string;
    not_found_bullets: string[];
    rate_limit_message: string;
    reminders: string[];
    contact_heading: string;
    contact_subheading: string;
    contact_phone: string;
    contact_hours: string;
    status_labels: Record<RequestStatus, string>;
    next_steps: Record<RequestStatus, string>;
    timeline_stages: TimelineStage[];
  };
  qr: {
    show_on_submit_success: boolean;
    show_on_track_when_approved: boolean;
    submit_success_title: string;
    submit_success_subtitle: string;
    submit_success_instructions: string;
    submit_success_steps: string[];
    track_qr_instructions: string;
  };
  contact: {
    footer_phone: string;
    footer_email: string;
    footer_location: string;
  };
};

export const DEFAULT_PUBLIC_SITE_CONFIG: PublicSiteConfig = {
  track: {
    enabled: true,
    show_queue_position: true,
    page_title: "تتبّع طلبك",
    page_subtitle: "أدخل رقم هاتفك والرقم المرجعي لمعرفة آخر تحديثات حالتك.",
    not_found_title: "لم نعثر على طلب بهذه المعلومات",
    not_found_bullets: [
      "تأكّد أنّ الرقم المرجعي بصيغة SND-XXXXX.",
      "تأكّد أنّ رقم الهاتف هو نفسه الذي استخدمته عند التقديم.",
      "إذا استمرّت المشكلة، تواصل مع فريقنا مباشرةً.",
    ],
    rate_limit_message:
      "عدد محاولات التتبّع كبير من هذا الاتصال. يرجى الانتظار ساعة ثم المحاولة مجدداً.",
    reminders: [
      "احتفظ برقمك المرجعي — ستحتاج إليه في أي متابعة لاحقة.",
      "تأكّد أن هاتفك متاح — سيتواصل معك الفريق على الرقم الذي قدّمته.",
      "إذا تغيّر وضعك (موقع جديد، حالة طبية طارئة) تواصل معنا فوراً.",
      "قد نتّصل من رقم غير معروف — يرجى الرّد على جميع الاتصالات.",
    ],
    contact_heading: "للحالات الإنسانية العاجلة فقط",
    contact_subheading: "اتصال أو واتساب",
    contact_phone: "+961 70 000 000",
    contact_hours: "يومياً ٨ صباحاً — ٨ مساءً",
    status_labels: {
      submitted: "قيد الانتظار",
      reviewing: "قيد المراجعة",
      verifying: "التحقق من المرجع",
      approved: "موافق عليه",
      distributed: "تم التوزيع",
      rejected: "مرفوض",
      on_hold: "يحتاج مزيداً من المعلومات",
    },
    next_steps: {
      submitted:
        "طلبك في قائمة الانتظار. سيبدأ فريقنا بمراجعته قريباً. لا حاجة لأي إجراء من جهتك الآن.",
      reviewing:
        "فريقنا يراجع طلبك حالياً. قد نتواصل معك على رقمك إذا احتجنا إلى مزيد من المعلومات.",
      verifying:
        "نتواصل مع المرجع الذي ذكرته للتحقق من هويتك. تأكد أن المرجع يعرف بتقديمك لهذا الطلب.",
      approved:
        "تهانينا — تم الموافقة على طلبك. سيتواصل معك فريقنا على رقم هاتفك لتحديد موعد وموقع استلام المساعدات.",
      distributed:
        "تم توزيع المساعدات على عائلتك. نأمل أن تكون قد وصلت في الوقت المناسب. شكراً لثقتك بسند.",
      rejected:
        "نأسف لإبلاغك أن طلبك لم يتم قبوله في الوقت الحالي. للاستفسار عن السبب يرجى التواصل معنا مباشرة.",
      on_hold:
        "فريقنا بحاجة إلى مزيد من المعلومات. يرجى انتظار اتصالنا على رقم هاتفك أو التواصل معنا مباشرة.",
    },
    timeline_stages: [
      { key: "submitted", title: "تم تقديم الطلب", desc: "تم استلام طلبك بنجاح." },
      { key: "reviewing", title: "قيد المراجعة", desc: "يقوم فريقنا بمراجعة المعلومات المُقدّمة." },
      { key: "verifying", title: "التحقق من المرجع", desc: "نتواصل مع المرجع الذي ذكرته للتأكد من حالتك." },
      { key: "approved", title: "موافق عليه", desc: "تمّت الموافقة وتمّت جدولة التوزيع." },
      { key: "distributed", title: "تم التوزيع", desc: "وصلت المساعدات إلى العائلة." },
    ],
  },
  qr: {
    show_on_submit_success: true,
    show_on_track_when_approved: true,
    submit_success_title: "تم استلام طلبك بنجاح",
    submit_success_subtitle: "سيتواصل معك فريق سند على رقم هاتفك في أقرب وقت ممكن.",
    submit_success_instructions:
      "احفظ هذا الرمز. سيُطلب منك عرضه عند توزيع المساعدة لتأكيد هويتك.",
    submit_success_steps: [
      "يُراجع طلبك من قبل فريقنا.",
      "نتواصل مع المرجع للتحقق من حالتك.",
      "نتواصل معك لتحديد موعد التوزيع.",
    ],
    track_qr_instructions:
      "اعرض هذا الرمز عند نقطة التوزيع مع رقم الهوية. سيُطلب منك أيضاً إدخال الرمز السري.",
  },
  contact: {
    footer_phone: "+961 70 000 000",
    footer_email: "hello@sanad.lb",
    footer_location: "صور — الجنوب اللبناني",
  },
};

const STATUS_KEYS: RequestStatus[] = [
  "submitted",
  "reviewing",
  "verifying",
  "approved",
  "distributed",
  "rejected",
  "on_hold",
];

function asString(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() ? v : fallback;
}

function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function asStringArray(v: unknown, fallback: string[]): string[] {
  if (!Array.isArray(v)) return fallback;
  const items = v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  return items.length > 0 ? items : fallback;
}

function mergeStatusMap(
  raw: unknown,
  fallback: Record<RequestStatus, string>,
): Record<RequestStatus, string> {
  const out = { ...fallback };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const key of STATUS_KEYS) {
    const val = (raw as Record<string, unknown>)[key];
    if (typeof val === "string" && val.trim()) out[key] = val;
  }
  return out;
}

function mergeTimelineStages(raw: unknown, fallback: TimelineStage[]): TimelineStage[] {
  if (!Array.isArray(raw)) return fallback;
  const stages = raw
    .filter((s): s is TimelineStage => {
      if (!s || typeof s !== "object" || Array.isArray(s)) return false;
      const row = s as TimelineStage;
      return Boolean(row.key?.trim() && row.title?.trim());
    })
    .map((s) => ({
      key: s.key.trim(),
      title: s.title.trim(),
      desc: asString(s.desc, ""),
    }));
  return stages.length > 0 ? stages : fallback;
}

export function mergePublicSiteConfig(raw: unknown): PublicSiteConfig {
  const base = DEFAULT_PUBLIC_SITE_CONFIG;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const c = raw as Partial<PublicSiteConfig>;
  const track = c.track ?? {};
  const qr = c.qr ?? {};
  const contact = c.contact ?? {};

  return {
    track: {
      enabled: asBool(track.enabled, base.track.enabled),
      show_queue_position: asBool(track.show_queue_position, base.track.show_queue_position),
      page_title: asString(track.page_title, base.track.page_title),
      page_subtitle: asString(track.page_subtitle, base.track.page_subtitle),
      not_found_title: asString(track.not_found_title, base.track.not_found_title),
      not_found_bullets: asStringArray(track.not_found_bullets, base.track.not_found_bullets),
      rate_limit_message: asString(track.rate_limit_message, base.track.rate_limit_message),
      reminders: asStringArray(track.reminders, base.track.reminders),
      contact_heading: asString(track.contact_heading, base.track.contact_heading),
      contact_subheading: asString(track.contact_subheading, base.track.contact_subheading),
      contact_phone: asString(track.contact_phone, base.track.contact_phone),
      contact_hours: asString(track.contact_hours, base.track.contact_hours),
      status_labels: mergeStatusMap(track.status_labels, base.track.status_labels),
      next_steps: mergeStatusMap(track.next_steps, base.track.next_steps),
      timeline_stages: mergeTimelineStages(track.timeline_stages, base.track.timeline_stages),
    },
    qr: {
      show_on_submit_success: asBool(qr.show_on_submit_success, base.qr.show_on_submit_success),
      show_on_track_when_approved: asBool(
        qr.show_on_track_when_approved,
        base.qr.show_on_track_when_approved,
      ),
      submit_success_title: asString(qr.submit_success_title, base.qr.submit_success_title),
      submit_success_subtitle: asString(qr.submit_success_subtitle, base.qr.submit_success_subtitle),
      submit_success_instructions: asString(
        qr.submit_success_instructions,
        base.qr.submit_success_instructions,
      ),
      submit_success_steps: asStringArray(qr.submit_success_steps, base.qr.submit_success_steps),
      track_qr_instructions: asString(qr.track_qr_instructions, base.qr.track_qr_instructions),
    },
    contact: {
      footer_phone: asString(contact.footer_phone, base.contact.footer_phone),
      footer_email: asString(contact.footer_email, base.contact.footer_email),
      footer_location: asString(contact.footer_location, base.contact.footer_location),
    },
  };
}

export function phoneToTelHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "tel:";
  return digits.startsWith("961") ? `tel:+${digits}` : `tel:+961${digits.replace(/^0/, "")}`;
}

let cachedConfig: PublicSiteConfig | null = null;
let cachePromise: Promise<PublicSiteConfig> | null = null;

export function clearPublicSiteConfigCache(): void {
  cachedConfig = null;
  cachePromise = null;
}

export function cloneDefaultPublicSiteConfig(): PublicSiteConfig {
  return structuredClone(DEFAULT_PUBLIC_SITE_CONFIG);
}

export async function fetchPublicSiteConfig(force = false): Promise<PublicSiteConfig> {
  if (force) clearPublicSiteConfigCache();
  if (cachedConfig) return cachedConfig;
  if (cachePromise) return cachePromise;

  cachePromise = (async () => {
    const { data, error } = await supabase.rpc("get_public_site_config");
    if (error) {
      if (import.meta.env.DEV) console.warn("[PublicSiteConfig] RPC failed, using defaults:", error);
      cachedConfig = DEFAULT_PUBLIC_SITE_CONFIG;
      return cachedConfig;
    }
    cachedConfig = mergePublicSiteConfig(data);
    return cachedConfig;
  })();

  try {
    return await cachePromise;
  } finally {
    cachePromise = null;
  }
}

export async function savePublicSiteConfig(config: PublicSiteConfig): Promise<number> {
  const { data, error } = await supabase.rpc("save_public_site_config", {
    _config: config as unknown as Json,
  });
  if (error) throw error;
  cachedConfig = mergePublicSiteConfig(config);
  return Number(data ?? 0);
}

export function buildSanadQrPayload(referenceCode: string, requestId: string): string {
  return `SANAD:${referenceCode}:${requestId}:${new Date().toISOString().slice(0, 10)}`;
}
