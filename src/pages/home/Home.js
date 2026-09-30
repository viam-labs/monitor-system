import React from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import {
  Utensils, Droplet, DoorClosed, Thermometer, Blinds, Package, Activity, ChevronRight,
} from 'lucide-react';
import CameraHero from '../../components/CameraHero';
import TopNav from '../../components/TopNav';
import BottomTabBar from '../../components/BottomTabBar';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { buildRows } from './buildRows';
import './Home.css';

const ICONS = {
  feeder: Utensils,
  waterer: Droplet,
  thermostat: Thermometer,
  curtain: Blinds,
  inventory: Package,
  bark: Activity,
  door: DoorClosed,
};

function IosToggle({ on, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      className={'home-sw' + (on ? '' : ' home-sw--off')}
      onClick={(e) => { e.stopPropagation(); onChange(!on); }}
    />
  );
}

function ActionLink({ label, onClick, disabled }) {
  return (
    <button
      type="button"
      className="home-row__link"
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      {label}
    </button>
  );
}

function HomeRow({ row }) {
  const Icon = ICONS[row.icon];
  const clickable = !!row.onClick;
  const cls = 'home-row' + (row.dead ? ' home-row--dead' : '');
  return (
    <div
      className={cls}
      onClick={clickable ? row.onClick : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => { if (e.key === 'Enter') row.onClick(); }
          : undefined
      }
    >
      {Icon && <span className="home-row__ic"><Icon size={19} strokeWidth={1.6} /></span>}
      <div className="home-row__tx">
        <div className="home-row__nm">{row.name}</div>
        {row.subtitle && <div className="home-row__sb">{row.subtitle}</div>}
      </div>
      {row.action && <ActionLink {...row.action} />}
      {row.toggle && <IosToggle {...row.toggle} />}
      {clickable && <ChevronRight className="home-row__chev" size={15} strokeWidth={2} />}
    </div>
  );
}

export default function Home() {
  const ctx = useOutletContext();
  const navigate = useNavigate();
  const mobile = useMediaQuery('(max-width: 700px)');
  const rows = buildRows(ctx, navigate, mobile);

  const availability = {
    '/feeder': !!ctx.feederName,
    '/waterer': !!ctx.watererName,
    '/thermostat': !!(ctx.acBotName && ctx.roomMeterName),
    '/curtain': !!ctx.curtainName,
    '/inventory': !!(ctx.inventoryName && ctx.inventoryStateSensorName),
    '/bark': !!ctx.barkName,
    '/door': !!ctx.doorUnlockName,
  };

  return (
    <div className="home">
      <TopNav availability={availability} />
      <div className="home__body">
        <div className="home__wide">
          <section className="home__cams">
            <CameraHero
              cameras={ctx.cameras || []}
              streams={ctx.streams || {}}
              audioName={ctx.audioName}
            />
          </section>
          <section className="home__rows">
            {rows.map((r) => <HomeRow key={r.key} row={r} />)}
          </section>
        </div>
      </div>
      <BottomTabBar />
    </div>
  );
}
