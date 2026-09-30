import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SensorClient, createViamClient } from '@viamrobotics/sdk';
import Cookies from 'js-cookie';
import { callWithRetry } from './callWithRetry';
import { usePolling } from './usePolling';
import { handleRpcError } from '../lib/connectionHealth';

// From viam.app.data.v1.Order: 1 = DESCENDING. Not re-exported from
// the SDK entry point so we use the numeric value directly.
const ORDER_DESCENDING = 1;

// Read live state from the bark_detector sensor + historical bark_detected
// events from Viam Data. The historical query uses the DataClient (cloud
// API), separate from the machine's WebRTC connection.
export function useBark(client, barkName, eventsSensorName = 'events') {
  const bark = useMemo(
    () => (client && barkName ? new SensorClient(client, barkName) : null),
    [client, barkName],
  );

  // Live state (from the sensor's Readings)
  const [lastBarkAt, setLastBarkAt] = useState('');
  const [lastDogScore, setLastDogScore] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const [classScores, setClassScores] = useState({});
  const [threshold, setThreshold] = useState(0.5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Historical events (from DataClient)
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [rangeHours, setRangeHours] = useState(24);
  const dataClientRef = useRef(null);

  // Live readings poll
  const refreshLive = useCallback(async () => {
    if (!bark) return;
    setError(null);
    try {
      const r = await callWithRetry(() => bark.getReadings());
      if (r && typeof r === 'object') {
        setLastBarkAt(String(r.last_bark_at || ''));
        setLastDogScore(Number(r.last_dog_score) || 0);
        setSessionCount(Number(r.bark_count_session) || 0);
        setThreshold(Number(r.threshold) || 0.5);
        if (r.class_scores && typeof r.class_scores === 'object') {
          setClassScores(r.class_scores);
        }
      }
    } catch (e) {
      if (!handleRpcError(e)) setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [bark]);

  useEffect(() => {
    if (!bark) { setLoading(false); return; }
    setLoading(true);
    refreshLive();
  }, [bark, refreshLive]);

  usePolling(refreshLive, { enabled: !!bark });

  // Lazy-create the ViamClient for DataClient queries. The credentials
  // come from the same cookie createRobotClient uses in
  // useMachineConnection, so no additional auth handoff.
  const ensureDataClient = useCallback(async () => {
    if (dataClientRef.current) return dataClientRef.current;
    const cookieKey = window.location.pathname.split('/')[2];
    const { apiKey: { id, key } } = JSON.parse(Cookies.get(cookieKey));
    const vc = await createViamClient({
      credentials: { type: 'api-key', payload: key, authEntity: id },
    });
    dataClientRef.current = vc.dataClient;
    return vc.dataClient;
  }, []);

  const refreshHistory = useCallback(async () => {
    if (!eventsSensorName) return;
    setHistoryLoading(true);
    try {
      const dc = await ensureDataClient();
      const end = new Date();
      const start = new Date(end.getTime() - rangeHours * 60 * 60 * 1000);
      // Filter by the events sensor's component name; further filter to
      // event_type=bark_detected client-side (the sensor captures many
      // event types on the same shape). API key scope constrains the
      // query to this user's orgs, so no organizationIds filter needed.
      const filter = {
        componentName: eventsSensorName,
        method: 'Readings',
        interval: { start, end },
      };
      // Default limit is 50 — too small if other event types (feeds,
      // thermostat toggles, waterer schedules, door opens) fill the window.
      // Newest-first so if we ever DO hit the limit, we lose the oldest.
      const resp = await dc.tabularDataByFilter(filter, 500, ORDER_DESCENDING);
      const rows = Array.isArray(resp?.data) ? resp.data : [];
      console.log('[useBark] filter used:', JSON.stringify(filter));
      console.log('[useBark] resp:', resp);
      console.log('[useBark] tabularDataByFilter rows:', rows.length, rows.slice(0, 3));

      // If the filtered query returns nothing, try a bare query so we can see
      // whether ANY tabular data is reachable with these creds (auth/scope
      // diagnosis) and inspect a real row's shape.
      if (rows.length === 0) {
        try {
          const probe = await dc.tabularDataByFilter({}, 5, ORDER_DESCENDING);
          const probeRows = Array.isArray(probe?.data) ? probe.data : [];
          console.log('[useBark] bare-query probe rows:', probeRows.length, probeRows.slice(0, 3));
        } catch (e) {
          console.log('[useBark] bare-query probe failed:', e);
        }
      }
      const barks = rows
        .map((row) => {
          const readings = row?.data?.readings || row?.data || {};
          if (readings?.event_type !== 'bark_detected') return null;
          return {
            at: new Date(row.timeReceived || row.timeRequested || readings.at),
            score: Number(readings.score) || 0,
            topClass: String(readings.top_class || ''),
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.at - b.at);
      console.log('[useBark] parsed bark events:', barks.length, barks.slice(0, 3));
      setHistory(barks);
    } catch (e) {
      if (!handleRpcError(e)) setError(e.message || String(e));
    } finally {
      setHistoryLoading(false);
    }
  }, [eventsSensorName, rangeHours, ensureDataClient]);

  useEffect(() => { refreshHistory(); }, [refreshHistory]);

  return {
    // live
    lastBarkAt, lastDogScore, sessionCount, classScores, threshold,
    loading, error, refreshLive,
    // history
    history, historyLoading, refreshHistory,
    rangeHours, setRangeHours,
  };
}
