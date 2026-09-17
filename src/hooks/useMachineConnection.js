import { useState, useEffect } from 'react';
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

// Establishes the machine connection once at MachinePage mount, so it
// survives navigation between pages. Streams are populated per-camera
// as each getStream() resolves.
export function useMachineConnection() {
  const [client, setClient] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [streams, setStreams] = useState({});
  const [audioName, setAudioName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const startedStreams = {};

    async function init() {
      try {
        const c = await createClient();
        if (cancelled) return;
        setClient(c);

        const resources = await c.resourceNames();
        if (cancelled) return;

        const cams = resources
          .filter(r => r.subtype === 'camera')
          .map(r => ({ id: r.name, name: r.name }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setCameras(cams);

        const audio = resources.find(
          r => r.subtype === 'audio_in' || r.subtype === 'audio_input'
        );
        if (audio) setAudioName(audio.name);

        setLoading(false);

        const streamClient = new StreamClient(c);
        cams.forEach(cam => {
          streamClient.getStream(cam.name)
            .then(stream => {
              if (cancelled) {
                stream?.getTracks().forEach(t => t.stop());
                return;
              }
              startedStreams[cam.name] = stream;
              setStreams(prev => ({ ...prev, [cam.name]: stream }));
            })
            .catch(e => {
              console.error(`Failed to start stream for ${cam.name}:`, e);
            });
        });
      } catch (e) {
        if (cancelled) return;
        setError(e.message);
        setLoading(false);
      }
    }

    init();

    return () => {
      cancelled = true;
      Object.values(startedStreams).forEach(s => {
        s?.getTracks().forEach(t => t.stop());
      });
    };
  }, []);

  return { client, cameras, streams, audioName, loading, error };
}
