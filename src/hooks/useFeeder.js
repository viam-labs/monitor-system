import { useCallback, useEffect, useMemo, useState } from 'react';
import { GenericComponentClient } from '@viamrobotics/sdk';
import { callWithRetry } from './callWithRetry';
import { usePolling } from './usePolling';
import { handleRpcError } from '../lib/connectionHealth';

// Module caches PetSafe reads server-side for 5 min; rapid refresh
// calls return {cached: true} instead of hitting PetSafe.
export function useFeeder(client, feederName) {
  const feederClient = useMemo(() => {
    if (!client || !feederName) return null;
    return new GenericComponentClient(client, feederName);
  }, [client, feederName]);

  const [status, setStatus] = useState(null);
  const [schedules, setSchedules] = useState(null);
  const [lastFeeding, setLastFeeding] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feeding, setFeeding] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [mutating, setMutating] = useState(false);
  // Module doesn't expose schedule-pause state; track intent locally.
  const [schedulePaused, setSchedulePaused] = useState(false);
  const [lastFedAt, setLastFedAt] = useState(null);

  const refresh = useCallback(async () => {
    if (!feederClient) return;
    setError(null);
    try {
      const [statusResult, scheduleResult, lastFeedingResult] = await callWithRetry(() =>
        Promise.all([
          feederClient.doCommand({ command: 'status' }),
          feederClient.doCommand({ command: 'schedule' }),
          feederClient.doCommand({ command: 'last_feeding' }),
        ])
      );
      setStatus(statusResult);
      setSchedules(scheduleResult.schedules || []);
      setLastFeeding(lastFeedingResult.last_feeding || null);
    } catch (e) {
      if (!handleRpcError(e)) setError(e.message || String(e));
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

  usePolling(refresh, { enabled: !!feederClient });

  const feed = useCallback(
    async (cups, slow) => {
      if (!feederClient) return;
      setFeeding(true);
      setError(null);
      try {
        await feederClient.doCommand({ command: 'feed', cups, slow });
        setLastFedAt(Date.now());
      } catch (e) {
        if (!handleRpcError(e)) setError(e.message || String(e));
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
        if (!handleRpcError(e)) setError(e.message || String(e));
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
        if (!handleRpcError(e)) setError(e.message || String(e));
        throw e;
      } finally {
        setMutating(false);
      }
    },
    [feederClient, refresh]
  );

  const addSchedule = useCallback(
    (payload) => runMutation({ command: 'add_schedule', schedule: payload }),
    [runMutation]
  );

  const modifySchedule = useCallback(
    (payload) => runMutation({ command: 'modify_schedule', schedule: payload }),
    [runMutation]
  );

  const deleteSchedule = useCallback(
    (id) => runMutation({ command: 'delete_schedule', id }),
    [runMutation]
  );

  const setScheduleEnabled = useCallback(
    (id, enabled) => runMutation({ command: 'set_schedule_enabled', id, enabled }),
    [runMutation]
  );

  const setSkipNext = useCallback(
    (id, skip) => runMutation({ command: 'set_skip_next', id, skip }),
    [runMutation]
  );

  const feedNow = useCallback(async () => {
    // Seed lastFedAt locally — PetSafe + our 5-min cache lag fresh feedings.
    await runMutation({ command: 'feed_now' });
    setLastFedAt(Date.now());
  }, [runMutation]);

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
    lastFeeding,
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
    setScheduleEnabled,
    setSkipNext,
    pauseUntil,
  };
}
