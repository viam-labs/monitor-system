import { useCallback, useEffect, useMemo, useState } from 'react';
import { GenericComponentClient } from '@viamrobotics/sdk';
import { callWithRetry } from './callWithRetry';
import { usePolling } from './usePolling';
import { handleRpcError } from '../lib/connectionHealth';

export function useMusic(client, musicName) {
  const controller = useMemo(
    () => (client && musicName ? new GenericComponentClient(client, musicName) : null),
    [client, musicName]
  );

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [playlists, setPlaylists] = useState(null);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!controller) return;
    setError(null);
    try {
      const s = await callWithRetry(() => controller.doCommand({ command: 'status' }));
      setStatus(s || null);
    } catch (e) {
      if (!handleRpcError(e)) setError(e.message || String(e));
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

  usePolling(refresh, { enabled: !!controller });

  const refreshPlaylists = useCallback(async () => {
    if (!controller) return;
    setPlaylistsLoading(true);
    try {
      const r = await controller.doCommand({ command: 'playlists' });
      if (r && Array.isArray(r.items)) setPlaylists(r.items);
    } catch (e) {
      if (!handleRpcError(e)) setError(e.message || String(e));
    } finally {
      setPlaylistsLoading(false);
    }
  }, [controller]);

  useEffect(() => {
    if (!controller) return;
    refreshPlaylists();
  }, [controller, refreshPlaylists]);

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
        if (!handleRpcError(e)) setError(e.message || String(e));
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [controller, refresh, status]
  );

  const start = useCallback(
    (contextUri) => runMutation(
      { command: 'start', ...(contextUri ? { context_uri: contextUri } : {}) },
      () => ({ is_playing: true }),
    ),
    [runMutation]
  );

  const stop = useCallback(
    () => runMutation({ command: 'stop' }, () => ({ is_playing: false })),
    [runMutation]
  );

  const toggle = useCallback(
    () => (status?.is_playing ? stop() : start()),
    [status, start, stop]
  );

  const next = useCallback(
    () => runMutation({ command: 'next' }),
    [runMutation]
  );

  const previous = useCallback(
    () => runMutation({ command: 'previous' }),
    [runMutation]
  );

  const setVolume = useCallback(
    (volume) => runMutation(
      { command: 'set_volume', volume },
      () => ({ volume }),
    ),
    [runMutation]
  );

  const volumeUp = useCallback(
    () => runMutation({ command: 'volume_up' }),
    [runMutation]
  );

  const volumeDown = useCallback(
    () => runMutation({ command: 'volume_down' }),
    [runMutation]
  );

  const setAccount = useCallback(
    (name) => runMutation(
      { command: 'set_account', name },
      () => ({ active_account: name }),
    ).then(() => refreshPlaylists()),
    [runMutation, refreshPlaylists]
  );

  return {
    status,
    loading,
    error,
    busy,
    refresh,
    start,
    stop,
    toggle,
    next,
    previous,
    setVolume,
    volumeUp,
    volumeDown,
    playlists,
    playlistsLoading,
    refreshPlaylists,
    accounts: status?.accounts || [],
    activeAccount: status?.active_account || null,
    setAccount,
  };
}
