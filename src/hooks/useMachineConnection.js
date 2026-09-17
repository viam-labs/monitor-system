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
// Component names we look for when detecting feature-page targets.
// Users wiring differently-named components need to rename these or
// we make them configurable.
const FEEDER_RESOURCE_NAME = 'feeder';
const AC_BOT_RESOURCE_NAME = 'ac_bot';
const ROOM_METER_RESOURCE_NAME = 'room_meter';

export function useMachineConnection() {
  const [client, setClient] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [streams, setStreams] = useState({});
  const [audioName, setAudioName] = useState('');
  const [feederName, setFeederName] = useState(null);
  const [acBotName, setAcBotName] = useState(null);
  const [roomMeterName, setRoomMeterName] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const startedStreams = {};

    async function init() {
      try {
        const c = await createClient();
        if (cancelled) return;
        // Wait for the first RPC to succeed before exposing the client
        // to consumers. On slower networks (mobile especially), the
        // WebRTC data channel isn't ready the instant createRobotClient
        // returns, so eager consumers hit "not connected" on their
        // first do_command. resourceNames is what we need anyway;
        // using it as the readiness probe is free.
        const resources = await c.resourceNames();
        if (cancelled) return;
        setClient(c);

        const cams = resources
          .filter(r => r.subtype === 'camera')
          .map(r => ({ id: r.name, name: r.name }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setCameras(cams);

        const audio = resources.find(
          r => r.subtype === 'audio_in' || r.subtype === 'audio_input'
        );
        if (audio) setAudioName(audio.name);

        const feeder = resources.find(
          r => r.subtype === 'generic' && r.name === FEEDER_RESOURCE_NAME
        );
        if (feeder) setFeederName(feeder.name);

        const acBot = resources.find(
          r => r.subtype === 'switch' && r.name === AC_BOT_RESOURCE_NAME
        );
        if (acBot) setAcBotName(acBot.name);

        const roomMeter = resources.find(
          r => r.subtype === 'sensor' && r.name === ROOM_METER_RESOURCE_NAME
        );
        if (roomMeter) setRoomMeterName(roomMeter.name);

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

  return {
    client,
    cameras,
    streams,
    audioName,
    feederName,
    acBotName,
    roomMeterName,
    loading,
    error,
  };
}
