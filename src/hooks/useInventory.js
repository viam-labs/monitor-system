import { useCallback, useEffect, useMemo, useState } from 'react';
import { GenericComponentClient, SensorClient } from '@viamrobotics/sdk';
import { callWithRetry } from './callWithRetry';
import { usePolling } from './usePolling';
import { handleRpcError } from '../lib/connectionHealth';

// Talks to a joseph:inventory:tracker via DoCommand for mutations, and
// reads the current item list from the paired state sensor (a
// viam:event-queue:sensor at queue_capacity: 1). Reads don't hit the
// tracker directly — the state sensor always holds the newest snapshot
// non-destructively.
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
  const scanBarcode = useCallback(
    (barcode) => runCommand({ command: 'scan_barcode', barcode }),
    [runCommand],
  );
  const reorderDeck = useCallback(
    (order, page = 0) => runCommand({ command: 'reorder_deck', page, order }),
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
    scanBarcode,
    reorderDeck,
  };
}
