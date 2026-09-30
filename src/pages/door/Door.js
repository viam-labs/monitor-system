import React from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import TopNav from '../../components/TopNav';
import BottomTabBar from '../../components/BottomTabBar';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { formatRelative } from '../../lib/format';
import './Door.css';

const LOW_BATTERY_THRESHOLD = 20;

export default function DoorUnlockPage() {
  const ctx = useOutletContext();
  const navigate = useNavigate();
  const mobile = useMediaQuery('(max-width: 700px)');
  const {
    doorUnlockName, loading: connectionLoading, detectingFeatures, pendingProbes,
    door: d,
  } = ctx;
  const doorStillProbing = !doorUnlockName && pendingProbes && pendingProbes.generic > 0;
  const { lastOpenedAt, battery, error, busy } = d || {};
  const batteryLow = battery != null && battery <= LOW_BATTERY_THRESHOLD;

  const availability = {
    '/feeder': !!ctx.feederName,
    '/waterer': !!ctx.watererName,
    '/thermostat': !!(ctx.acBotName && ctx.roomMeterName),
    '/curtain': !!ctx.curtainName,
    '/inventory': !!(ctx.inventoryName && ctx.inventoryStateSensorName),
    '/bark': !!ctx.barkName,
    '/door': !!ctx.doorUnlockName,
  };

  if (connectionLoading || detectingFeatures || doorStillProbing) {
    return (
      <div className="door">
        <TopNav availability={availability} />
        <div className="door__body">
          <div className="door-loader">🐾 🐾 🐾</div>
        </div>
        <BottomTabBar />
      </div>
    );
  }

  if (!doorUnlockName) {
    return (
      <div className="door">
        <TopNav availability={availability} />
        <div className="door__body">
          <div className="door-stub">
            <h1 className="door__title">Building door</h1>
            <p>No clicker configured on this machine.</p>
          </div>
        </div>
        <BottomTabBar />
      </div>
    );
  }

  const handleOpen = async () => {
    try { await d.unlock(); } catch { /* surfaced */ }
  };

  const offline = !!error && !lastOpenedAt;
  const lastOpenedRel = formatRelative(lastOpenedAt);
  const ledeParts = [];
  if (offline) ledeParts.push('offline');
  if (lastOpenedRel) ledeParts.push(`last opened ${lastOpenedRel}`);
  if (battery != null) ledeParts.push(`${battery}% battery`);
  const lede = ledeParts.join(' · ') || 'ready';

  return (
    <div className="door">
      <TopNav availability={availability} />
      <div className="door__body">
        <div className="door__one">
          {mobile && (
            <button
              type="button"
              className="door__back"
              onClick={() => navigate('/')}
              aria-label="Back to Home"
            >
              <ChevronLeft size={17} />
              Home
            </button>
          )}
          <h1 className="door__title">Building door</h1>
          <p className={'door__lede' + (batteryLow || offline ? ' door__lede--low' : '')}>
            {(batteryLow || offline) && '⚠ '}{lede}
          </p>

          {error && !offline && <div className="door__banner">{error}</div>}

          <button
            type="button"
            className="door__primary"
            onClick={handleOpen}
            disabled={busy || offline}
          >
            {busy ? 'Opening…' : 'Open'}
          </button>
          {offline && (
            <p className="door__hint">
              The bot hasn't reported in. Check the hub.
            </p>
          )}
        </div>
      </div>
      <BottomTabBar />
    </div>
  );
}
