import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { buildSanadQrPayload } from "@/lib/public-site-config";

type PublicQrCardProps = {
  referenceCode: string;
  requestId: string;
  instructions: string;
  compact?: boolean;
};

export function PublicQrCard({ referenceCode, requestId, instructions, compact }: PublicQrCardProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const payload = buildSanadQrPayload(referenceCode, requestId);
    QRCode.toDataURL(payload, { width: 320, margin: 1, errorCorrectionLevel: "M" })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [referenceCode, requestId]);

  const downloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `sanad-${referenceCode}.png`;
    a.click();
  };

  if (!qrDataUrl) return null;

  return (
    <div className={["flex flex-col items-center gap-3", compact ? "mt-4" : "mt-6"].join(" ")}>
      <div className="rounded-xl border border-border bg-white p-3">
        <img
          src={qrDataUrl}
          alt={`رمز QR للطلب ${referenceCode}`}
          width={compact ? 180 : 220}
          height={compact ? 180 : 220}
          className="block h-auto max-w-full"
        />
      </div>
      <p className="max-w-xs text-center text-[11px] text-muted-foreground sm:text-xs">{instructions}</p>
      <button
        type="button"
        onClick={downloadQr}
        className="rounded-full border border-border px-4 py-2 text-xs hover:border-clay"
      >
        تحميل الرمز
      </button>
    </div>
  );
}
