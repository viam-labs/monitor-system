import React, { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { createRobotClient, StreamClient } from '@viamrobotics/sdk';
import Cookies from 'js-cookie';

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

async function createClient() {
  const cookieKey = window.location.pathname.split('/')[2];
  const { apiKey: { id, key }, hostname } = JSON.parse(Cookies.get(cookieKey));
  return await createRobotClient({
    host: hostname,
    signalingAddress: 'https://app.viam.com:443',
    credentials: { type: 'api-key', payload: key, authEntity: id },
  });
}

function CameraTile({ name, stream, isFocused, onFocus, onExit }) {
  const videoRef = useRef(null);
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
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
        {stream && (
          <svg
            className="live-indicator"
            viewBox="0 0 100 100"
            fill="currentColor"
            aria-label="Live"
          >
            <circle cx="25" cy="38" r="9" />
            <circle cx="42" cy="22" r="9" />
            <circle cx="58" cy="22" r="9" />
            <circle cx="75" cy="38" r="9" />
            <path d="M50 52 C 28 52, 22 68, 28 84 C 33 93, 42 96, 50 96 C 58 96, 67 93, 72 84 C 78 68, 72 52, 50 52 Z" />
          </svg>
        )}
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

  useEffect(() => {
    const startedStreams = {};
    async function init() {
      try {
        const client = await createClient();
        const resources = await client.resourceNames();
        const cams = resources
          .filter(r => r.subtype === 'camera')
          .map(r => ({ id: r.name, name: r.name }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setCameras(cams);

        const streamClient = new StreamClient(client);
        await Promise.all(cams.map(async c => {
          try {
            startedStreams[c.name] = await streamClient.getStream(c.name);
          } catch (e) {
            console.error(`Failed to start stream for ${c.name}:`, e);
          }
        }));
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

  if (loading) return (
    <div className="paw-loader" aria-label="Loading cameras">
      <span>🐾</span>
      <span>🐾</span>
      <span>🐾</span>
    </div>
  );
  if (error) return <div>Error: {error}</div>;
  if (cameras.length === 0) return <div>No cameras found on this machine.</div>;

  const visible = selected ? cameras.filter(c => c.name === selected) : cameras;
  const multi = cameras.length > 1;

  return (
    <div className="camera-grid">
      {visible.map(c => (
        <CameraTile
          key={c.id}
          name={c.name}
          stream={streams[c.name]}
          isFocused={selected === c.name}
          onFocus={multi ? () => transition(() => setSelected(c.name)) : undefined}
          onExit={() => transition(() => setSelected(''))}
        />
      ))}
    </div>
  );
}

export default CameraViewer;
