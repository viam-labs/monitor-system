import { useState, useEffect } from 'react';
import {
  createRobotClient,
  GenericComponentClient,
  SensorClient,
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

const PROBE_TIMEOUT_MS = 5000;
const RETRY_INTERVAL_MS = 15000;
// Cap the retry loop so a permanently-broken component stops
// showing "loading" forever. 4 rounds × 15s ≈ 1 minute of retries.
const MAX_RETRY_ROUNDS = 4;

class ProbeTimeout extends Error {
  constructor(name) {
    super(`probe timed out: ${name}`);
    this.isTimeout = true;
  }
}

function probeWithTimeout(fn, name, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new ProbeTimeout(name)), ms);
  });
  return Promise.race([fn(), timeout]).finally(() => clearTimeout(timer));
}

// Match a generic-component status response to one of our known models
// by shape, and set the corresponding name into `into`.
function matchGeneric(name, status, into) {
  if (!status || typeof status !== 'object') return;
  if (status.kind === 'clicker') {
    into.doorUnlockName = name;
    return;
  }
  if (status.kind === 'waterer_pump') {
    into.watererName = name;
    return;
  }
  if (status.kind === 'inventory_tracker') {
    into.inventoryName = name;
    if (typeof status.state_sensor === 'string' && status.state_sensor) {
      into.inventoryStateSensorName = status.state_sensor;
    }
    return;
  }
  if ('food_state' in status || 'food_low_status' in status) {
    into.feederName = name;
  } else if ('on_temp_c' in status || 'off_temp_c' in status || 'bot_position' in status) {
    into.thermostatName = name;
  } else if ('slide_position' in status) {
    into.curtainName = name;
  }
}

function matchSensor(name, readings, into) {
  if (readings && typeof readings === 'object' && 'temperature_c' in readings) {
    into.roomMeterName = name;
  }
}

async function probeGeneric(c, name, timeoutMs) {
  return probeWithTimeout(
    () => new GenericComponentClient(c, name).doCommand({ command: 'status' }),
    name,
    timeoutMs,
  );
}

async function probeSensor(c, name, timeoutMs) {
  return probeWithTimeout(
    () => new SensorClient(c, name).getReadings(),
    name,
    timeoutMs,
  );
}

// The JS SDK's resourceNames() returns name + subtype but NOT model,
// so we can't filter by model. Detect by capability instead. Each
// probe races a 5s timeout; anything that times out gets returned in
// `pendingRetry` for background retry so a slow cloud API doesn't
// permanently hide a healthy component.
async function detectFeaturePages(c, resources, timeoutMs = PROBE_TIMEOUT_MS) {
  const detected = {
    feederName: null,
    thermostatName: null,
    curtainName: null,
    doorUnlockName: null,
    watererName: null,
    inventoryName: null,
    inventoryStateSensorName: null,
    acBotName: null,
    roomMeterName: null,
  };
  const pendingRetry = [];

  const generics = resources.filter(r => r.subtype === 'generic');
  const sensors = resources.filter(r => r.subtype === 'sensor');
  const switches = resources.filter(r => r.subtype === 'switch');

  await Promise.all(generics.map(async r => {
    try {
      const status = await probeGeneric(c, r.name, timeoutMs);
      matchGeneric(r.name, status, detected);
    } catch (e) {
      if (e?.isTimeout) pendingRetry.push({ kind: 'generic', name: r.name });
    }
  }));

  await Promise.all(sensors.map(async r => {
    try {
      const readings = await probeSensor(c, r.name, timeoutMs);
      matchSensor(r.name, readings, detected);
    } catch (e) {
      if (e?.isTimeout) pendingRetry.push({ kind: 'sensor', name: r.name });
    }
  }));

  if (switches.length > 0) {
    detected.acBotName = switches[0].name;
  }

  return { detected, pendingRetry };
}

function countPending(list) {
  const out = { generic: 0, sensor: 0 };
  for (const r of list) out[r.kind] = (out[r.kind] || 0) + 1;
  return out;
}

function scheduleRetries(c, initialPending, applyDetected, onPendingChange, isCancelled) {
  let remaining = [...initialPending];
  let round = 0;
  let timer = null;

  const tick = async () => {
    if (isCancelled()) return;
    round += 1;
    const stillPending = [];
    for (const entry of remaining) {
      if (isCancelled()) return;
      try {
        const partial = {};
        if (entry.kind === 'generic') {
          const status = await probeGeneric(c, entry.name, PROBE_TIMEOUT_MS);
          matchGeneric(entry.name, status, partial);
        } else if (entry.kind === 'sensor') {
          const readings = await probeSensor(c, entry.name, PROBE_TIMEOUT_MS);
          matchSensor(entry.name, readings, partial);
        }
        if (!isCancelled()) applyDetected(partial);
      } catch (e) {
        if (e?.isTimeout && round < MAX_RETRY_ROUNDS) stillPending.push(entry);
        // Non-timeout, or past the retry cap → drop from the list.
      }
    }
    remaining = stillPending;
    if (!isCancelled()) onPendingChange(countPending(remaining));
    if (remaining.length > 0 && !isCancelled()) {
      timer = setTimeout(tick, RETRY_INTERVAL_MS);
    }
  };

  timer = setTimeout(tick, RETRY_INTERVAL_MS);
  return () => {
    if (timer) clearTimeout(timer);
  };
}

export function useMachineConnection() {
  const [client, setClient] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [audioName, setAudioName] = useState('');
  const [feederName, setFeederName] = useState(null);
  const [thermostatName, setThermostatName] = useState(null);
  const [curtainName, setCurtainName] = useState(null);
  const [doorUnlockName, setDoorUnlockName] = useState(null);
  const [watererName, setWatererName] = useState(null);
  const [inventoryName, setInventoryName] = useState(null);
  const [inventoryStateSensorName, setInventoryStateSensorName] = useState(null);
  const [acBotName, setAcBotName] = useState(null);
  const [roomMeterName, setRoomMeterName] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detectingFeatures, setDetectingFeatures] = useState(true);
  const [pendingProbes, setPendingProbes] = useState({ generic: 0, sensor: 0 });
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let stopRetries = null;

    const applyDetected = (d) => {
      if (d.feederName) setFeederName(d.feederName);
      if (d.thermostatName) setThermostatName(d.thermostatName);
      if (d.curtainName) setCurtainName(d.curtainName);
      if (d.doorUnlockName) setDoorUnlockName(d.doorUnlockName);
      if (d.watererName) setWatererName(d.watererName);
      if (d.inventoryName) setInventoryName(d.inventoryName);
      if (d.inventoryStateSensorName) setInventoryStateSensorName(d.inventoryStateSensorName);
      if (d.acBotName) setAcBotName(d.acBotName);
      if (d.roomMeterName) setRoomMeterName(d.roomMeterName);
    };

    async function init() {
      try {
        const c = await createClient();
        if (cancelled) return;
        // Wait for the first RPC to succeed before exposing the client.
        // On slower networks the WebRTC data channel isn't ready the
        // instant createRobotClient returns; resourceNames doubles as
        // a readiness probe.
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

        detectFeaturePages(c, resources).then(({ detected, pendingRetry }) => {
          if (cancelled) return;
          applyDetected(detected);
          setPendingProbes(countPending(pendingRetry));
          setDetectingFeatures(false);
          if (pendingRetry.length > 0) {
            stopRetries = scheduleRetries(
              c,
              pendingRetry,
              applyDetected,
              setPendingProbes,
              () => cancelled,
            );
          }
        }).catch(() => {
          if (cancelled) return;
          setDetectingFeatures(false);
        });

        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError(e.message);
        setLoading(false);
      }
    }

    init();

    return () => {
      cancelled = true;
      if (stopRetries) stopRetries();
    };
  }, []);

  return {
    client,
    cameras,
    audioName,
    feederName,
    thermostatName,
    curtainName,
    doorUnlockName,
    watererName,
    inventoryName,
    inventoryStateSensorName,
    acBotName,
    roomMeterName,
    loading,
    detectingFeatures,
    pendingProbes,
    error,
  };
}
