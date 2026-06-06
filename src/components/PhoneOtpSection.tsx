import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  otpCooldownLabel,
  sendPhoneOtp,
  verifyPhoneOtp,
} from "@/lib/phone-otp";

type Props = {
  phone: string;
  enabled: boolean;
  verified: boolean;
  onVerifiedChange: (verified: boolean) => void;
  error?: string | null;
};

export function PhoneOtpSection({
  phone,
  enabled,
  verified,
  onVerifiedChange,
  error,
}: Props) {
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sent, setSent] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [devHint, setDevHint] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    setCode("");
    setSent(false);
    setLocalError(null);
    setDevHint(null);
    onVerifiedChange(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(t);
  }, [cooldown]);

  const handleSend = async () => {
    setSending(true);
    setLocalError(null);
    setDevHint(null);
    const result = await sendPhoneOtp(phone);
    setSending(false);
    if (!result.ok) {
      setLocalError(result.message);
      return;
    }
    setSent(true);
    setCooldown(60);
    if (result.devCode) setDevHint(`وضع التطوير — الرمز: ${result.devCode}`);
  };

  const handleVerify = async () => {
    setVerifying(true);
    setLocalError(null);
    const result = await verifyPhoneOtp(phone, code);
    setVerifying(false);
    if (!result.ok) {
      setLocalError(result.message);
      onVerifiedChange(false);
      return;
    }
    onVerifiedChange(true);
  };

  if (!enabled) {
    return (
      <p className="text-xs text-muted-foreground">
        أدخل رقم هاتف لبناني صحيح لتفعيل التحقق برمز SMS.
      </p>
    );
  }

  if (verified) {
    return (
      <div className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-xs text-success">
        تم التحقق من رقم الهاتف بنجاح.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface/50 p-4">
      <div className="text-xs text-muted-foreground">
        سنرسل رمزاً من 6 أرقام إلى هذا الرقم قبل إرسال الطلب.
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={sending || cooldown > 0}
          onClick={() => void handleSend()}
          className="rounded-md border border-border bg-background px-3 py-2 text-xs hover:border-clay disabled:opacity-50"
        >
          {sending ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> جارٍ الإرسال...
            </span>
          ) : sent ? (
            otpCooldownLabel(cooldown)
          ) : (
            "إرسال رمز التحقق"
          )}
        </button>
      </div>
      {sent && (
        <div className="space-y-2">
          <div className="flex justify-center overflow-x-auto">
            <InputOTP maxLength={6} value={code} onChange={setCode}>
            <InputOTPGroup>
              {Array.from({ length: 6 }).map((_, i) => (
                <InputOTPSlot key={i} index={i} />
              ))}
            </InputOTPGroup>
          </InputOTP>
          </div>
          <button
            type="button"
            disabled={verifying || code.length < 6}
            onClick={() => void handleVerify()}
            className="rounded-md bg-primary px-3 py-2 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {verifying ? "جارٍ التحقق..." : "تأكيد الرمز"}
          </button>
        </div>
      )}
      {devHint && <p className="text-[11px] text-warning">{devHint}</p>}
      {(localError || error) && (
        <p className="text-xs text-destructive">{localError ?? error}</p>
      )}
    </div>
  );
}
