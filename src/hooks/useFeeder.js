import { useCallback, useEffect, useMemo, useState } from 'react';
import { GenericComponentClient } from '@viamrobotics/sdk';

// Retry reads on "not connected" errors — the underlying WebRTC data
// channel sometimes isn't fully ready on the first RPC after a fresh
// page load, especially on mobile. Only used for reads; mutations
// don't retry to avoid a double-feed / double-delete on ambiguous
// failures.
async function callWithRetry(fn, { retries = 2, delayMs = 800 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      const msg = (e?.message || String(e)).toLowerCase();
      if (!msg.includes('not connected') || attempt === retries) throw e;
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}

// Talks to the viam:petsafe:smart-feed module's Generic component via
// do_command. The module caches PetSafe reads for 5 minutes on its
// side, so refresh calls that land within that window come back
// instantly with `cached: true`.
export function useFeeder(client, feederName) {
  const feederClient = useMemo(() => {
    if (!client || !feederName) return null;
    return new GenericComponentClient(client, feederName);
  }, [client, feederName]);

  const [status, setStatus] = useState(null);
  const [schedules, setSchedules] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feeding, setFeeding] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [mutating, setMutating] = useState(false);
  // Module doesn't expose schedule-pause state yet, so we track the
  // user's last-known intent locally. Reload = unknown until we can
  // query it.
  const [schedulePaused, setSchedulePaused] = useState(false);
  const [lastFedAt, setLastFedAt] = useState(null);

  const refresh = useCallback(async () => {
    if (!feederClient) return;
    setError(null);
    try {
      const [statusResult, scheduleResult] = await callWithRetry(() =>
        Promise.all([
          feederClient.doCommand({ command: 'status' }),
          feederClient.doCommand({ command: 'schedule' }),
        ])
      );
      setStatus(statusResult);
      setSchedules(scheduleResult.schedules || []);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [feederClient]);

  useEffect(() => {
    if (!feederClient) {
      setLoading(false);
      return;
    }
    setLoading(true);
    refresh();
  }, [feederClient, refresh]);

  const feed = useCallback(
    async (cups, slow) => {
      if (!feederClient) return;
      setFeeding(true);
      setError(null);
      try {
        await feederClient.doCommand({ command: 'feed', cups, slow });
        setLastFedAt(Date.now());
      } catch (e) {
        setError(e.message || String(e));
      } finally {
        setFeeding(false);
      }
    },
    [feederClient]
  );

  const pauseSchedule = useCallback(
    async (paused) => {
      if (!feederClient) return;
      const previous = schedulePaused;
      setSchedulePaused(paused);
      setPausing(true);
      setError(null);
      try {
        await feederClient.doCommand({ command: 'pause_schedule', paused });
      } catch (e) {
        setSchedulePaused(previous);
        setError(e.message || String(e));
      } finally {
        setPausing(false);
      }
    },
    [feederClient, schedulePaused]
  );

  const runMutation = useCallback(
    async (command) => {
      if (!feederClient) return;
      setMutating(true);
      setError(null);
      try {
        await feederClient.doCommand(command);
        await refresh();
      } catch (e) {
        setError(e.message || String(e));
        throw e;
      } finally {
        setMutating(false);
      }
    },
    [feederClient, refresh]
  );

  const addSchedule = useCallback(
    (time, cups) => runMutation({ command: 'add_schedule', time, cups }),
    [runMutation]
  );

  const modifySchedule = useCallback(
    (id, time, cups) => runMutation({ command: 'modify_schedule', id, time, cups }),
    [runMutation]
  );

  const deleteSchedule = useCallback(
    (id) => runMutation({ command: 'delete_schedule', id }),
    [runMutation]
  );

  const feedNow = useCallback(
    () => runMutation({ command: 'feed_now' }),
    [runMutation]
  );

  const delayNext = useCallback(
    (hours) => runMutation({ command: 'delay_next', hours }),
    [runMutation]
  );

  const skipNext = useCallback(
    () => runMutation({ command: 'skip_next' }),
    [runMutation]
  );

  const pauseUntil = useCallback(
    (until) => runMutation({ command: 'pause_until', until }),
    [runMutation]
  );

  return {
    status,
    schedules,
    loading,
    error,
    feeding,
    pausing,
    mutating,
    schedulePaused,
    lastFedAt,
    feed,
    refresh,
    pauseSchedule,
    addSchedule,
    modifySchedule,
    deleteSchedule,
    feedNow,
    delayNext,
    skipNext,
    pauseUntil,
  };
}
