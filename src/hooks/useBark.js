import { useCallback, useEffect, useMemo, useState } from 'react';
import { SensorClient } from '@viamrobotics/sdk';
import { callWithRetry } from './callWithRetry';
import { usePolling } from './usePolling';
import { handleRpcError } from '../lib/connectionHealth';

export function useBark(client, barkName) {
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

  const refreshHistory = useCallback(async () => {
    if (!bark) return;
    setHistoryLoading(true);
    try {
      const resp = await callWithRetry(() => bark.doCommand({ command: 'get_history' }));
      const entries = Array.isArray(resp?.history) ? resp.history : [];
      const cutoff = Date.now() - rangeHours * 60 * 60 * 1000;
      const barks = entries
        .map((e) => ({
          at: new Date(e.at),
          score: Number(e.score) || 0,
          topClass: String(e.top_class || ''),
        }))
        .filter((e) => !Number.isNaN(e.at.getTime()) && e.at.getTime() >= cutoff)
        .sort((a, b) => a.at - b.at);
      setHistory(barks);
    } catch (e) {
      if (!handleRpcError(e)) setError(e.message || String(e));
    } finally {
      setHistoryLoading(false);
    }
  }, [bark, rangeHours]);

  useEffect(() => { refreshHistory(); }, [refreshHistory]);

  return {
    lastBarkAt, lastDogScore, sessionCount, classScores, threshold,
    loading, error, refreshLive,
    history, historyLoading, refreshHistory,
    rangeHours, setRangeHours,
  };
}
