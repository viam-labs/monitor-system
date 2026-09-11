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
// Falls back to a plain update on browsers without the API.
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

// Fraction of downsampled pixels that must change frame-to-frame to
// count as motion. 1% of a 160x90 frame ~= 144 changed pixels.
const MOTION_THRESHOLD = 0.01;
// Sample cadence and auto-mode decision cadence.
const SAMPLE_INTERVAL_MS = 500;
const DECIDE_INTERVAL_MS = 800;
// Once a camera crosses the motion threshold it stays in the auto-mode
// visible set for at least this long, even if it goes still — avoids
// flicker when a dog freezes for a moment.
const HYSTERESIS_MS = 3500;

function CameraTile({ name, stream, isFocused, onFocus, onExit, motionRef, motionEnabled }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  // Motion detection: sample a downscaled canvas from the video and
  // diff pixel-by-pixel against the previous frame. Writes an
  // exponential-moving-average motion level into motionRef so
  // CameraViewer's decision loop can read it.
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
            if (Math.abs(c - p) > 75) diff++;
          }
          const level = diff / (canvas.width * canvas.height);
          const previous = motion[name] || 0;
          motion[name] = previous * 0.6 + level * 0.4;
        }
        prev = cur;
      } catch (_) {
        // Canvas can throw on cross-origin taint or a not-yet-ready
        // video; ignore and try again next tick.
      }
    };

    const id = setInterval(sample, SAMPLE_INTERVAL_MS);
    return () => {
      clearInterval(id);
      delete motion[name];
    };
  }, [motionEnabled, name, motionRef]);

  const clickable = Boolean(onFocus);
  const handleKeyDown = clickable
    ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onFocus();
        }
      }
    : undefined;

  return (
    <div
      className={`camera-tile${clickable ? ' camera-tile--clickable' : ''}`}
      style={{ viewTransitionName: tileTransitionName(name) }}
      onClick={clickable ? onFocus : undefined}
      onKeyDown={handleKeyDown}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? `Focus ${name}` : undefined}
    >
      <video ref={videoRef} autoPlay playsInline muted />
      <div className="camera-label">
        {stream && <span className="live-indicator" aria-label="Live" />}
        {name}
      </div>
      {isFocused && (
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

        // The API is registered as rdk:component:audio_in (short form);
        // older or JS-conventional subtypes may still return audio_input.
        const audio = resources.find(
          r => r.subtype === 'audio_in' || r.subtype === 'audio_input'
        );
        if (audio) setAudioName(audio.name);

        // Sequential rather than Promise.all: StreamClient shares one
        // WebRTC peer connection, and concurrent negotiations can return
        // tracks out of order, so a tile ends up bound to the wrong
        // stream. Trades ~1-2s slower startup for correct labeling.
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

  // Auto-mode decision loop. Reads motion levels from motionRef, marks
  // any camera above the threshold as "recently active", and shows the
  // set of currently-recently-active cameras. Hysteresis window keeps a
  // camera in the visible set for HYSTERESIS_MS after its motion drops,
  // so a brief pause doesn't yank it off screen.
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

  // Reset motion state when mode toggles so we don't carry stale
  // levels between modes.
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

  // Manual mode: user-focused tile fills the view, otherwise full grid.
  // Auto mode: show only cameras with recent motion; if none have any,
  // fall back to full grid (which resumes sampling on all cameras).
  let visible;
  if (mode === 'auto') {
    visible =
      autoVisible.length > 0
        ? cameras.filter(c => autoVisible.includes(c.name))
        : cameras;
  } else {
    visible = selected ? cameras.filter(c => c.name === selected) : cameras;
  }

  const multi = cameras.length > 1;
  const canAutoFollow = cameras.length > 1;

  // In auto mode, clicking a tile drops back to manual mode focused on
  // that tile — natural override.
  const handleTileFocus = (name) => {
    if (mode === 'auto') setMode('manual');
    transition(() => setSelected(name));
  };

  return (
    <>
      <div className="camera-grid">
        {visible.map(c => (
          <CameraTile
            key={c.id}
            name={c.name}
            stream={streams[c.name]}
            isFocused={selected === c.name}
            onFocus={multi ? () => handleTileFocus(c.name) : undefined}
            onExit={() => transition(() => setSelected(''))}
            motionRef={motionRef}
            motionEnabled={mode === 'auto'}
          />
        ))}
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
