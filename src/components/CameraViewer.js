import React, { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { createRobotClient, StreamClient } from '@viamrobotics/sdk';
import Cookies from 'js-cookie';
import MicButton from './MicButton';

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

function CameraTile({ name, stream, isFocused, onFocus, onExit, gridSpan }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.muted = true;
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  const clickable = Boolean(onFocus);
  const handleKeyDown = clickable
    ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onFocus();
        }
      }
    : undefined;

  const className = 'camera-tile' + (clickable ? ' camera-tile--clickable' : '');

  const style = {
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

  // In focused view, clicking anywhere on the page that isn't a tile
  // or a control button returns to the grid.
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

  if (loading) return (
    <div className="paw-loader" aria-label="Loading cameras">
      <span>🐾</span>
      <span>🐾</span>
      <span>🐾</span>
    </div>
  );
  if (error) return <div>Error: {error}</div>;
  if (cameras.length === 0) return <div>No cameras found on this machine.</div>;

  const multi = cameras.length > 1;
  const visibleOrdered = selected
    ? cameras.filter(c => c.name === selected)
    : cameras;
  const spans = spansFor(visibleOrdered.length);

  const handleTileFocus = (name) => {
    transition(() => setSelected(name));
  };

  return (
    <>
      <div className="camera-grid">
        {visibleOrdered.map((c, i) => (
          <CameraTile
            key={c.id}
            name={c.name}
            stream={streams[c.name]}
            isFocused={selected === c.name}
            onFocus={multi ? () => handleTileFocus(c.name) : undefined}
            onExit={() => transition(() => setSelected(''))}
            gridSpan={spans[i]}
          />
        ))}
      </div>
      {audioName && client && <MicButton client={client} audioName={audioName} />}
    </>
  );
}

export default CameraViewer;
