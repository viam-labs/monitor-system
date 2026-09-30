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
      {open && (() => {
        const links = [
          { to: '/', label: 'Cameras', alwaysShow: true, end: true },
          { to: '/bark', label: 'Bark detection', show: showBark, loading: barkLoading },
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
          <ul className="nav-menu__list" role="menu">
            {visible.map((l) => (
              l.end ? (
                <li key={l.to}>
                  <NavLink
                    to={l.to}
                    end
                    onClick={close}
                    className={({ isActive }) =>
                      `nav-menu__link${isActive ? ' nav-menu__link--active' : ''}`
                    }
                  >
                    {l.label}
                  </NavLink>
                </li>
              ) : (
                <FeatureLink
                  key={l.to}
                  to={l.to}
                  label={l.label}
                  loading={!l.show && l.loading}
                  onClick={close}
                />
              )
            ))}
          </ul>
        );
      })()}
    </div>
  );
}
