import { useCallback, useEffect, useMemo, useState } from 'react';
import { SensorClient, SwitchClient } from '@viamrobotics/sdk';
import { callWithRetry } from './callWithRetry';

// Reads the room meter and controls the A/C bot. Position 1 = the last
// command we sent was turnOn; 0 = turnOff. This is the *commanded*
// state — the Bot only knows what it last pressed, not whether the
// A/C is actually running.
//
// SwitchBot bots in "Press mode" don't hold a persistent position:
// get_position may report a stale or default value regardless of what
// the user last commanded. Persist our commanded state locally so a
// refresh shows the right thing.
function storageKey(botName) {
  return botName ? `thermostat:${botName}:position` : null;
}

function readStoredPosition(key) {
  if (!key) return null;
  try {
    const v = localStorage.getItem(key);
    if (v === '0') return 0;
    if (v === '1') return 1;
  } catch {
    // Storage unavailable (Safari private, etc.) — fall through.
  }
  return null;
}

function writeStoredPosition(key, pos) {
  if (!key) return;
  try {
    localStorage.setItem(key, String(pos));
  } catch {
    // Ignore quota / disabled storage errors.
  }
}

export function useThermostat(client, botName, meterName) {
  const bot = useMemo(
    () => (client && botName ? new SwitchClient(client, botName) : null),
    [client, botName]
  );
  const meter = useMemo(
    () => (client && meterName ? new SensorClient(client, meterName) : null),
    [client, meterName]
  );

  const key = storageKey(botName);
  const [position, setPosition] = useState(() => readStoredPosition(key));
  const [readings, setReadings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [lastActionAt, setLastActionAt] = useState(null);

  useEffect(() => {
    if (!bot || !meter) {
      setLoading(false);
      return;
    }
    setLoading(true);
    // Only seed position from the Bot's API on very first load (when
    // localStorage is empty). After that, treat local storage + our
    // own set_position calls as ground truth so a refresh doesn't
    // clobber the commanded state with a bogus 0 from a Press-mode
    // Bot that doesn't actually track state.
    const shouldSeedPosition = readStoredPosition(key) == null;
    let cancelled = false;

    (async () => {
      try {
        const tasks = [meter.getReadings()];
        if (shouldSeedPosition) tasks.push(bot.getPosition());
        const results = await callWithRetry(() => Promise.all(tasks));
        if (cancelled) return;
        setReadings(results[0] || null);
        if (shouldSeedPosition && results[1] != null) {
          const pos = Number(results[1]);
          if (pos === 0 || pos === 1) {
            setPosition(pos);
            writeStoredPosition(key, pos);
          }
        }
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bot, meter, key]);

  const refresh = useCallback(async () => {
    if (!meter) return;
    setError(null);
    try {
      const read = await callWithRetry(() => meter.getReadings());
      setReadings(read || null);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [meter]);

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
        writeStoredPosition(key, target);
        setLastActionAt(Date.now());
      } catch (e) {
        setPosition(previous);
        setError(e.message || String(e));
      } finally {
        setBusy(false);
      }
    },
    [bot, position, key]
  );

  return { position, readings, loading, error, busy, lastActionAt, refresh, setAcOn };
}
