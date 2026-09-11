import React, { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { createRobotClient, StreamClient } from '@viamrobotics/sdk';
import Cookies from 'js-cookie';
import MicButton from './MicButton';
import ModeToggle from './ModeToggle';

async function createClient() {
  const cookieKey = window.location.pathname.split('/')[2];
  const { apiKey: { id, key }, hostname } = JSON.parse(Cookies.get(cookieKey));
  return await createRobotClient({
    host: hostname,
    signalingAddress: 'https://app.viam.com:443',
    credentials: { type: 'api-key', payload: key, authEntity: id },
  });
}

// Wraps a state update in the View Transitions API when available, so
// tile focus/unfocus animates via CSS morphing instead of snapping.
function transition(update) {
  if (typeof document.startViewTransition === 'function') {
    document.startViewTransition(() => flushSync(update));
  } else {
    update();
  }
}

// View-transition-name must be a CSS ident; strip anything that isn't
// alphanumeric or underscore so remote-prefixed names like "pi1:cam"
// still work.
function tileTransitionName(name) {
  return `cam-${name.replace(/[^a-zA-Z0-9_]/g, '_')}`;
}

// Motion detection tuning.
const MOTION_THRESHOLD = 0.018;
const PIXEL_DIFF_THRESHOLD = 100;
const SAMPLE_INTERVAL_MS = 500;
const DECIDE_INTERVAL_MS = 800;
const HYSTERESIS_MS = 3500;

// Column spans (out of 6) for each visible tile as a function of how
// many tiles are visible. Keeps things close to 16:9 on landscape
// viewports and fills the bottom row on odd counts.
function spansFor(count) {
  if (count <= 1) return [6];
  if (count === 2) return [3, 3];
  if (count === 3) return [2, 2, 2];
  if (count === 4) return [3, 3, 3, 3];
  if (count === 5) return [2, 2, 2, 3, 3];
  if (count === 6) return [2, 2, 2, 2, 2, 2];
  return Array(count).fill(2);
}

function CameraTile({
  name,
  stream,
  isFocused,
  onFocus,
  onExit,
  offscreen,
  gridSpan,
  motionRef,
  motionEnabled,
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.muted = true;
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  // Motion detection runs from the tile's own <video> element, which
  // stays mounted across visible/off-screen toggles so decoding never
  // pauses. Only active in auto mode.
  useEffect(() => {
    if (!motionEnabled) return;
    const motion = motionRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 90;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let prev = null;

    const sample = () => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0) return;
      try {
        ctx.drawImage(video, 0, 0, 160, 90);
        const cur = ctx.getImageData(0, 0, 160, 90);
        if (prev) {
          let diff = 0;
          const data = cur.data;
          const pdata = prev.data;
          for (let i = 0; i < data.length; i += 4) {
            const c = data[i] + data[i + 1] + data[i + 2];
            const p = pdata[i] + pdata[i + 1] + pdata[i + 2];
            if (Math.abs(c - p) > PIXEL_DIFF_THRESHOLD) diff++;
          }
          const level = diff / (canvas.width * canvas.height);
          const previous = motion[name] || 0;
          motion[name] = previous * 0.6 + level * 0.4;
        }
        prev = cur;
      } catch (_) {
        // Canvas taint or video not ready; ignore.
      }
    };

    const id = setInterval(sample, SAMPLE_INTERVAL_MS);
    return () => {
      clearInterval(id);
      delete motion[name];
    };
  }, [motionEnabled, name, motionRef]);

  const clickable = Boolean(onFocus) && !offscreen;
  const handleKeyDown = clickable
    ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onFocus();
        }
      }
    : undefined;

  const className =
    'camera-tile' +
    (clickable ? ' camera-tile--clickable' : '') +
    (offscreen ? ' camera-tile--offscreen' : '');

  const style = offscreen
    ? undefined
    : {
        viewTransitionName: tileTransitionName(name),
        ...(gridSpan ? { gridColumn: `span ${gridSpan}` } : {}),
      };

  return (
    <div
      className={className}
      style={style}
      onClick={clickable ? onFocus : undefined}
      onKeyDown={handleKeyDown}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? `Focus ${name}` : undefined}
      aria-hidden={offscreen || undefined}
    >
      <video ref={videoRef} autoPlay playsInline muted />
      {!offscreen && (
        <div className="camera-label">
          {stream && <span className="live-indicator" aria-label="Live" />}
          {name}
        </div>
      )}
      {!offscreen && isFocused && (
        <button
          type="button"
          className="back-button"
          onClick={(e) => {
            e.stopPropagation();
            onExit();
          }}
        >
          ← Back
        </button>
      )}
    </div>
  );
}

function CameraViewer() {
  const [cameras, setCameras] = useState([]);
  const [streams, setStreams] = useState({});
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [client, setClient] = useState(null);
  const [audioName, setAudioName] = useState('');
  const [mode, setMode] = useState('manual');
  const [autoVisible, setAutoVisible] = useState([]);
  const motionRef = useRef({});
  const lastActiveRef = useRef({});
  const autoVisibleRef = useRef([]);

  useEffect(() => {
    autoVisibleRef.current = autoVisible;
  }, [autoVisible]);

  useEffect(() => {
    const startedStreams = {};
    async function init() {
      try {
        const c = await createClient();
        setClient(c);
        const resources = await c.resourceNames();
        const cams = resources
          .filter(r => r.subtype === 'camera')
          .map(r => ({ id: r.name, name: r.name }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setCameras(cams);

        const audio = resources.find(
          r => r.subtype === 'audio_in' || r.subtype === 'audio_input'
        );
        if (audio) setAudioName(audio.name);

        const streamClient = new StreamClient(c);
        for (const cam of cams) {
          try {
            startedStreams[cam.name] = await streamClient.getStream(cam.name);
          } catch (e) {
            console.error(`Failed to start stream for ${cam.name}:`, e);
          }
        }
        setStreams({ ...startedStreams });
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    init();
    return () => {
      Object.values(startedStreams).forEach(s => {
        s?.getTracks().forEach(t => t.stop());
      });
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e) => {
      if (e.key === 'Escape') transition(() => setSelected(''));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  // In focused view (manual mode), clicking anywhere on the page that
  // isn't a tile or a control button returns to the grid.
  useEffect(() => {
    if (!selected) return;
    const onClick = (e) => {
      if (e.target.closest('.camera-tile')) return;
      if (e.target.closest('button')) return;
      transition(() => setSelected(''));
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [selected]);

  // iOS Safari sometimes refuses to autoplay <video> with srcObject
  // even when muted+playsinline+autoplay are all set. On the first
  // user gesture anywhere on the page, retry play() on every video so
  // the ones that stalled with a play button get kicked into motion.
  useEffect(() => {
    const kick = () => {
      document.querySelectorAll('video').forEach(v => {
        v.muted = true;
        v.play().catch(() => {});
      });
    };
    document.addEventListener('click', kick, { once: true });
    document.addEventListener('touchstart', kick, { once: true, passive: true });
    return () => {
      document.removeEventListener('click', kick);
      document.removeEventListener('touchstart', kick);
    };
  }, []);

  // Auto-mode decision loop.
  useEffect(() => {
    if (mode !== 'auto') return;

    const id = setInterval(() => {
      const levels = motionRef.current;
      const lastActive = lastActiveRef.current;
      const now = Date.now();

      for (const name of Object.keys(levels)) {
        if (levels[name] > MOTION_THRESHOLD) {
          lastActive[name] = now;
        }
      }

      const active = cameras
        .map(c => c.name)
        .filter(n => now - (lastActive[n] || 0) < HYSTERESIS_MS);

      // Debug log until threshold is dialed in.
      const snapshot = {};
      for (const c of cameras) {
        snapshot[c.name] = Number((levels[c.name] || 0).toFixed(4));
      }
      console.log('[motion]', snapshot, 'active:', active, 'threshold:', MOTION_THRESHOLD);

      const current = autoVisibleRef.current;
      const same =
        current.length === active.length &&
        current.every(n => active.includes(n));
      if (!same) {
        transition(() => setAutoVisible(active));
      }
    }, DECIDE_INTERVAL_MS);

    return () => clearInterval(id);
  }, [mode, cameras]);

  useEffect(() => {
    motionRef.current = {};
    lastActiveRef.current = {};
    setAutoVisible([]);
  }, [mode]);

  if (loading) return (
    <div className="paw-loader" aria-label="Loading cameras">
      <span>🐾</span>
      <span>🐾</span>
      <span>🐾</span>
    </div>
  );
  if (error) return <div>Error: {error}</div>;
  if (cameras.length === 0) return <div>No cameras found on this machine.</div>;

  let visibleNames;
  if (mode === 'auto') {
    visibleNames = autoVisible.length > 0 ? autoVisible : cameras.map(c => c.name);
  } else {
    visibleNames = selected ? [selected] : cameras.map(c => c.name);
  }
  const visibleSet = new Set(visibleNames);

  const multi = cameras.length > 1;
  const canAutoFollow = cameras.length > 1;

  const handleTileFocus = (name) => {
    if (mode === 'auto') setMode('manual');
    transition(() => setSelected(name));
  };

  // Assign each visible tile a column span (out of 6) so grid layout
  // uses only the visible-tile count, ignoring off-screen tiles that
  // are absolute-positioned outside the grid flow.
  const visibleOrdered = cameras.filter(c => visibleSet.has(c.name));
  const spans = spansFor(visibleOrdered.length);
  const spanByName = {};
  visibleOrdered.forEach((c, i) => { spanByName[c.name] = spans[i]; });

  return (
    <>
      <div className="camera-grid">
        {cameras.map(c => {
          const offscreen = !visibleSet.has(c.name);
          return (
            <CameraTile
              key={c.id}
              name={c.name}
              stream={streams[c.name]}
              isFocused={selected === c.name}
              onFocus={multi ? () => handleTileFocus(c.name) : undefined}
              onExit={() => transition(() => setSelected(''))}
              offscreen={offscreen}
              gridSpan={offscreen ? undefined : spanByName[c.name]}
              motionRef={motionRef}
              motionEnabled={mode === 'auto'}
            />
          );
        })}
      </div>
      {canAutoFollow && (
        <ModeToggle
          mode={mode}
          onToggle={() => setMode(m => (m === 'auto' ? 'manual' : 'auto'))}
        />
      )}
      {audioName && client && <MicButton client={client} audioName={audioName} />}
    </>
  );
}

export default CameraViewer;
