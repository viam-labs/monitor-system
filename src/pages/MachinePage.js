import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import HamburgerMenu from '../components/HamburgerMenu';
import { useMachineConnection } from '../hooks/useMachineConnection';
import { useFeeder } from '../hooks/useFeeder';
import { useThermostat } from '../hooks/useThermostat';
import { useThermostatController } from '../hooks/useThermostatController';
import { useCurtain } from '../hooks/useCurtain';
import { useDoorUnlock } from '../hooks/useDoorUnlock';
import { useWaterer } from '../hooks/useWaterer';
import { useInventory } from '../hooks/useInventory';
import { useBark } from '../hooks/useBark';
import { useAir } from '../hooks/useAir';
import { useMusic } from '../hooks/useMusic';
import { useMachineInfo } from '../hooks/useMachineInfo';
import { useCameraStreams } from '../hooks/useCameraStreams';
import { subscribeConnectionHealth } from '../lib/connectionHealth';

const PAGE_TITLES = {
  '/': 'Home',
  '/cameras': 'Cameras',
  '/feeder': 'Feeder',
  '/thermostat': 'Thermostat',
  '/curtain': 'Curtain',
  '/door': 'Building Door',
  '/waterer': 'Waterer',
  '/inventory': 'Inventory',
  '/bark': 'Sounds',
  '/air': 'Air',
  '/music': 'Music',
  '/system': 'System',
};

function Paw({ className }) {
  return (
    <svg
      className={`paw ${className}`}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="25" cy="38" r="9" />
      <circle cx="42" cy="22" r="9" />
      <circle cx="58" cy="22" r="9" />
      <circle cx="75" cy="38" r="9" />
      <path d="M50 52 C 28 52, 22 68, 28 84 C 33 93, 42 96, 50 96 C 58 96, 67 93, 72 84 C 78 68, 72 52, 50 52 Z" />
    </svg>
  );
}

function MachinePage() {
  const connection = useMachineConnection();
  const location = useLocation();
  const navigate = useNavigate();
  const [connectionLost, setConnectionLost] = useState(false);

  // Hoisted so state (schedules, readings, last-fed, etc.) survives
  // navigation and pages hydrate instantly on mount instead of
  // re-fetching. Each hook's polling continues in the background;
  // any that lack a configured resource are cheap no-ops.
  const feeder = useFeeder(connection.client, connection.feederName);
  const thermostat = useThermostat(
    connection.client, connection.acBotName, connection.roomMeterName,
  );
  const thermostatController = useThermostatController(
    connection.client, connection.thermostatName,
  );
  const curtain = useCurtain(connection.client, connection.curtainName);
  const door = useDoorUnlock(connection.client, connection.doorUnlockName);
  const waterer = useWaterer(connection.client, connection.watererName);
  const inventory = useInventory(
    connection.client, connection.inventoryName, connection.inventoryStateSensorName,
  );
  const bark = useBark(connection.client, connection.barkName);
  const air = useAir(connection.client, connection.airName);
  const music = useMusic(connection.client, connection.musicName);
  const machineInfo = useMachineInfo();
  // Hoisted so all camera streams open once and stay warm across
  // route changes. Previously each page (CameraViewer, WatererPage's
  // WatererCamera) called useCameraStreams itself, which caused
  // "stream already active" collisions when both mounted the same
  // camera — Viam server allows one stream per camera per connection.
  const streams = useCameraStreams(connection.client, connection.cameras);

  const outletContext = useMemo(
    () => ({
      ...connection, feeder, thermostat, thermostatController, curtain, door, waterer, inventory, bark, air, music, machineInfo, streams,
    }),
    [connection, feeder, thermostat, thermostatController, curtain, door, waterer, inventory, bark, air, music, machineInfo, streams],
  );

  useEffect(() => {
    document.title = PAGE_TITLES[location.pathname] || 'Home';
  }, [location.pathname]);

  useEffect(() => subscribeConnectionHealth(setConnectionLost), []);

  const chromeless = ['/', '/more', '/cameras', '/feeder', '/waterer', '/thermostat', '/curtain', '/inventory', '/bark', '/air', '/door', '/music', '/system'].includes(location.pathname);

  useEffect(() => {
    const bg = chromeless ? '#f5f5f7' : '#0f0f10';
    document.body.style.setProperty('--body-bg', bg);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', bg);
  }, [chromeless]);

  return (
    <>
      {!chromeless && (
        <>
          <Paw className="paw--tr" />
          <Paw className="paw--bl" />
          <Paw className="paw--br" />
          <HamburgerMenu
            showFeeder={!!connection.feederName}
            feederLoading={!connection.feederName && connection.pendingProbes.generic > 0}
            showThermostat={!!(connection.acBotName && connection.roomMeterName)}
            thermostatLoading={
              !!connection.acBotName
              && !connection.roomMeterName
              && connection.pendingProbes.sensor > 0
            }
            showCurtain={!!connection.curtainName}
            curtainLoading={!connection.curtainName && connection.pendingProbes.generic > 0}
            showDoor={!!connection.doorUnlockName}
            doorLoading={!connection.doorUnlockName && connection.pendingProbes.generic > 0}
            showWaterer={!!connection.watererName}
            watererLoading={!connection.watererName && connection.pendingProbes.generic > 0}
            showInventory={!!(connection.inventoryName && connection.inventoryStateSensorName)}
            inventoryLoading={!connection.inventoryName && connection.pendingProbes.generic > 0}
            showBark={!!connection.barkName}
            barkLoading={!connection.barkName && connection.pendingProbes.sensor > 0}
            showAir={!!connection.airName}
            airLoading={!connection.airName && connection.pendingProbes.sensor > 0}
            showMusic={!!connection.musicName}
            musicLoading={!connection.musicName && connection.pendingProbes.generic > 0}
            systemAlert={machineInfo.offlineCount > 0}
          />
        </>
      )}
      {connectionLost && (
        <div className="connection-banner" role="alert">
          <span className="connection-banner__text">
            Disconnected from your Viam machine.
          </span>
          <button
            type="button"
            className="connection-banner__reconnect"
            onClick={() => navigate('/system')}
          >
            See System
          </button>
          <button
            type="button"
            className="connection-banner__reconnect"
            onClick={() => window.location.reload()}
          >
            Reconnect
          </button>
        </div>
      )}
      <div className={'page' + (chromeless ? ' page--home' : '')}>
        <Outlet context={outletContext} />
      </div>
    </>
  );
}

export default MachinePage;
