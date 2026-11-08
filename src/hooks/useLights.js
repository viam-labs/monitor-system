import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GenericComponentClient } from '@viamrobotics/sdk';
import { callWithRetry } from './callWithRetry';
import { usePolling } from './usePolling';
import { handleRpcError } from '../lib/connectionHealth';

export function useLights(client, lightNames) {
  const namesKey = useMemo(() => (lightNames || []).join('\n'), [lightNames]);
  const names = useMemo(() => (namesKey ? namesKey.split('\n') : []), [namesKey]);

  const clientsRef = useRef({});
  const clients = useMemo(() => {
    const next = {};
    if (client) {
      for (const name of names) {
        next[name] = clientsRef.current[name] || new GenericComponentClient(client, name);
      }
    }
    clientsRef.current = next;
    return next;
  }, [client, names]);

  const [bulbs, setBulbs] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState({});

  const refreshOne = useCallback(
    async (name) => {
      const c = clients[name];
      if (!c) return;
      try {
        const s = await callWithRetry(() => c.doCommand({ command: 'status' }));
        setBulbs((prev) => ({ ...prev, [name]: { ...s, _name: name, _error: null } }));
      } catch (e) {
        if (!handleRpcError(e)) {
          setBulbs((prev) => ({
            ...prev,
            [name]: { ...(prev[name] || {}), _name: name, _error: e.message || String(e) },
          }));
        }
      }
    },
    [clients],
  );

  const refreshAll = useCallback(async () => {
    if (names.length === 0) {
      setLoading(false);
      return;
    }
    await Promise.all(names.map(refreshOne));
    setLoading(false);
  }, [names, refreshOne]);

  useEffect(() => {
    if (names.length === 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    refreshAll();
  }, [names, refreshAll]);

  usePolling(refreshAll, { enabled: names.length > 0, intervalMs: 20_000 });

  const run = useCallback(
    async (name, command) => {
      const c = clients[name];
      if (!c) return null;
      setBusy((b) => ({ ...b, [name]: true }));
      try {
        const result = await c.doCommand(command);
        await refreshOne(name);
        return result;
      } catch (e) {
        if (!handleRpcError(e)) throw e;
        return null;
      } finally {
        setBusy((b) => ({ ...b, [name]: false }));
      }
    },
    [clients, refreshOne],
  );

  const setBulb = useCallback(
    (name, patch) => run(name, { command: 'set', ...patch }),
    [run],
  );
  const addSchedule = useCallback(
    (name, schedule) => run(name, { command: 'add_schedule', schedule }),
    [run],
  );
  const modifySchedule = useCallback(
    (name, schedule) => run(name, { command: 'modify_schedule', schedule }),
    [run],
  );
  const deleteSchedule = useCallback(
    (name, id) => run(name, { command: 'delete_schedule', id }),
    [run],
  );
  const setScheduleEnabled = useCallback(
    (name, id, enabled) => run(name, { command: 'set_schedule_enabled', id, enabled }),
    [run],
  );

  return {
    bulbs,
    names,
    loading,
    busy,
    refresh: refreshAll,
    setBulb,
    addSchedule,
    modifySchedule,
    deleteSchedule,
    setScheduleEnabled,
  };
}
