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

function CameraTile({ name, stream }) {
  const videoRef = useRef(null);
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);
  return (
    <div className="camera-tile">
      <video ref={videoRef} autoPlay playsInline muted />
      <div className="camera-label">
        {stream && <span className="live-indicator" aria-label="Live" />}
        {name}
      </div>
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
          .map(r => ({ id: r.name, name: r.name }));
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

  if (loading) return <div>Loading cameras…</div>;
  if (error) return <div>Error: {error}</div>;
  if (cameras.length === 0) return <div>No cameras found on this machine.</div>;

  const visible = selected ? cameras.filter(c => c.name === selected) : cameras;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
      {cameras.length > 1 && (
        <select
          className="camera-select"
          value={selected}
          onChange={e => setSelected(e.target.value)}
        >
          <option value="">All cameras</option>
          {cameras.map(c => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>
      )}
      <div className="camera-grid">
        {visible.map(c => (
          <CameraTile key={c.id} name={c.name} stream={streams[c.name]} />
        ))}
      </div>
    </div>
  );
}

export default CameraViewer;
