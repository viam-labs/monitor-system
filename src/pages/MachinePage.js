import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import HamburgerMenu from '../components/HamburgerMenu';
import { useMachineConnection } from '../hooks/useMachineConnection';
import { useFeeder } from '../hooks/useFeeder';
import { useThermostat } from '../hooks/useThermostat';
import { useThermostatController } from '../hooks/useThermostatController';
import { useCurtain } from '../hooks/useCurtain';
import { useDoorUnlock } from '../hooks/useDoorUnlock';
import { useWaterer } from '../hooks/useWaterer';
import { subscribeConnectionHealth } from '../lib/connectionHealth';

const PAGE_TITLES = {
  '/': 'Home',
  '/feeder': 'Feeder',
  '/thermostat': 'Thermostat',
  '/curtain': 'Curtain',
  '/door': 'Building Door',
  '/waterer': 'Waterer',
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

  const outletContext = useMemo(
    () => ({ ...connection, feeder, thermostat, thermostatController, curtain, door, waterer }),
    [connection, feeder, thermostat, thermostatController, curtain, door, waterer],
  );

  useEffect(() => {
    document.title = PAGE_TITLES[location.pathname] || 'Home';
  }, [location.pathname]);

  useEffect(() => subscribeConnectionHealth(setConnectionLost), []);

  return (
    <>
      <Paw className="paw--tl" />
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
      />
      {connectionLost && (
        <div className="connection-banner" role="alert">
          <span className="connection-banner__text">
            Disconnected from your Viam machine.
          </span>
          <button
            type="button"
            className="connection-banner__reconnect"
            onClick={() => window.location.reload()}
          >
            Reconnect
          </button>
        </div>
      )}
      <div className="page">
        <Outlet context={outletContext} />
      </div>
    </>
  );
}

export default MachinePage;
