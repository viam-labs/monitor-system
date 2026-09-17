import { useCallback, useEffect, useMemo, useState } from 'react';
import { GenericComponentClient } from '@viamrobotics/sdk';
import { callWithRetry } from './callWithRetry';
import { usePolling } from './usePolling';
import { handleRpcError } from '../lib/connectionHealth';

// Talks to a viam:switchbot:curtain generic component's do_command.
// Position is 0-100 where 0 = fully open, 100 = fully closed
// (matches SwitchBot's slidePosition semantics).
export function useCurtain(client, curtainName) {
  const curtain = useMemo(
    () => (client && curtainName ? new GenericComponentClient(client, curtainName) : null),
    [client, curtainName]
  );

  const [position, setPosition] = useState(null);
  const [battery, setBattery] = useState(null);
  const [moving, setMoving] = useState(false);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const applyStatus = useCallback((status) => {
    if (!status || typeof status !== 'object') return;
    if (typeof status.slide_position === 'number') setPosition(status.slide_position);
    if (typeof status.battery === 'number') setBattery(status.battery);
    if (typeof status.moving === 'boolean') setMoving(status.moving);
    if (Array.isArray(status.schedules)) setSchedules(status.schedules);
  }, []);

  const refresh = useCallback(async () => {
    if (!curtain) return;
    setError(null);
    try {
      const s = await callWithRetry(() => curtain.doCommand({ command: 'status' }));
      applyStatus(s);
    } catch (e) {
      if (!handleRpcError(e)) setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [curtain, applyStatus]);

  useEffect(() => {
    if (!curtain) {
      setLoading(false);
      return;
    }
    setLoading(true);
    refresh();
  }, [curtain, refresh]);

  usePolling(refresh, { enabled: !!curtain });

  const runCommand = useCallback(
    async (command) => {
      if (!curtain) return;
      setBusy(true);
      setError(null);
      try {
        await curtain.doCommand(command);
        await refresh();
      } catch (e) {
        if (!handleRpcError(e)) setError(e.message || String(e));
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [curtain, refresh]
  );

  const open = useCallback(() => runCommand({ command: 'open' }), [runCommand]);
  const close = useCallback(() => runCommand({ command: 'close' }), [runCommand]);
  const pause = useCallback(() => runCommand({ command: 'pause' }), [runCommand]);
  const setSlidePosition = useCallback(
    (p) => runCommand({ command: 'set_position', position: Math.max(0, Math.min(100, Math.round(p))) }),
    [runCommand]
  );

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
    position,
    battery,
    moving,
    schedules,
    loading,
    error,
    busy,
    refresh,
    open,
    close,
    pause,
    setSlidePosition,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    setScheduleEnabled,
    reorderSchedules,
  };
}
