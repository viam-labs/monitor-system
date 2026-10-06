import { useCallback, useEffect, useMemo, useState } from 'react';
import { GenericComponentClient, SensorClient } from '@viamrobotics/sdk';
import { callWithRetry } from './callWithRetry';
import { usePolling } from './usePolling';
import { handleRpcError } from '../lib/connectionHealth';
import { ORG_ID, getLocationId, queryTabular } from '../lib/viamCloud';

function buildButtonPipeline() {
  return [
    { $match: {
      organization_id: ORG_ID,
      location_id: getLocationId(),
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

export function useAllInventories(client, trackerSpecs) {
  const specsKey = useMemo(
    () => trackerSpecs
      .filter((s) => s?.name && s?.stateSensorName)
      .map((s) => `${s.name}|${s.stateSensorName}`)
      .sort()
      .join(','),
    [trackerSpecs],
  );

  const clients = useMemo(() => {
    const out = new Map();
    if (!client) return out;
    for (const spec of trackerSpecs) {
      if (!spec?.name || !spec?.stateSensorName) continue;
      out.set(spec.name, {
        tracker: new GenericComponentClient(client, spec.name),
        stateSensor: new SensorClient(client, spec.stateSensorName),
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, specsKey]);

  const [state, setState] = useState({});
  const [buttonHistory, setButtonHistory] = useState([]);

  const refreshOne = useCallback(async (name) => {
    const c = clients.get(name);
    if (!c) return;
    try {
      const r = await callWithRetry(() => c.stateSensor.getReadings());
      if (r?.kind === 'inventory_snapshot' && Array.isArray(r.items)) {
        setState((s) => ({
          ...s,
          [name]: {
            ...(s[name] || {}),
            items: r.items,
            snapshotAt: r.at || null,
            loading: false,
            error: null,
          },
        }));
      } else {
        setState((s) => ({ ...s, [name]: { ...(s[name] || {}), loading: false } }));
      }
    } catch (e) {
      if (!handleRpcError(e)) {
        setState((s) => ({
          ...s,
          [name]: { ...(s[name] || {}), error: e.message || String(e), loading: false },
        }));
      }
    }
  }, [clients]);

  useEffect(() => {
    if (clients.size === 0) return undefined;
    for (const name of clients.keys()) {
      setState((s) => ({ ...s, [name]: { ...(s[name] || {}), loading: true } }));
    }
    const run = () => { for (const name of clients.keys()) refreshOne(name); };
    run();
    return undefined;
  }, [clients, refreshOne]);

  const refreshAll = useCallback(() => {
    for (const name of clients.keys()) refreshOne(name);
  }, [clients, refreshOne]);

  usePolling(refreshAll, { enabled: clients.size > 0 });

  const refreshButtonHistory = useCallback(async () => {
    try {
      const rows = await queryTabular(buildButtonPipeline());
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

  const items = useMemo(() => {
    const out = [];
    for (const [name, s] of Object.entries(state)) {
      for (const item of (s?.items || [])) out.push({ ...item, _tracker: name });
    }
    return out;
  }, [state]);

  const trackerByItemId = useMemo(() => {
    const map = new Map();
    for (const item of items) map.set(item.id, item._tracker);
    return map;
  }, [items]);

  const trackerNames = useMemo(() => Array.from(clients.keys()), [clients]);

  const trackerDevices = useMemo(() => {
    const map = new Map();
    for (const spec of trackerSpecs) {
      if (!spec?.name) continue;
      map.set(spec.name, Array.isArray(spec.devices) ? spec.devices : []);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specsKey]);

  const deviceToTracker = useMemo(() => {
    const map = new Map();
    for (const [trackerName, devices] of trackerDevices) {
      for (const d of devices) {
        if (d?.name && !map.has(d.name)) map.set(d.name, trackerName);
      }
    }
    return map;
  }, [trackerDevices]);

  const deviceReservedSlots = useMemo(() => {
    const map = new Map();
    for (const devices of trackerDevices.values()) {
      for (const d of devices) {
        if (!d?.name || !d.reserved_slots) continue;
        const parsed = {};
        for (const [k, v] of Object.entries(d.reserved_slots)) {
          const n = Number(k);
          if (Number.isInteger(n) && n >= 0) parsed[n] = String(v);
        }
        map.set(d.name, parsed);
      }
    }
    return map;
  }, [trackerDevices]);

  const declaredDevices = useMemo(() => {
    const out = [];
    for (const [trackerName, devices] of trackerDevices) {
      for (const d of devices) {
        if (d?.name) out.push({ ...d, _tracker: trackerName });
      }
    }
    return out;
  }, [trackerDevices]);

  const runCommand = useCallback(async (name, command) => {
    const c = clients.get(name);
    if (!c) return undefined;
    setState((s) => ({ ...s, [name]: { ...(s[name] || {}), busy: true, error: null } }));
    try {
      const result = await c.tracker.doCommand(command);
      await refreshOne(name);
      return result;
    } catch (e) {
      if (!handleRpcError(e)) {
        setState((s) => ({ ...s, [name]: { ...(s[name] || {}), error: e.message || String(e) } }));
      }
      throw e;
    } finally {
      setState((s) => ({ ...s, [name]: { ...(s[name] || {}), busy: false } }));
    }
  }, [clients, refreshOne]);

  const trackerFor = useCallback((id) => trackerByItemId.get(id), [trackerByItemId]);

  const addItem = useCallback(
    (trackerName, item) => runCommand(trackerName, { command: 'add_item', item }),
    [runCommand],
  );
  const editItem = useCallback(
    (item) => {
      const t = trackerFor(item.id);
      if (!t) return undefined;
      return runCommand(t, { command: 'edit_item', item });
    },
    [runCommand, trackerFor],
  );
  const deleteItem = useCallback(
    (id) => {
      const t = trackerFor(id);
      if (!t) return undefined;
      return runCommand(t, { command: 'delete_item', id });
    },
    [runCommand, trackerFor],
  );
  const increment = useCallback(
    (id, by = 1) => {
      const t = trackerFor(id);
      if (!t) return undefined;
      return runCommand(t, { command: 'increment', id, by });
    },
    [runCommand, trackerFor],
  );
  const decrement = useCallback(
    (id, by = 1) => {
      const t = trackerFor(id);
      if (!t) return undefined;
      return runCommand(t, { command: 'decrement', id, by });
    },
    [runCommand, trackerFor],
  );
  const setQuantity = useCallback(
    (id, quantity) => {
      const t = trackerFor(id);
      if (!t) return undefined;
      return runCommand(t, { command: 'set_quantity', id, quantity });
    },
    [runCommand, trackerFor],
  );
  const reorderDeck = useCallback(
    (trackerName, order, device) => runCommand(trackerName, { command: 'reorder_deck', device, order }),
    [runCommand],
  );
  const setRoutine = useCallback(
    (id, routine) => {
      const t = trackerFor(id);
      if (!t) return undefined;
      return runCommand(t, { command: 'set_routine', id, routine });
    },
    [runCommand, trackerFor],
  );
  const clearRoutine = useCallback(
    (id) => {
      const t = trackerFor(id);
      if (!t) return undefined;
      return runCommand(t, { command: 'clear_routine', id });
    },
    [runCommand, trackerFor],
  );
  const markRoutineDone = useCallback(
    (id) => {
      const t = trackerFor(id);
      if (!t) return undefined;
      return runCommand(t, { command: 'mark_routine_done', id });
    },
    [runCommand, trackerFor],
  );

  const loading = clients.size > 0
    && Array.from(clients.keys()).some((n) => state[n]?.loading !== false);
  const busy = Object.values(state).some((s) => s?.busy);
  const error = Object.values(state).find((s) => s?.error)?.error || null;

  return {
    items,
    trackerNames,
    trackerDevices,
    deviceToTracker,
    deviceReservedSlots,
    declaredDevices,
    byTracker: state,
    loading,
    busy,
    error,
    refresh: refreshAll,
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
