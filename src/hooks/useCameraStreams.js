import { useEffect, useState } from 'react';
import { StreamClient } from '@viamrobotics/sdk';

const MAX_RESTART_ATTEMPTS = 5;
const MUTE_GRACE_MS = 3000;
const MAX_BACKOFF_MS = 32000;

const log = (name, msg, ...rest) => console.log(`[camera:${name}]`, msg, ...rest);

// Connection-transport errors mean the whole machine WebRTC pipe is
// down and the SDK is reconnecting on its own schedule. We retry
// getStream indefinitely (capped at MAX_BACKOFF_MS) for these because
// giving up mid-outage leaves tiles black forever after the SDK
// recovers.
function isTransportError(e) {
  if (!e) return false;
  const name = e.name || '';
  const msg = e.message || '';
  return (
    name === 'ConnectionClosedError' ||
    msg.includes('connection closed') ||
    msg.includes('timed out') ||
    msg.includes('Did not receive a stream')
  );
}

// Starts WebRTC video streams on mount and stops them on unmount.
// Also monitors track health: if a track goes silent (onmute for more
// than MUTE_GRACE_MS) or ends, we tear it down and re-request the
// stream. WebRTC tracks can go quiet mid-session without the peer
// connection dropping, which the SDK doesn't surface — the result
// there is a video element frozen on its last frame or black.
export function useCameraStreams(client, cameras) {
  const [streams, setStreams] = useState({});

  useEffect(() => {
    if (!client || !cameras || cameras.length === 0) return undefined;
    let cancelled = false;
    const streamClient = new StreamClient(client);
    const active = new Map();
    const restarting = new Set();
    const timers = new Set();

    const clearTimer = (id) => {
      if (!id) return;
      clearTimeout(id);
      timers.delete(id);
    };

    const teardown = (name) => {
      const s = active.get(name);
      if (s) {
        s.getTracks().forEach((t) => t.stop());
        active.delete(name);
      }
    };

    const attachHandlers = (name, stream) => {
      stream.getVideoTracks().forEach((track, i) => {
        let graceTimer = null;
        track.onmute = () => {
          log(name, `track[${i}] muted (readyState=${track.readyState})`);
          if (cancelled || graceTimer) return;
          graceTimer = setTimeout(() => {
            timers.delete(graceTimer);
            graceTimer = null;
            log(name, `mute grace elapsed, restarting`);
            scheduleRestart(name);
          }, MUTE_GRACE_MS);
          timers.add(graceTimer);
        };
        track.onunmute = () => {
          log(name, `track[${i}] unmuted`);
          clearTimer(graceTimer);
          graceTimer = null;
        };
        track.onended = () => {
          log(name, `track[${i}] ended (readyState=${track.readyState})`);
          clearTimer(graceTimer);
          graceTimer = null;
          if (!cancelled) scheduleRestart(name);
        };
      });
    };

    const scheduleRestart = (name, attempt = 0, transportRetries = 0) => {
      if (cancelled || restarting.has(name)) return;
      restarting.add(name);
      const backoffTicks = attempt + transportRetries;
      const delay =
        backoffTicks === 0 ? 0 : Math.min(2000 * 2 ** (backoffTicks - 1), MAX_BACKOFF_MS);
      const t = setTimeout(async () => {
        timers.delete(t);
        if (cancelled) {
          restarting.delete(name);
          return;
        }
        teardown(name);
        try {
          const stream = await streamClient.getStream(name);
          if (cancelled) {
            stream?.getTracks().forEach((tr) => tr.stop());
            restarting.delete(name);
            return;
          }
          const videoTracks = stream.getVideoTracks();
          log(
            name,
            `stream received (attempt ${attempt + 1}${transportRetries ? `, +${transportRetries} transport retries` : ''}) — video tracks: ${videoTracks.length}, muted: [${videoTracks.map((t) => t.muted).join(', ')}]`,
          );
          attachHandlers(name, stream);
          active.set(name, stream);
          setStreams((prev) => ({ ...prev, [name]: stream }));
          restarting.delete(name);
        } catch (e) {
          restarting.delete(name);
          if (isTransportError(e)) {
            console.warn(
              `[camera:${name}] getStream failed (transport down, retry ${transportRetries + 1}):`,
              e.message || e,
            );
            scheduleRestart(name, attempt, transportRetries + 1);
          } else if (attempt < MAX_RESTART_ATTEMPTS - 1) {
            console.warn(`[camera:${name}] getStream attempt ${attempt + 1} failed:`, e);
            scheduleRestart(name, attempt + 1, transportRetries);
          } else {
            console.warn(
              `[camera:${name}] gave up after ${MAX_RESTART_ATTEMPTS} non-transport attempts`,
            );
          }
        }
      }, delay);
      timers.add(t);
    };

    cameras.forEach((cam) => scheduleRestart(cam.name, 0));

    return () => {
      cancelled = true;
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
      Array.from(active.values()).forEach((s) =>
        s.getTracks().forEach((t) => t.stop()),
      );
      active.clear();
      setStreams({});
    };
  }, [client, cameras]);

  return streams;
}
