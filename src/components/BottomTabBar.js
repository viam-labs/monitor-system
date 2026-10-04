import React from 'react';
import { NavLink, useOutletContext } from 'react-router-dom';
import { Home, Camera, Package, MoreHorizontal } from 'lucide-react';

const TABS = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/cameras', label: 'Cameras', icon: Camera },
  { to: '/inventory', label: 'Inventory', icon: Package },
  { to: '/more', label: 'More', icon: MoreHorizontal },
];

export default function BottomTabBar() {
  const ctx = useOutletContext() || {};
  const systemAlert = (ctx.machineInfo?.offlineCount || 0) > 0;
  return (
    <nav className="tab-bar" aria-label="Primary">
      {TABS.map((t) => {
        const Icon = t.icon;
        return (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              'tab-bar__tab'
              + (isActive ? ' tab-bar__tab--on' : '')
              + (systemAlert && t.to === '/more' ? ' tab-bar__tab--alert' : '')
            }
          >
            <Icon size={22} strokeWidth={1.7} />
            <span className="tab-bar__label">{t.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
