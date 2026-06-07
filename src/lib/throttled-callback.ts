/**
 * Returns a function that runs at most once per `waitMs`, trailing the last call.
 */
export function createThrottledCallback(fn: () => void, waitMs: number): () => void {
  let lastRun = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  return () => {
    const run = () => {
      lastRun = Date.now();
      fn();
    };

    const now = Date.now();
    const elapsed = now - lastRun;

    if (elapsed >= waitMs) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      run();
      return;
    }

    if (timer) return;

    timer = setTimeout(() => {
      timer = null;
      run();
    }, waitMs - elapsed);
  };
}

/** Skip background refetch when the tab is hidden. */
export function shouldRefetchWhileVisible(): boolean {
  return typeof document === "undefined" || document.visibilityState !== "hidden";
}
