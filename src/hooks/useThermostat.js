import { useCallback, useEffect, useMemo, useState } from 'react';
import { SensorClient, SwitchClient } from '@viamrobotics/sdk';
import { callWithRetry } from './callWithRetry';

// Reads the room meter and controls the A/C bot. All state (current
// position, last set time, direction) lives server-side on the Pi —
// the Bot component persists it via its `state` do_command. The
// frontend just displays whatever the server returns, so multiple
// devices stay in sync.
export function useThermostat(client, botName, meterName) {
  const bot = useMemo(
    () => (client && botName ? new SwitchClient(client, botName) : null),
    [client, botName]
  );
  const meter = useMemo(
    () => (client && meterName ? new SensorClient(client, meterName) : null),
    [client, meterName]
  );

  const [position, setPosition] = useState(null);
  const [lastSetAt, setLastSetAt] = useState(null);
  const [lastSetPosition, setLastSetPosition] = useState(null);
  const [readings, setReadings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const applyState = useCallback((state) => {
    if (!state || typeof state !== 'object') return;
    if (state.position === 0 || state.position === 1) setPosition(state.position);
    if (state.last_set_at) setLastSetAt(state.last_set_at);
    if (state.last_set_position === 0 || state.last_set_position === 1) {
      setLastSetPosition(state.last_set_position);
    }
  }, []);

  useEffect(() => {
    if (!bot || !meter) {
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;

    (async () => {
      try {
        const [state, read] = await callWithRetry(() =>
          Promise.all([
            bot.doCommand({ command: 'state' }),
            meter.getReadings(),
          ])
        );
        if (cancelled) return;
        applyState(state);
        setReadings(read || null);
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bot, meter, applyState]);

  const refresh = useCallback(async () => {
    if (!bot || !meter) return;
    setError(null);
    try {
      const [state, read] = await callWithRetry(() =>
        Promise.all([
          bot.doCommand({ command: 'state' }),
          meter.getReadings(),
        ])
      );
      applyState(state);
      setReadings(read || null);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [bot, meter, applyState]);

  const setAcOn = useCallback(
    async (on) => {
      if (!bot) return;
      const target = on ? 1 : 0;
      const previous = position;
      setPosition(target);
      setBusy(true);
      setError(null);
      try {
        await bot.setPosition(target);
        // Server now has fresh state — pull it back so lastSetAt is
        // authoritative.
        try {
          const state = await bot.doCommand({ command: 'state' });
          applyState(state);
        } catch {
          // Non-fatal — position is already optimistically set.
        }
      } catch (e) {
        setPosition(previous);
        setError(e.message || String(e));
      } finally {
        setBusy(false);
      }
    },
    [bot, position, applyState]
  );

  return {
    position,
    lastSetAt,
    lastSetPosition,
    readings,
    loading,
    error,
    busy,
    refresh,
    setAcOn,
  };
}
