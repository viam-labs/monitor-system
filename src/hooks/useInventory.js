import { useCallback, useEffect, useMemo, useState } from 'react';
import { GenericComponentClient, SensorClient } from '@viamrobotics/sdk';
import { callWithRetry } from './callWithRetry';
import { usePolling } from './usePolling';
import { handleRpcError } from '../lib/connectionHealth';
import { ORG_ID, getLocationId, queryHotTabular } from '../lib/viamCloud';

function buildButtonPipeline() {
  return [
    { $match: {
      organization_id: ORG_ID,
      location_id: getLocationId(),
      component_name: 'events',
      'data.readings.event_type': 'button_pressed',
    } },
    { $sort: { time_received: -1 } },
    { $limit: 100 },
    { $project: {
      _id: 0,
      at: '$data.readings.at',
      source: '$data.readings.source',
      action: '$data.readings.action',
    } },
  ];
}

// Reads go through the state sensor (queue_capacity:1 holds the newest
// snapshot non-destructively). Mutations go through the tracker directly.
export function useInventory(client, trackerName, stateSensorName) {
  const tracker = useMemo(
    () => (client && trackerName ? new GenericComponentClient(client, trackerName) : null),
    [client, trackerName],
  );
  const stateSensor = useMemo(
    () => (client && stateSensorName ? new SensorClient(client, stateSensorName) : null),
    [client, stateSensorName],
  );

  const [items, setItems] = useState([]);
  const [snapshotAt, setSnapshotAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [buttonHistory, setButtonHistory] = useState([]);

  const applySnapshot = useCallback((readings) => {
    if (!readings || typeof readings !== 'object') return;
    if (readings.kind === 'inventory_snapshot' && Array.isArray(readings.items)) {
      setItems(readings.items);
      setSnapshotAt(readings.at || null);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!stateSensor) return;
    setError(null);
    try {
      const r = await callWithRetry(() => stateSensor.getReadings());
      applySnapshot(r);
    } catch (e) {
      if (!handleRpcError(e)) setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [stateSensor, applySnapshot]);

  useEffect(() => {
    if (!stateSensor) {
      setLoading(false);
      return;
    }
    setLoading(true);
    refresh();
  }, [stateSensor, refresh]);

  usePolling(refresh, { enabled: !!stateSensor });

  const refreshButtonHistory = useCallback(async () => {
    try {
      const rows = await queryHotTabular(buildButtonPipeline());
      const entries = (rows || []).map((r) => ({
        at: String(r.at || ''),
        source: String(r.source || ''),
        action: String(r.action || ''),
      }));
      setButtonHistory(entries);
    } catch {
      setButtonHistory([]);
    }
  }, []);

  useEffect(() => { refreshButtonHistory(); }, [refreshButtonHistory]);

  const runCommand = useCallback(
    async (command) => {
      if (!tracker) return undefined;
      setBusy(true);
      setError(null);
      try {
        const result = await tracker.doCommand(command);
        await refresh();
        return result;
      } catch (e) {
        if (!handleRpcError(e)) setError(e.message || String(e));
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [tracker, refresh],
  );

  const addItem = useCallback(
    (item) => runCommand({ command: 'add_item', item }),
    [runCommand],
  );
  const editItem = useCallback(
    (item) => runCommand({ command: 'edit_item', item }),
    [runCommand],
  );
  const deleteItem = useCallback(
    (id) => runCommand({ command: 'delete_item', id }),
    [runCommand],
  );
  const increment = useCallback(
    (id, by = 1) => runCommand({ command: 'increment', id, by }),
    [runCommand],
  );
  const decrement = useCallback(
    (id, by = 1) => runCommand({ command: 'decrement', id, by }),
    [runCommand],
  );
  const setQuantity = useCallback(
    (id, quantity) => runCommand({ command: 'set_quantity', id, quantity }),
    [runCommand],
  );
  const reorderDeck = useCallback(
    (order, device = 'kitchen') => runCommand({ command: 'reorder_deck', device, order }),
    [runCommand],
  );
  const setRoutine = useCallback(
    (id, routine) => runCommand({ command: 'set_routine', id, routine }),
    [runCommand],
  );
  const clearRoutine = useCallback(
    (id) => runCommand({ command: 'clear_routine', id }),
    [runCommand],
  );
  const markRoutineDone = useCallback(
    (id) => runCommand({ command: 'mark_routine_done', id }),
    [runCommand],
  );

  return {
    items,
    snapshotAt,
    loading,
    error,
    busy,
    refresh,
    addItem,
    editItem,
    deleteItem,
    increment,
    decrement,
    setQuantity,
    reorderDeck,
    setRoutine,
    clearRoutine,
    markRoutineDone,
    buttonHistory,
    refreshButtonHistory,
  };
}
