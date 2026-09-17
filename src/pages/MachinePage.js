import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import HamburgerMenu from '../components/HamburgerMenu';
import { useMachineConnection } from '../hooks/useMachineConnection';
import { subscribeConnectionHealth } from '../lib/connectionHealth';

const PAGE_TITLES = {
  '/': 'Home',
  '/feeder': 'Feeder',
  '/thermostat': 'Thermostat',
  '/curtain': 'Curtain',
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
        showThermostat={!!(connection.acBotName && connection.roomMeterName)}
        showCurtain={!!connection.curtainName}
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
        <Outlet context={connection} />
      </div>
    </>
  );
}

export default MachinePage;
