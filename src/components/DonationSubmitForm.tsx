import { useRef, useState } from "react";
import {
  METHOD_UI_TO_DB,
  submitDonation,
  type DonationMethod,
} from "@/lib/donations";

export type DonationIntent = {
  amount: number;
  methodKey: string;
  pledgedRequestId: string | null;
  pledgedRequestCode: string | null;
};

type Props = {
  intent: DonationIntent;
  onMethodKeyChange: (key: string) => void;
};

export function DonationSubmitForm({ intent, onMethodKeyChange }: Props) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [proof, setProof] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const method = METHOD_UI_TO_DB[intent.methodKey] as DonationMethod | undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!method) {
      setError("يرجى اختيار طريقة الدفع.");
      return;
    }
    if (!intent.amount || intent.amount <= 0) {
      setError("يرجى اختيار مبلغ التبرّع من القسم أعلاه.");
      return;
    }
    if (!anonymous && !name.trim()) {
      setError("يرجى إدخال اسمك أو اختيار التبرّع المجهول.");
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await submitDonation({
        donor_name: anonymous ? "متبرّع" : name.trim(),
        amount: intent.amount,
        method,
        message: message.trim() || null,
        is_anonymous: anonymous,
        pledged_for_request: intent.pledgedRequestId,
        proofFile: proof,
      });
      setSuccess(result.reference_code);
      setName("");
      setMessage("");
      setProof(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      if (import.meta.env.DEV) console.error("[DonationSubmit]", err);
      setError("تعذّر تسجيل التبرّع. تحقق من البيانات وحاول مجدداً.");
    }
    setBusy(false);
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="mt-8 rounded-2xl border border-border bg-background p-5 sm:p-6">
      <div className="font-display text-xl sm:text-2xl">تسجيل تبرّعك</div>
      <p className="mt-1 text-[12px] text-muted-foreground sm:text-sm">
        بعد التحويل عبر الطريقة المختارة، سجّل التفاصيل هنا. المبلغ:{" "}
        <span className="font-mono text-foreground">${intent.amount || 0}</span>
        {intent.pledgedRequestCode && (
          <>
            {" "}
            · العائلة: <span dir="ltr" className="font-mono">{intent.pledgedRequestCode}</span>
          </>
        )}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input
          value={name}
          disabled={anonymous}
          onChange={(e) => setName(e.target.value)}
          placeholder="اسمك (أو اتركه فارغاً إذا مجهول)"
          className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm disabled:opacity-50"
        />
        <select
          value={intent.methodKey}
          onChange={(e) => onMethodKeyChange(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
        >
          <option value="whish">Whish Money</option>
          <option value="bank">تحويل مصرفي</option>
          <option value="omt">OMT / WU</option>
          <option value="paypal">PayPal</option>
        </select>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="رسالة أو ملاحظة (اختياري — تظهر في جدار التعهّدات)"
          rows={2}
          className="sm:col-span-2 rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
        />
        <label className="sm:col-span-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-clay)]"
          />
          تبرّع مجهول
        </label>
        <div className="sm:col-span-2">
          <div className="text-[11px] text-muted-foreground">إرفاق إثبات الدفع (اختياري — JPG/PNG/PDF)</div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            onChange={(e) => setProof(e.target.files?.[0] ?? null)}
            className="mt-1 w-full text-sm"
          />
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      {success && (
        <div className="mt-3 rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">
          تم تسجيل تبرّعك — رقم المرجع: <span dir="ltr" className="font-mono">{success}</span>.
          سيتم مراجعته ونشره في السجل بعد التحقق.
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-4 w-full rounded-full bg-foreground py-3 text-sm font-medium text-background hover:bg-clay disabled:opacity-50"
      >
        {busy ? "جارٍ التسجيل..." : "تأكيد التبرّع"}
      </button>
    </form>
  );
}
