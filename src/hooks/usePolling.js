import { useEffect } from 'react';

// Pauses when tab is hidden; fires once immediately on visible-again to
// catch up. Overlapping ticks are skipped.
export function usePolling(fn, { intervalMs = 60_000, enabled = true } = {}) {
  useEffect(() => {
    if (!enabled || typeof fn !== 'function') return;
    let cancelled = false;
    let timeoutId = null;
    let inFlight = false;

    const runTick = async () => {
      if (cancelled || inFlight) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      inFlight = true;
      try {
        await fn();
      } catch {
        // Reported via connectionHealth by the wrapped call.
      } finally {
        inFlight = false;
      }
    };

    const schedule = () => {
      if (cancelled) return;
      timeoutId = setTimeout(async () => {
        await runTick();
        schedule();
      }, intervalMs);
    };

    const onVisibility = () => {
      if (cancelled) return;
      if (document.visibilityState === 'visible') {
        if (timeoutId) clearTimeout(timeoutId);
        runTick().then(schedule);
      }
    };

    schedule();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fn, intervalMs, enabled]);
}
