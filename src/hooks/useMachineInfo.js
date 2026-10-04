import { useCallback, useEffect, useState } from 'react';
import { getViamCloudClient, getMachineId } from '../lib/viamCloud';

const OFFLINE_AFTER_MS = 30 * 1000;
const POLL_MS = 15 * 1000;

function partStatus(lastAccessMs) {
  if (!lastAccessMs) return { status: 'awaiting_setup', offlineForMs: null };
  const age = Date.now() - lastAccessMs;
  if (age > OFFLINE_AFTER_MS) return { status: 'offline', offlineForMs: age };
  return { status: 'online', offlineForMs: null };
}

function componentNames(robotConfig) {
  if (!robotConfig) return [];
  const struct = robotConfig.toJson ? robotConfig.toJson() : robotConfig;
  const comps = Array.isArray(struct?.components) ? struct.components : [];
  const svcs = Array.isArray(struct?.services) ? struct.services : [];
  const names = [...comps, ...svcs]
    .map((e) => (typeof e?.name === 'string' ? e.name : ''))
    .filter(Boolean);
  return names;
}

export function useMachineInfo() {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    const machineId = getMachineId();
    if (!machineId) {
      setError('machine id not found in cookie');
      setLoading(false);
      return;
    }
    try {
      const vc = await getViamCloudClient();
      const rawParts = await vc.appClient.getRobotParts(machineId);
      const now = Date.now();
      const mapped = (rawParts || []).map((p) => {
        const lastAccessMs = p.lastAccess
          ? Number(p.lastAccess.seconds) * 1000 + Math.floor(Number(p.lastAccess.nanos || 0) / 1e6)
          : null;
        const s = partStatus(lastAccessMs);
        return {
          id: p.id,
          name: p.name,
          dnsName: p.dnsName,
          mainPart: p.mainPart,
          lastAccessMs,
          lastAccessAt: lastAccessMs ? new Date(lastAccessMs).toISOString() : null,
          status: s.status,
          offlineForMs: s.offlineForMs,
          components: componentNames(p.robotConfig),
          nowMs: now,
        };
      });
      mapped.sort((a, b) => {
        if (a.mainPart !== b.mainPart) return a.mainPart ? -1 : 1;
        return (a.name || '').localeCompare(b.name || '');
      });
      setParts(mapped);
      setError(null);
    } catch (e) {
      setError(e.message || String(e));
      console.error('machine info fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const offlineCount = parts.filter((p) => p.status === 'offline').length;
  const onlineCount = parts.filter((p) => p.status === 'online').length;

  return { parts, offlineCount, onlineCount, loading, error, refresh };
}
