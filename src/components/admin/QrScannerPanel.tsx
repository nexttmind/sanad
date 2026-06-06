import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  onDecode: (text: string) => void;
};

export function QrScannerPanel({ onDecode }: Props) {
  const [active, setActive] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void; isScanning: boolean } | null>(null);
  const onDecodeRef = useRef(onDecode);
  onDecodeRef.current = onDecode;
  const regionId = "distribution-qr-reader";

  const stopScanner = useCallback(async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    if (s?.isScanning) {
      try {
        await s.stop();
        s.clear();
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    setCamError(null);

    void import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (cancelled) return;
      const scanner = new Html5Qrcode(regionId);
      scannerRef.current = scanner;

      Html5Qrcode.getCameras()
        .then((cams) => {
          if (cancelled) return;
          const back = cams.find((c) => /back|rear|environment/i.test(c.label));
          const camId = back?.id ?? cams[0]?.id;
          if (!camId) {
            setCamError("لم يتم العثور على كاميرا.");
            setActive(false);
            return;
          }
          return scanner.start(
            camId,
            { fps: 10, qrbox: { width: 220, height: 220 } },
            (decoded) => {
              onDecodeRef.current(decoded);
              void scanner.stop().then(() => scanner.clear()).catch(() => {});
              scannerRef.current = null;
              setActive(false);
            },
            () => {},
          );
        })
        .catch(() => {
          setCamError("تعذّر الوصول إلى الكاميرا — تحقق من صلاحيات المتصفح.");
          setActive(false);
        });
    });

    return () => {
      cancelled = true;
      void stopScanner();
    };
  }, [active, stopScanner]);

  return (
    <div className="relative aspect-square overflow-hidden rounded-xl border border-dashed border-border bg-surface">
      <div id={regionId} className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
      {!active && (
        <div className="absolute inset-0 grid place-items-center bg-surface/90 p-4 text-center">
          <button
            type="button"
            onClick={() => setActive(true)}
            className="rounded-md border border-border bg-background px-4 py-2 text-sm hover:border-clay"
          >
            تشغيل الكاميرا
          </button>
        </div>
      )}
      {camError && (
        <p className="absolute bottom-2 left-2 right-2 rounded-md bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
          {camError}
        </p>
      )}
      {active && (
        <button
          type="button"
          onClick={() => {
            void stopScanner();
            setActive(false);
          }}
          className="absolute left-2 top-2 rounded-md border border-border bg-background/90 px-2 py-1 text-[11px]"
        >
          إيقاف
        </button>
      )}
    </div>
  );
}
