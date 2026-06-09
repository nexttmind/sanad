/** Admin daily intake batches — 50 requests per Beirut calendar day (FIFO by queue_number). */

export const DAILY_BATCH_SIZE = 50;

export function beirutTodayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Beirut" }).format(new Date());
}

export function batchOffset(batchNumber: number): number {
  return Math.max(0, batchNumber - 1) * DAILY_BATCH_SIZE;
}

export function totalBatches(totalCount: number, batchSize = DAILY_BATCH_SIZE): number {
  if (totalCount <= 0) return 1;
  return Math.ceil(totalCount / batchSize);
}

export function batchRangeLabel(
  batchNumber: number,
  totalCount: number,
  batchSize = DAILY_BATCH_SIZE,
): string {
  if (totalCount <= 0) return "—";
  const start = (batchNumber - 1) * batchSize + 1;
  const end = Math.min(batchNumber * batchSize, totalCount);
  return `#${start}–${end}`;
}
