import { describe, expect, it, vi } from "vitest";
import { createThrottledCallback, shouldRefetchWhileVisible } from "@/lib/throttled-callback";

describe("throttled-callback", () => {
  it("runs immediately on first call", () => {
    const fn = vi.fn();
    const throttled = createThrottledCallback(fn, 1000);
    throttled();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("coalesces rapid calls into one trailing run", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const throttled = createThrottledCallback(fn, 1000);
    throttled();
    throttled();
    throttled();
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(999);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("shouldRefetchWhileVisible is true when document is undefined (SSR)", () => {
    expect(shouldRefetchWhileVisible()).toBe(true);
  });
});
