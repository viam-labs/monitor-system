import { useState, useEffect } from 'react';
import {
  createRobotClient,
  GenericComponentClient,
  SensorClient,
  StreamClient,
} from '@viamrobotics/sdk';
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

// The JS SDK's resourceNames() and getMachineStatus() return name +
// subtype but NOT model, so we can't filter by model. Detect by
// capability instead:
//  - Generic components: probe do_command({command:"status"}) and match
//    on response shape (feeder returns food_state, thermostat returns
//    above_temp_c / bot_position).
//  - Sensors: getReadings() and match on temperature_c (SwitchBot
//    meter shape).
//  - Switches: no probe distinguishes them, so we take the first one.
//    If a user later has a second switch, we'll need a config hint.
async function detectFeaturePages(c, resources) {
  const detected = {
    feederName: null,
    thermostatName: null,
    curtainName: null,
    acBotName: null,
    roomMeterName: null,
  };

  const generics = resources.filter(r => r.subtype === 'generic');
  const sensors = resources.filter(r => r.subtype === 'sensor');
  const switches = resources.filter(r => r.subtype === 'switch');

  await Promise.all(generics.map(async r => {
    try {
      const status = await new GenericComponentClient(c, r.name).doCommand({ command: 'status' });
      if (status && typeof status === 'object') {
        if ('food_state' in status || 'food_low_status' in status) {
          detected.feederName = r.name;
        } else if ('on_temp_c' in status || 'off_temp_c' in status || 'bot_position' in status) {
          detected.thermostatName = r.name;
        } else if ('slide_position' in status) {
          detected.curtainName = r.name;
        }
      }
    } catch {
      // Generic without a status command — not one of ours.
    }
  }));

  await Promise.all(sensors.map(async r => {
    try {
      const readings = await new SensorClient(c, r.name).getReadings();
      if (readings && typeof readings === 'object' && 'temperature_c' in readings) {
        detected.roomMeterName = r.name;
      }
    } catch {
      // Sensor unreachable or non-temperature — skip.
    }
  }));

  if (switches.length > 0) {
    detected.acBotName = switches[0].name;
  }

  return detected;
}

export function useMachineConnection() {
  const [client, setClient] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [streams, setStreams] = useState({});
  const [audioName, setAudioName] = useState('');
  const [feederName, setFeederName] = useState(null);
  const [thermostatName, setThermostatName] = useState(null);
  const [curtainName, setCurtainName] = useState(null);
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
        // to consumers. On slower networks the WebRTC data channel
        // isn't ready the instant createRobotClient returns; using
        // resourceNames as the readiness probe is free.
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

        // Feature-page detection runs alongside stream startup so a
        // slow probe doesn't block the cameras page from painting.
        detectFeaturePages(c, resources).then(d => {
          if (cancelled) return;
          setFeederName(d.feederName);
          setThermostatName(d.thermostatName);
          setCurtainName(d.curtainName);
          setAcBotName(d.acBotName);
          setRoomMeterName(d.roomMeterName);
        });

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
    thermostatName,
    curtainName,
    acBotName,
    roomMeterName,
    loading,
    error,
  };
}
