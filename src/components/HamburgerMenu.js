import React, { useState, useRef, useEffect } from 'react';
import { NavLink } from 'react-router-dom';

function MiniPaws() {
  return (
    <span className="mini-paws" aria-label="loading">
      <span>🐾</span>
      <span>🐾</span>
      <span>🐾</span>
    </span>
  );
}

export default function HamburgerMenu({
  showFeeder,
  feederLoading,
  showThermostat,
  thermostatLoading,
  showCurtain,
  curtainLoading,
  showDoor,
  doorLoading,
  showWaterer,
  watererLoading,
  showInventory,
  inventoryLoading,
  showBark,
  barkLoading,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('click', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  const links = [
    { to: '/', label: 'Home', alwaysShow: true, end: true },
    { to: '/cameras', label: 'Cameras', alwaysShow: true },
    { to: '/bark', label: 'Sounds', show: showBark, loading: barkLoading },
    { to: '/door', label: 'Building Door', show: showDoor, loading: doorLoading },
    { to: '/curtain', label: 'Curtain', show: showCurtain, loading: curtainLoading },
    { to: '/feeder', label: 'Feeder', show: showFeeder, loading: feederLoading },
    { to: '/inventory', label: 'Inventory', show: showInventory, loading: inventoryLoading },
    { to: '/thermostat', label: 'Thermostat', show: showThermostat, loading: thermostatLoading },
    { to: '/waterer', label: 'Waterer', show: showWaterer, loading: watererLoading },
  ];
  const visible = links
    .filter((l) => l.alwaysShow || l.show || l.loading)
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <nav className="nav-menu" ref={ref}>
      <button
        type="button"
        className={`nav-menu__button${open ? ' nav-menu__button--open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
      >
        <span /><span /><span />
      </button>
      <ul
        className={`nav-menu__list${open ? ' nav-menu__list--open' : ''}`}
        role="menu"
      >
        {visible.map((l) => {
          const showLoading = !l.alwaysShow && !l.show && l.loading;
          return (
            <li key={l.to}>
              <NavLink
                to={l.to}
                end={l.end || false}
                onClick={close}
                className={({ isActive }) =>
                  'nav-menu__link'
                  + (isActive ? ' nav-menu__link--active' : '')
                  + (showLoading ? ' nav-menu__link--loading' : '')
                }
              >
                <span>{l.label}</span>
                {showLoading && <MiniPaws />}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
