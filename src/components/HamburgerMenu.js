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

function FeatureLink({ to, label, loading, onClick }) {
  return (
    <li>
      <NavLink
        to={to}
        onClick={onClick}
        className={({ isActive }) =>
          'nav-menu__link' +
          (isActive ? ' nav-menu__link--active' : '') +
          (loading ? ' nav-menu__link--loading' : '')
        }
      >
        <span>{label}</span>
        {loading && <MiniPaws />}
      </NavLink>
    </li>
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

  return (
    <div className="nav-menu" ref={ref}>
      <button
        type="button"
        className={`nav-menu__button${open ? ' nav-menu__button--open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
      >
        <span /><span /><span />
      </button>
      {open && (
        <ul className="nav-menu__list" role="menu">
          {(showDoor || doorLoading) && (
            <FeatureLink to="/door" label="Building Door" loading={!showDoor && doorLoading} onClick={close} />
          )}
          <li>
            <NavLink
              to="/"
              end
              onClick={close}
              className={({ isActive }) =>
                `nav-menu__link${isActive ? ' nav-menu__link--active' : ''}`
              }
            >
              Cameras
            </NavLink>
          </li>
          {(showCurtain || curtainLoading) && (
            <FeatureLink to="/curtain" label="Curtain" loading={!showCurtain && curtainLoading} onClick={close} />
          )}
          {(showFeeder || feederLoading) && (
            <FeatureLink to="/feeder" label="Feeder" loading={!showFeeder && feederLoading} onClick={close} />
          )}
          {(showThermostat || thermostatLoading) && (
            <FeatureLink to="/thermostat" label="Thermostat" loading={!showThermostat && thermostatLoading} onClick={close} />
          )}
          {(showWaterer || watererLoading) && (
            <FeatureLink to="/waterer" label="Waterer" loading={!showWaterer && watererLoading} onClick={close} />
          )}
        </ul>
      )}
    </div>
  );
}
