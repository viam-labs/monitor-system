import { useCallback, useEffect, useMemo, useState } from 'react';
import { SensorClient } from '@viamrobotics/sdk';
import { callWithRetry } from './callWithRetry';
import { usePolling } from './usePolling';
import { handleRpcError } from '../lib/connectionHealth';
import { ORG_ID, getLocationId, queryTabular } from '../lib/viamCloud';

function buildBarkPipeline() {
  return [
    { $match: {
      organization_id: ORG_ID,
      location_id: getLocationId(),
      component_name: 'events',
      'data.readings.event_type': 'bark_detected',
      'data.readings.source': 'bark',
    } },
    { $sort: { time_received: -1 } },
    { $limit: 1000 },
    { $project: {
      _id: 0,
      at: '$data.readings.at',
      score: '$data.readings.score',
      top_class: '$data.readings.top_class',
      class_scores: '$data.readings.class_scores',
    } },
  ];
}

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
  const [historyError, setHistoryError] = useState(null);
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
    setHistoryError(null);
    try {
      const rows = await queryTabular(buildBarkPipeline());
      const cutoff = Date.now() - rangeHours * 60 * 60 * 1000;
      const mapped = (rows || []).map((r) => ({
        at: new Date(r.at),
        score: Number(r.score) || 0,
        topClass: String(r.top_class || ''),
        classScores: r.class_scores || {},
      }));
      const barks = mapped
        .filter((e) => !Number.isNaN(e.at.getTime()) && e.at.getTime() >= cutoff)
        .sort((a, b) => a.at - b.at);
      console.log(
        `[bark] HDS returned ${rows?.length ?? 0} rows, ${barks.length} within ${rangeHours}h cutoff`,
        rows?.[0],
      );
      setHistory(barks);
    } catch (e) {
      if (!handleRpcError(e)) {
        setHistoryError(e.message || String(e));
        console.error('bark history fetch failed:', e);
      }
    } finally {
      setHistoryLoading(false);
    }
  }, [bark, rangeHours]);

  useEffect(() => { refreshHistory(); }, [refreshHistory]);

  return {
    lastBarkAt, lastDogScore, sessionCount, classScores, threshold,
    loading, error, refreshLive,
    history, historyLoading, historyError, refreshHistory,
    rangeHours, setRangeHours,
  };
}
