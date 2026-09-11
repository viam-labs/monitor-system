import React, { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { createRobotClient, StreamClient } from '@viamrobotics/sdk';
import Cookies from 'js-cookie';
import MicButton from './MicButton';

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
      // iOS Safari sometimes needs an explicit play() after srcObject is
      // set even with autoplay+muted+playsinline. Swallow the promise
      // rejection — worst case a browser blocks and shows its own play
      // button, which is still better than a frozen frame.
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
    <>
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
      {audioName && client && <MicButton client={client} audioName={audioName} />}
    </>
  );
}

export default CameraViewer;
