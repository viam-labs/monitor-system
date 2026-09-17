import { useEffect } from 'react';

// Fires `fn` every `intervalMs` while the tab is visible. When the
// tab becomes visible after being hidden, fires once immediately so
// stale data catches up without waiting a full interval. Skips ticks
// while `fn` is still resolving from the previous call.
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
        // Swallow — background polling errors are reported via
        // connectionHealth; no need to explode here.
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
