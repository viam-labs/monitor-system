import { useCallback, useEffect, useMemo, useState } from 'react';
import { GenericComponentClient } from '@viamrobotics/sdk';

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
  // Module doesn't expose schedule-pause state yet, so we track the
  // user's last-known intent locally. Reload = unknown until we can
  // query it.
  const [schedulePaused, setSchedulePaused] = useState(false);
  const [lastFedAt, setLastFedAt] = useState(null);

  const refresh = useCallback(async () => {
    if (!feederClient) return;
    setError(null);
    try {
      const [statusResult, scheduleResult] = await Promise.all([
        feederClient.doCommand({ command: 'status' }),
        feederClient.doCommand({ command: 'schedule' }),
      ]);
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

  return {
    status,
    schedules,
    loading,
    error,
    feeding,
    pausing,
    schedulePaused,
    lastFedAt,
    feed,
    refresh,
    pauseSchedule,
  };
}
