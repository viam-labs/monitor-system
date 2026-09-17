import { useCallback, useEffect, useMemo, useState } from 'react';
import { GenericComponentClient } from '@viamrobotics/sdk';
import { callWithRetry } from './callWithRetry';

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
  const [lastFeeding, setLastFeeding] = useState(null);
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

  const feedNow = useCallback(async () => {
    // PetSafe's server + our module's 5-minute read cache both lag a
    // fresh feeding, so seed the "Last fed at" line locally the moment
    // the button succeeds — extractLastFedTimestamp already takes the
    // max of the local timestamp and PetSafe's history.
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
    pauseUntil,
  };
}
