import { useCallback, useEffect, useMemo, useState } from 'react';
import { GenericComponentClient } from '@viamrobotics/sdk';
import { callWithRetry } from './callWithRetry';
import { usePolling } from './usePolling';
import { handleRpcError } from '../lib/connectionHealth';

// Talks to a viam:waterer:pump generic component's do_command.
export function useWaterer(client, watererName) {
  const waterer = useMemo(
    () => (client && watererName ? new GenericComponentClient(client, watererName) : null),
    [client, watererName]
  );

  const [mlPerSecond, setMlPerSecond] = useState(null);
  const [maxRuntimeSeconds, setMaxRuntimeSeconds] = useState(null);
  const [maxDailyMl, setMaxDailyMl] = useState(null);
  const [dailyTotal, setDailyTotal] = useState(null);
  const [lastDispense, setLastDispense] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const applyStatus = useCallback((status) => {
    if (!status || typeof status !== 'object') return;
    if (typeof status.ml_per_second === 'number') setMlPerSecond(status.ml_per_second);
    if (typeof status.max_runtime_seconds === 'number') setMaxRuntimeSeconds(status.max_runtime_seconds);
    if (typeof status.max_daily_ml === 'number') setMaxDailyMl(status.max_daily_ml);
    if (status.daily_total && typeof status.daily_total === 'object') setDailyTotal(status.daily_total);
    setLastDispense(status.last_dispense || null);
    if (Array.isArray(status.schedules)) setSchedules(status.schedules);
  }, []);

  const refresh = useCallback(async () => {
    if (!waterer) return;
    setError(null);
    try {
      const s = await callWithRetry(() => waterer.doCommand({ command: 'status' }));
      applyStatus(s);
    } catch (e) {
      if (!handleRpcError(e)) setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [waterer, applyStatus]);

  useEffect(() => {
    if (!waterer) {
      setLoading(false);
      return;
    }
    setLoading(true);
    refresh();
  }, [waterer, refresh]);

  usePolling(refresh, { enabled: !!waterer });

  const runCommand = useCallback(
    async (command) => {
      if (!waterer) return;
      setBusy(true);
      setError(null);
      try {
        const result = await waterer.doCommand(command);
        await refresh();
        return result;
      } catch (e) {
        if (!handleRpcError(e)) setError(e.message || String(e));
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [waterer, refresh]
  );

  const dispenseMl = useCallback(
    (ml) => runCommand({ command: 'dispense_ml', ml }),
    [runCommand]
  );
  const dispenseSeconds = useCallback(
    (seconds) => runCommand({ command: 'dispense_seconds', seconds }),
    [runCommand]
  );
  const stop = useCallback(() => runCommand({ command: 'stop' }), [runCommand]);

  const addSchedule = useCallback(
    (schedule) => runCommand({ command: 'add_schedule', schedule }),
    [runCommand]
  );
  const updateSchedule = useCallback(
    (schedule) => runCommand({ command: 'update_schedule', schedule }),
    [runCommand]
  );
  const deleteSchedule = useCallback(
    (id) => runCommand({ command: 'delete_schedule', id }),
    [runCommand]
  );
  const setScheduleEnabled = useCallback(
    (id, enabled) => runCommand({ command: 'set_schedule_enabled', id, enabled }),
    [runCommand]
  );
  const reorderSchedules = useCallback(
    (ids) => runCommand({ command: 'reorder_schedules', ids }),
    [runCommand]
  );

  return {
    mlPerSecond,
    maxRuntimeSeconds,
    maxDailyMl,
    dailyTotal,
    lastDispense,
    schedules,
    loading,
    error,
    busy,
    refresh,
    dispenseMl,
    dispenseSeconds,
    stop,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    setScheduleEnabled,
    reorderSchedules,
  };
}
