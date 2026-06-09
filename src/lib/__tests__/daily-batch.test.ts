import { describe, expect, it } from "vitest";
import {
  batchOffset,
  batchRangeLabel,
  DAILY_BATCH_SIZE,
  totalBatches,
} from "@/lib/daily-batch";

describe("daily-batch", () => {
  it("batchOffset maps batch number to zero-based offset", () => {
    expect(batchOffset(1)).toBe(0);
    expect(batchOffset(2)).toBe(50);
    expect(batchOffset(3)).toBe(100);
  });

  it("totalBatches covers overflow on same day", () => {
    expect(totalBatches(50)).toBe(1);
    expect(totalBatches(51)).toBe(2);
    expect(totalBatches(80)).toBe(2);
    expect(totalBatches(100)).toBe(2);
    expect(totalBatches(101)).toBe(3);
  });

  it("batchRangeLabel shows FIFO slice labels", () => {
    expect(batchRangeLabel(1, 80)).toBe("#1–50");
    expect(batchRangeLabel(2, 80)).toBe("#51–80");
    expect(batchRangeLabel(2, 120)).toBe("#51–100");
  });

  it("DAILY_BATCH_SIZE stays at 50", () => {
    expect(DAILY_BATCH_SIZE).toBe(50);
  });
});
