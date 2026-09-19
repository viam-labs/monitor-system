import { useCallback, useEffect, useMemo, useState } from 'react';
import { GenericComponentClient } from '@viamrobotics/sdk';
import { callWithRetry } from './callWithRetry';
import { usePolling } from './usePolling';
import { handleRpcError } from '../lib/connectionHealth';

export function useDoorUnlock(client, doorUnlockName) {
  const door = useMemo(
    () => (client && doorUnlockName ? new GenericComponentClient(client, doorUnlockName) : null),
    [client, doorUnlockName]
  );

  const [lastOpenedAt, setLastOpenedAt] = useState(null);
  const [battery, setBattery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const applyStatus = useCallback((status) => {
    if (!status || typeof status !== 'object') return;
    if (typeof status.last_clicked_at === 'string') setLastOpenedAt(status.last_clicked_at);
    if (typeof status.battery === 'number') setBattery(status.battery);
  }, []);

  const refresh = useCallback(async () => {
    if (!door) return;
    setError(null);
    try {
      const s = await callWithRetry(() => door.doCommand({ command: 'status' }));
      applyStatus(s);
    } catch (e) {
      if (!handleRpcError(e)) setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [door, applyStatus]);

  useEffect(() => {
    if (!door) {
      setLoading(false);
      return;
    }
    setLoading(true);
    refresh();
  }, [door, refresh]);

  usePolling(refresh, { enabled: !!door });

  const unlock = useCallback(async () => {
    if (!door) return;
    setBusy(true);
    setError(null);
    try {
      const res = await door.doCommand({ command: 'click' });
      if (res && typeof res.last_clicked_at === 'string') {
        setLastOpenedAt(res.last_clicked_at);
      } else {
        setLastOpenedAt(new Date().toISOString());
      }
    } catch (e) {
      if (!handleRpcError(e)) setError(e.message || String(e));
      throw e;
    } finally {
      setBusy(false);
    }
  }, [door]);

  return { lastOpenedAt, battery, loading, error, busy, refresh, unlock };
}
