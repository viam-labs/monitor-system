import React, { useState, useEffect, useRef } from 'react';
import { createRobotClient, StreamClient } from '@viamrobotics/sdk';
import Cookies from 'js-cookie';

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
            <ellipse cx="25" cy="35" rx="9" ry="12" />
            <ellipse cx="42" cy="22" rx="9" ry="12" />
            <ellipse cx="58" cy="22" rx="9" ry="12" />
            <ellipse cx="75" cy="35" rx="9" ry="12" />
            <path d="M50 45 Q 25 50 30 80 Q 40 95 50 95 Q 60 95 70 80 Q 75 50 50 45 Z" />
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
      if (e.key === 'Escape') setSelected('');
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
          onFocus={multi ? () => setSelected(c.name) : undefined}
          onExit={() => setSelected('')}
        />
      ))}
    </div>
  );
}

export default CameraViewer;
