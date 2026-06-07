import { supabase } from "@/integrations/supabase/client";

export type SubmissionStatus = {
  accepting: boolean;
  daily_count: number;
  daily_limit: number;
  message_ar?: string | null;
};

export async function getSubmissionStatus(): Promise<
  { ok: true; status: SubmissionStatus } | { ok: false; message: string }
> {
  const { data, error } = await supabase.functions.invoke<{
    ok?: boolean;
    accepting?: boolean;
    daily_count?: number;
    daily_limit?: number;
    message_ar?: string | null;
    message?: string;
  }>("submission-status", { body: {} });

  if (error) {
    if (import.meta.env.DEV) console.error("[SubmissionStatus] invoke failed:", error);
    return { ok: false, message: "تعذّر تحميل حالة الاستقبال." };
  }

  if (!data?.ok) {
    return { ok: false, message: data?.message ?? "تعذّر تحميل حالة الاستقبال." };
  }

  return {
    ok: true,
    status: {
      accepting: data.accepting !== false,
      daily_count: data.daily_count ?? 0,
      daily_limit: data.daily_limit ?? 50,
      message_ar: data.message_ar ?? null,
    },
  };
}
