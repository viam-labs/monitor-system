import React from 'react';
import { NavLink } from 'react-router-dom';

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/cameras', label: 'Cameras' },
  { to: '/feeder', label: 'Feeder' },
  { to: '/waterer', label: 'Waterer' },
  { to: '/thermostat', label: 'Thermostat' },
  { to: '/curtain', label: 'Curtains' },
  { to: '/inventory', label: 'Inventory' },
  { to: '/bark', label: 'Sounds' },
  { to: '/door', label: 'Door' },
];

export default function TopNav({ availability = {} }) {
  const links = LINKS.filter((l) => availability[l.to] !== false);
  return (
    <nav className="top-nav" aria-label="Primary">
      {links.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.end}
          className={({ isActive }) => 'top-nav__link' + (isActive ? ' top-nav__link--on' : '')}
        >
          {l.label}
        </NavLink>
      ))}
    </nav>
  );
}
