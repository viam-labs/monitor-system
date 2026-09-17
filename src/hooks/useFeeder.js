import { useCallback, useEffect, useMemo, useState } from 'react';
import { GenericComponentClient } from '@viamrobotics/sdk';

// Talks to the viam:petsafe:smart-feed module's Generic component via
// do_command. The module caches PetSafe reads for 5 minutes on its
// side, so refresh calls that land within that window come back
// instantly with `cached: true`.
export function useFeeder(client, feederName) {
  const feederClient = useMemo(() => {
    if (!client || !feederName) return null;
    return new GenericComponentClient(client, feederName);
  }, [client, feederName]);

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feeding, setFeeding] = useState(false);
  const [lastFedAt, setLastFedAt] = useState(null);

  const refresh = useCallback(async () => {
    if (!feederClient) return;
    setError(null);
    try {
      const result = await feederClient.doCommand({ command: 'status' });
      setStatus(result);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [feederClient]);

  useEffect(() => {
    if (!feederClient) {
      setLoading(false);
      return;
    }
    setLoading(true);
    refresh();
  }, [feederClient, refresh]);

  const feed = useCallback(
    async (cups, slow) => {
      if (!feederClient) return;
      setFeeding(true);
      setError(null);
      try {
        await feederClient.doCommand({ command: 'feed', cups, slow });
        setLastFedAt(Date.now());
      } catch (e) {
        setError(e.message || String(e));
      } finally {
        setFeeding(false);
      }
    },
    [feederClient]
  );

  return { status, loading, error, feeding, lastFedAt, feed, refresh };
}
