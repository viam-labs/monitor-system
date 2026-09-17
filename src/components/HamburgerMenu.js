import React, { useState, useRef, useEffect } from 'react';
import { NavLink } from 'react-router-dom';

export default function HamburgerMenu({ showFeeder, showThermostat }) {
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
          {showFeeder && (
            <li>
              <NavLink
                to="/feeder"
                onClick={close}
                className={({ isActive }) =>
                  `nav-menu__link${isActive ? ' nav-menu__link--active' : ''}`
                }
              >
                Feeder
              </NavLink>
            </li>
          )}
          {showThermostat && (
            <li>
              <NavLink
                to="/thermostat"
                onClick={close}
                className={({ isActive }) =>
                  `nav-menu__link${isActive ? ' nav-menu__link--active' : ''}`
                }
              >
                Thermostat
              </NavLink>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
