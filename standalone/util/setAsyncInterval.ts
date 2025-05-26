/**
 * A utility that works like setInterval, but prevents overlapping executions
 * of the callback function. If the callback takes longer than the interval,
 * the next execution will be delayed until the current one finishes.
 */
export function setAsyncInterval(
  callback: (signal: AbortSignal) => Promise<void>,
  options: { interval: number; immediate?: boolean }, // Option to execute instantly
): () => void {
  const abortController = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const run = async () => {
    const startTime = Date.now();
    try {
      await callback(abortController.signal);
    } finally {
      if (!abortController.signal.aborted) {
        const elapsed = Date.now() - startTime;
        const delay = Math.max(options.interval - elapsed, 0);
        timer = setTimeout(run, delay);
      }
    }
  };

  if (options.immediate) {
    run();
  } else {
    timer = setTimeout(run, options.interval);
  }

  return () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
      abortController.abort();
    }
  };
}
