import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SensorClient, createViamClient } from '@viamrobotics/sdk';
import Cookies from 'js-cookie';
import { callWithRetry } from './callWithRetry';
import { usePolling } from './usePolling';
import { handleRpcError } from '../lib/connectionHealth';

// viam.app.data.v1.Order.DESCENDING; enum isn't re-exported from the SDK entry.
const ORDER_DESCENDING = 1;

export function useBark(client, barkName, eventsSensorName = 'events') {
  const bark = useMemo(
    () => (client && barkName ? new SensorClient(client, barkName) : null),
    [client, barkName],
  );

  const [lastBarkAt, setLastBarkAt] = useState('');
  const [lastDogScore, setLastDogScore] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const [classScores, setClassScores] = useState({});
  const [threshold, setThreshold] = useState(0.5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [rangeHours, setRangeHours] = useState(24);
  const dataClientRef = useRef(null);

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
      const filter = {
        componentName: eventsSensorName,
        interval: { start, end },
      };
      const resp = await dc.tabularDataByFilter(filter, 5000, ORDER_DESCENDING);
      const rows = Array.isArray(resp?.data) ? resp.data : [];
      console.log('[useBark] filter:', JSON.stringify(filter), 'rows:', rows.length);
      if (rows[0]) console.log('[useBark] first row:', rows[0]);
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
    lastBarkAt, lastDogScore, sessionCount, classScores, threshold,
    loading, error, refreshLive,
    history, historyLoading, refreshHistory,
    rangeHours, setRangeHours,
  };
}
