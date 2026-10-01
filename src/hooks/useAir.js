import { useCallback, useEffect, useMemo, useState } from 'react';
import { SensorClient } from '@viamrobotics/sdk';
import { callWithRetry } from './callWithRetry';
import { usePolling } from './usePolling';
import { handleRpcError } from '../lib/connectionHealth';
import { getViamCloudClient, ORG_ID } from '../lib/viamCloud';

const HISTORY_SQL = `SELECT
  data.readings.co2_ppm AS co2_ppm,
  data.readings.temperature_c AS temperature_c,
  data.readings.relative_humidity AS relative_humidity,
  time_received AS at
FROM readings
WHERE component_name = 'co2'
  AND method_name = 'Readings'
ORDER BY time_received DESC
LIMIT 2000`;

export function useAir(client, airName) {
  const sensor = useMemo(
    () => (client && airName ? new SensorClient(client, airName) : null),
    [client, airName],
  );

  const [co2Ppm, setCo2Ppm] = useState(null);
  const [temperatureC, setTemperatureC] = useState(null);
  const [relativeHumidity, setRelativeHumidity] = useState(null);
  const [lastReadAt, setLastReadAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [rangeHours, setRangeHours] = useState(24);

  const refreshLive = useCallback(async () => {
    if (!sensor) return;
    setError(null);
    try {
      const r = await callWithRetry(() => sensor.getReadings());
      if (r && typeof r === 'object') {
        if (typeof r.co2_ppm === 'number') setCo2Ppm(r.co2_ppm);
        if (typeof r.temperature_c === 'number') setTemperatureC(r.temperature_c);
        if (typeof r.relative_humidity === 'number') setRelativeHumidity(r.relative_humidity);
        setLastReadAt(Date.now());
      }
    } catch (e) {
      if (!handleRpcError(e)) setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [sensor]);

  useEffect(() => {
    if (!sensor) { setLoading(false); return; }
    setLoading(true);
    refreshLive();
  }, [sensor, refreshLive]);

  usePolling(refreshLive, { enabled: !!sensor });

  const refreshHistory = useCallback(async () => {
    if (!sensor) return;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const vc = await getViamCloudClient();
      const rows = await vc.dataClient.tabularDataBySQL(ORG_ID, HISTORY_SQL);
      const cutoff = Date.now() - rangeHours * 60 * 60 * 1000;
      const parsed = (rows || [])
        .map((r) => {
          const atRaw = r.at;
          let atMs;
          if (atRaw && typeof atRaw === 'object' && atRaw.$date) {
            atMs = Date.parse(atRaw.$date);
          } else {
            atMs = Date.parse(String(atRaw));
          }
          return {
            at: new Date(atMs),
            co2: Number(r.co2_ppm) || 0,
            temperatureC: Number(r.temperature_c) || 0,
            humidity: Number(r.relative_humidity) || 0,
          };
        })
        .filter((e) => !Number.isNaN(e.at.getTime()) && e.at.getTime() >= cutoff)
        .sort((a, b) => a.at - b.at);
      setHistory(parsed);
    } catch (e) {
      if (!handleRpcError(e)) {
        setHistoryError(e.message || String(e));
        console.error('air history fetch failed:', e);
      }
    } finally {
      setHistoryLoading(false);
    }
  }, [sensor, rangeHours]);

  useEffect(() => { refreshHistory(); }, [refreshHistory]);

  return {
    co2Ppm, temperatureC, relativeHumidity, lastReadAt,
    loading, error, refreshLive,
    history, historyLoading, historyError, refreshHistory,
    rangeHours, setRangeHours,
  };
}
