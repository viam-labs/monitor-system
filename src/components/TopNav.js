import React from 'react';
import { NavLink, useOutletContext } from 'react-router-dom';

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/cameras', label: 'Cameras' },
  { to: '/feeder', label: 'Feeder' },
  { to: '/waterer', label: 'Waterer' },
  { to: '/thermostat', label: 'Thermostat' },
  { to: '/curtain', label: 'Curtains' },
  { to: '/inventory', label: 'Inventory' },
  { to: '/music', label: 'Music' },
  { to: '/bark', label: 'Sounds' },
  { to: '/air', label: 'Air' },
  { to: '/door', label: 'Door' },
  { to: '/system', label: 'System' },
];

export default function TopNav({ availability = {} }) {
  const ctx = useOutletContext() || {};
  const systemAlert = (ctx.machineInfo?.offlineCount || 0) > 0;
  const links = LINKS.filter((l) => availability[l.to] !== false);
  return (
    <nav className="top-nav" aria-label="Primary">
      {links.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.end}
          className={({ isActive }) =>
            'top-nav__link'
            + (isActive ? ' top-nav__link--on' : '')
            + (systemAlert && l.to === '/system' ? ' top-nav__link--alert' : '')
          }
        >
          {l.label}
        </NavLink>
      ))}
    </nav>
  );
}
