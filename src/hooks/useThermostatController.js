import { useCallback, useEffect, useMemo, useState } from 'react';
import { GenericComponentClient } from '@viamrobotics/sdk';
import { callWithRetry } from './callWithRetry';

// Talks to a viam:switchbot:thermostat generic component's do_command
// surface. Separate from useThermostat (which drives the Bot + Meter
// directly for manual control) — this one only touches the controller.
export function useThermostatController(client, thermostatName) {
  const controller = useMemo(
    () => (client && thermostatName ? new GenericComponentClient(client, thermostatName) : null),
    [client, thermostatName]
  );

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!controller) return;
    setError(null);
    try {
      const s = await callWithRetry(() => controller.doCommand({ command: 'status' }));
      setStatus(s || null);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [controller]);

  useEffect(() => {
    if (!controller) {
      setLoading(false);
      return;
    }
    setLoading(true);
    refresh();
  }, [controller, refresh]);

  const runMutation = useCallback(
    async (command, optimisticPatch) => {
      if (!controller) return;
      const previous = status;
      if (optimisticPatch) {
        setStatus(prev => (prev ? { ...prev, ...optimisticPatch(prev) } : prev));
      }
      setBusy(true);
      setError(null);
      try {
        await controller.doCommand(command);
        await refresh();
      } catch (e) {
        if (optimisticPatch) setStatus(previous);
        setError(e.message || String(e));
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [controller, refresh, status]
  );

  const addAutomation = useCallback(
    (automation) => runMutation({ command: 'add_automation', automation }),
    [runMutation]
  );

  const updateAutomation = useCallback(
    (automation) => runMutation({ command: 'update_automation', automation }),
    [runMutation]
  );

  const deleteAutomation = useCallback(
    (id) => runMutation({ command: 'delete_automation', id }),
    [runMutation]
  );

  const setAutomationEnabled = useCallback(
    (id, enabled) =>
      runMutation(
        { command: 'set_automation_enabled', id, enabled },
        (prev) => ({
          automations: (prev.automations || []).map(a =>
            a.id === id ? { ...a, enabled } : a
          ),
        })
      ),
    [runMutation]
  );

  const reorderAutomations = useCallback(
    (ids) =>
      runMutation(
        { command: 'reorder_automations', ids },
        (prev) => {
          const by = new Map((prev.automations || []).map(a => [a.id, a]));
          return { automations: ids.map(id => by.get(id)).filter(Boolean) };
        }
      ),
    [runMutation]
  );

  return {
    status,
    loading,
    error,
    busy,
    refresh,
    addAutomation,
    updateAutomation,
    deleteAutomation,
    setAutomationEnabled,
    reorderAutomations,
  };
}
