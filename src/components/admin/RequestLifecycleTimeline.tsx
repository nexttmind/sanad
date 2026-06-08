import type { Database } from "@/integrations/supabase/types";

type HistoryRow = Database["public"]["Tables"]["aid_request_history"]["Row"];
type DbStatus = Database["public"]["Enums"]["request_status"];

export type LifecycleTimelineEntry = {
  id: string;
  fromStatus: DbStatus | null;
  toStatus: DbStatus;
  createdAt: string;
  reason: string | null;
  durationMs: number | null;
  durationLabel: string | null;
};

function formatDuration(ms: number): string {
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins} د`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours} س`;
  const days = Math.floor(hours / 24);
  return `${days} ي`;
}

export function buildLifecycleTimeline(
  history: HistoryRow[],
  submittedAt: string,
  _statusLabels: Record<DbStatus, string>,
): LifecycleTimelineEntry[] {
  const asc = [...history].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  const entries: LifecycleTimelineEntry[] = [];
  let prevAt = submittedAt;

  for (const h of asc) {
    const at = h.created_at;
    const durationMs = new Date(at).getTime() - new Date(prevAt).getTime();
    entries.push({
      id: h.id,
      fromStatus: h.from_status,
      toStatus: h.to_status,
      createdAt: at,
      reason: h.reason,
      durationMs: durationMs > 0 ? durationMs : null,
      durationLabel: durationMs > 0 ? formatDuration(durationMs) : null,
    });
    prevAt = at;
  }

  return entries;
}

type Props = {
  history: HistoryRow[];
  submittedAt: string;
  currentStatus: DbStatus;
  statusLabels: Record<DbStatus, string>;
  timeAgo: (iso: string) => string;
};

export function RequestLifecycleTimeline({
  history,
  submittedAt,
  currentStatus,
  statusLabels,
  timeAgo,
}: Props) {
  const entries = buildLifecycleTimeline(history, submittedAt, statusLabels);
  const lastAt = entries.length > 0 ? entries[entries.length - 1].createdAt : submittedAt;
  const inCurrentMs = Date.now() - new Date(lastAt).getTime();

  if (entries.length === 0) {
    return (
      <ol className="space-y-3 text-sm">
        <li className="flex gap-3">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-clay" />
          <div>
            <div>{statusLabels[currentStatus]}</div>
            <div className="text-xs text-muted-foreground">{timeAgo(submittedAt)} · منذ التقديم</div>
          </div>
        </li>
      </ol>
    );
  }

  return (
    <ol className="relative space-y-4 border-r border-border pr-4 text-sm">
      {entries.map((h, i) => (
        <li key={h.id} className="relative flex gap-3">
          <span
            className={[
              "absolute -right-[calc(0.5rem+5px)] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background",
              i === entries.length - 1 ? "bg-clay" : "bg-muted-foreground/40",
            ].join(" ")}
          />
          <div className="min-w-0 flex-1">
            <div className="font-medium">
              {h.fromStatus ? `${statusLabels[h.fromStatus]} → ` : "تقديم → "}
              {statusLabels[h.toStatus]}
            </div>
            <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
              <span>{timeAgo(h.createdAt)}</span>
              {h.durationLabel && <span>· انتظار {h.durationLabel}</span>}
            </div>
            {h.reason && <div className="mt-1 text-xs text-destructive">{h.reason}</div>}
          </div>
        </li>
      ))}
      <li className="flex gap-3 pt-1 text-xs text-muted-foreground">
        <span className="w-2 shrink-0" />
        <span>
          في «{statusLabels[currentStatus]}» منذ{" "}
          {inCurrentMs > 0 ? formatDuration(inCurrentMs) : "—"}
        </span>
      </li>
    </ol>
  );
}
