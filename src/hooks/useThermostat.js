import { useCallback, useEffect, useMemo, useState } from 'react';
import { SensorClient, SwitchClient } from '@viamrobotics/sdk';
import { callWithRetry } from './callWithRetry';

// Reads the room meter and controls the A/C bot. Position 1 = the last
// command we sent was turnOn; 0 = turnOff. This is the *commanded*
// state — the Bot only knows what it last pressed, not whether the
// A/C is actually running.
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
  const [readings, setReadings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [lastActionAt, setLastActionAt] = useState(null);

  const refresh = useCallback(async () => {
    if (!bot || !meter) return;
    setError(null);
    try {
      const [pos, read] = await callWithRetry(() =>
        Promise.all([bot.getPosition(), meter.getReadings()])
      );
      setPosition(Number(pos));
      setReadings(read || null);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [bot, meter]);

  useEffect(() => {
    if (!bot || !meter) {
      setLoading(false);
      return;
    }
    setLoading(true);
    refresh();
  }, [bot, meter, refresh]);

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
        setLastActionAt(Date.now());
      } catch (e) {
        setPosition(previous);
        setError(e.message || String(e));
      } finally {
        setBusy(false);
      }
    },
    [bot, position]
  );

  return { position, readings, loading, error, busy, lastActionAt, refresh, setAcOn };
}
