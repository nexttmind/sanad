import { Link } from "@tanstack/react-router";

type CapReachedMessageProps = {
  message?: string | null;
  dailyCount?: number;
};

export function CapReachedMessage({ message, dailyCount }: CapReachedMessageProps) {
  const defaultMessage =
    "نعتذر — وصلنا إلى الحد اليومي لاستقبال الطلبات (٥٠ طلباً). سنعود لاستقبال طلبات جديدة غداً. إذا قدّمت طلباً سابقاً، يمكنك متابعته من صفحة التتبّع.";

  return (
    <div className="mx-auto max-w-2xl px-5 py-16 text-center sm:px-6 sm:py-24 lg:px-10">
      <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-warning/15 text-warning">
        <span className="text-2xl" aria-hidden>⏸</span>
      </div>
      <h1 className="mt-6 font-display text-3xl sm:text-4xl">استقبال الطلبات متوقّف مؤقتاً</h1>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
        {message ?? defaultMessage}
      </p>
      {typeof dailyCount === "number" && import.meta.env.DEV && (
        <p className="mt-2 text-xs text-muted-foreground">[dev] submissions today: {dailyCount}</p>
      )}
      <div className="mt-8">
        <Link
          to="/track"
          className="inline-flex rounded-full bg-primary px-6 py-3 text-sm text-primary-foreground hover:bg-primary/90"
        >
          متابعة طلب سابق
        </Link>
      </div>
    </div>
  );
}
