import { Link } from "@tanstack/react-router";
import type { PrecheckReason } from "@/lib/precheck-aid-submission";

type DuplicateSubmissionAlertProps = {
  reason: Extract<PrecheckReason, "phone_already_submitted" | "id_already_submitted">;
  message: string;
  referenceCode?: string | null;
};

export function DuplicateSubmissionAlert({
  reason,
  message,
  referenceCode,
}: DuplicateSubmissionAlertProps) {
  const label = reason === "phone_already_submitted" ? "رقم الهاتف" : "رقم الوثيقة";

  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-[13px] text-destructive sm:text-sm"
    >
      <p className="font-medium">{label} — طلب مسبق</p>
      <p className="mt-1 leading-relaxed">{message}</p>
      {referenceCode && (
        <p className="mt-2 font-mono text-xs" dir="ltr">
          مرجع سابق: {referenceCode}
        </p>
      )}
      <p className="mt-3">
        <Link to="/track" className="underline underline-offset-2 hover:text-destructive/80">
          متابعة الطلب من صفحة التتبّع
        </Link>
      </p>
    </div>
  );
}
